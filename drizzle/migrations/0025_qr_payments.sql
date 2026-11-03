-- QR payment requests: opaque single-use payment requests encoded in QR codes.
CREATE TABLE public.qr_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  amount numeric NULL, -- NULL = payer chooses the amount
  currency text NOT NULL CHECK (currency IN ('NGN','USD')),
  description text NULL,
  expires_at timestamptz NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','cancelled')),
  paid_by uuid NULL,
  paid_at timestamptz NULL,
  transfer_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.qr_payment_requests TO authenticated;
GRANT ALL ON public.qr_payment_requests TO service_role;
ALTER TABLE public.qr_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_requests_owner_select ON public.qr_payment_requests
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR paid_by = auth.uid());
CREATE POLICY qr_requests_owner_insert ON public.qr_payment_requests
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY qr_requests_owner_update ON public.qr_payment_requests
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() AND status = 'open')
  WITH CHECK (owner_user_id = auth.uid());

-- Scan events feed admin monitoring; written only through security-definer RPCs.
CREATE TABLE public.qr_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_user_id uuid NULL,
  request_id uuid NULL,
  kind text NOT NULL CHECK (kind IN ('fin3a_request','fin3a_profile','external','invalid')),
  detail text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qr_scan_events TO service_role;
ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_qr_request(
  _amount numeric, _currency text, _description text DEFAULT NULL, _expires_in_minutes integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.consume_rate_limit('qr_request_create', 30, 3600) THEN
    RAISE EXCEPTION 'Too many payment requests; try again later';
  END IF;
  IF _currency NOT IN ('NGN','USD') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
  IF _amount IS NOT NULL AND (_amount <= 0 OR _amount > 1000000000) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _expires_in_minutes IS NOT NULL AND (_expires_in_minutes < 1 OR _expires_in_minutes > 10080) THEN
    RAISE EXCEPTION 'Expiry must be between 1 minute and 7 days';
  END IF;
  INSERT INTO public.qr_payment_requests (owner_user_id, amount, currency, description, expires_at)
  VALUES (auth.uid(), _amount, _currency, NULLIF(left(trim(COALESCE(_description,'')), 200), ''),
          CASE WHEN _expires_in_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => _expires_in_minutes) END)
  RETURNING id INTO _id;
  RETURN _id;
END
$$;

-- Resolve a scanned QR request: logs the scan, returns safe public details.
CREATE OR REPLACE FUNCTION public.resolve_qr_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _r record;
  _name text;
  _fid text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.consume_rate_limit('qr_resolve', 60, 3600) THEN
    RAISE EXCEPTION 'Too many scans; try again later';
  END IF;
  SELECT * INTO _r FROM public.qr_payment_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    INSERT INTO public.qr_scan_events (scanner_user_id, kind) VALUES (auth.uid(), 'invalid');
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  INSERT INTO public.qr_scan_events (scanner_user_id, request_id, kind) VALUES (auth.uid(), _r.id, 'fin3a_request');
  SELECT display_name, fin3a_id INTO _name, _fid FROM public.user_settings WHERE user_id = _r.owner_user_id;
  RETURN jsonb_build_object(
    'status', CASE
      WHEN _r.status <> 'open' THEN _r.status
      WHEN _r.expires_at IS NOT NULL AND _r.expires_at < now() THEN 'expired'
      ELSE 'open' END,
    'requestId', _r.id,
    'recipientName', COALESCE(_name, 'Fin3a user'),
    'recipientFin3aId', _fid,
    'amount', _r.amount,
    'currency', _r.currency,
    'description', _r.description,
    'expiresAt', _r.expires_at,
    'isOwn', _r.owner_user_id = auth.uid()
  );
END
$$;

-- Pay a QR request: server-validated, atomic, idempotent via the transfer ledger.
CREATE OR REPLACE FUNCTION public.pay_qr_request(
  _request_id uuid, _amount numeric, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _r record;
  _pay numeric;
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.consume_rate_limit('qr_pay', 30, 3600) THEN
    RAISE EXCEPTION 'Too many payments; try again later';
  END IF;
  SELECT * INTO _r FROM public.qr_payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF _r.owner_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot pay your own request'; END IF;
  IF _r.status = 'paid' THEN
    RETURN jsonb_build_object('id', _r.transfer_id, 'status', 'completed', 'duplicate', true);
  END IF;
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'This payment request is no longer open'; END IF;
  IF _r.expires_at IS NOT NULL AND _r.expires_at < now() THEN RAISE EXCEPTION 'This payment request has expired'; END IF;
  _pay := COALESCE(_r.amount, _amount);
  IF _pay IS NULL OR _pay <= 0 OR _pay > 1000000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  _result := public.execute_internal_transfer(
    auth.uid(), _r.owner_user_id, _r.currency, _pay,
    _idempotency_key, 'QR payment request ' || _request_id::text);
  IF _result->>'status' <> 'completed' THEN RETURN _result; END IF;
  UPDATE public.qr_payment_requests
  SET status = 'paid', paid_by = auth.uid(), paid_at = now(), transfer_id = (_result->>'id')::uuid
  WHERE id = _request_id;
  RETURN _result;
END
$$;

-- Log external/invalid scans from the scanner UI (Fin3a requests log via resolve).
CREATE OR REPLACE FUNCTION public.log_qr_scan(_kind text, _detail text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('fin3a_profile','external','invalid') THEN RAISE EXCEPTION 'Invalid scan kind'; END IF;
  IF NOT public.consume_rate_limit('qr_scan_log', 120, 3600) THEN RETURN; END IF;
  INSERT INTO public.qr_scan_events (scanner_user_id, kind, detail)
  VALUES (auth.uid(), _kind, NULLIF(left(trim(COALESCE(_detail,'')), 300), ''));
END
$$;

CREATE OR REPLACE FUNCTION public.admin_qr_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _scans bigint; _requests bigint; _paid bigint; _pending bigint; _failed bigint;
  _value jsonb; _suspicious bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT count(*) INTO _scans FROM public.qr_scan_events;
  SELECT count(*) INTO _requests FROM public.qr_payment_requests;
  SELECT count(*) INTO _paid FROM public.qr_payment_requests WHERE status = 'paid';
  SELECT count(*) INTO _pending FROM public.qr_payment_requests
    WHERE status = 'open' AND (expires_at IS NULL OR expires_at >= now());
  SELECT count(*) INTO _failed FROM public.internal_transfers
    WHERE status = 'failed' AND reference LIKE 'QR payment request %';
  SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) INTO _value FROM (
    SELECT currency, sum(amount) AS total FROM public.internal_transfers
    WHERE status = 'completed' AND reference LIKE 'QR payment request %' GROUP BY currency
  ) s;
  SELECT count(*) INTO _suspicious FROM (
    SELECT scanner_user_id FROM public.qr_scan_events
    WHERE created_at > now() - interval '24 hours' AND kind IN ('invalid','external')
    GROUP BY scanner_user_id HAVING count(*) >= 10
  ) s;
  RETURN jsonb_build_object('scans', _scans, 'requests', _requests, 'paid', _paid,
    'pending', _pending, 'failed', _failed, 'valueByCurrency', _value, 'suspicious', _suspicious);
END
$$;
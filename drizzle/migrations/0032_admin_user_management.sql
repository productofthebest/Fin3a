-- Swaps already write swap_in/swap_out; allow them alongside the original kinds.
ALTER TABLE public.account_ledger DROP CONSTRAINT account_ledger_kind_check;
ALTER TABLE public.account_ledger ADD CONSTRAINT account_ledger_kind_check CHECK (kind = ANY (ARRAY['deposit','withdrawal','transfer_in','transfer_out','swap_in','swap_out']));

CREATE TABLE public.admin_account_status (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deactivated','restricted')),
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','verified','rejected')),
  verification_note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_account_status TO service_role;
ALTER TABLE public.admin_account_status ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_user_id, created_at DESC);

CREATE TABLE public.balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  currency text NOT NULL CHECK (currency IN ('NGN','USD')),
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  ledger_id uuid REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.balance_adjustments TO service_role;
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END; $$;
CREATE TRIGGER admin_audit_log_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

CREATE OR REPLACE FUNCTION public.guard_adjustment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Adjustments cannot be deleted'; END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Decided adjustments are final'; END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.currency <> OLD.currency OR NEW.direction <> OLD.direction OR NEW.amount <> OLD.amount OR NEW.reason <> OLD.reason OR NEW.requested_by <> OLD.requested_by THEN
    RAISE EXCEPTION 'Adjustment request details are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER balance_adjustments_guard BEFORE UPDATE OR DELETE ON public.balance_adjustments FOR EACH ROW EXECUTE FUNCTION public.guard_adjustment_mutation();

-- Suspended, deactivated or restricted accounts cannot start money movements.
CREATE OR REPLACE FUNCTION public.account_blocked(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_account_status WHERE user_id = _user_id AND status <> 'active')
$$;
CREATE OR REPLACE FUNCTION public.enforce_account_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  _uid := CASE TG_TABLE_NAME WHEN 'internal_transfers' THEN NEW.from_user_id WHEN 'qr_payment_requests' THEN NEW.owner_user_id ELSE NEW.user_id END;
  IF public.account_blocked(_uid) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER internal_transfers_status_guard BEFORE INSERT ON public.internal_transfers FOR EACH ROW EXECUTE FUNCTION public.enforce_account_status();
CREATE TRIGGER currency_swaps_status_guard BEFORE INSERT ON public.currency_swaps FOR EACH ROW EXECUTE FUNCTION public.enforce_account_status();
CREATE TRIGGER qr_requests_status_guard BEFORE INSERT ON public.qr_payment_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_account_status();

CREATE OR REPLACE FUNCTION public.admin_require() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF; END; $$;

CREATE OR REPLACE FUNCTION public.admin_user_activity() RETURNS TABLE(user_id uuid, email text, phone text, created_at timestamptz, last_active timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, COALESCE(NULLIF(u.phone::text,''), p.phone), u.created_at,
    GREATEST(u.last_sign_in_at,
      (SELECT max(t.created_at) FROM public.transactions t WHERE t.user_id = u.id),
      (SELECT max(l.created_at) FROM public.account_ledger l WHERE l.user_id = u.id),
      (SELECT max(c.updated_at) FROM public.chat_threads c WHERE c.user_id = u.id))
  FROM auth.users u LEFT JOIN public.phone_identities p ON p.user_id = u.id
  WHERE u.deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION public.admin_user_activity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb; _now timestamptz := now();
BEGIN
  PERFORM public.admin_require();
  WITH u AS (SELECT * FROM public.admin_user_activity()),
  series AS (
    SELECT 'daily' AS period, b AS bucket, b + interval '1 day' AS bucket_end FROM generate_series(date_trunc('day', _now) - interval '29 days', date_trunc('day', _now), interval '1 day') b
    UNION ALL SELECT 'weekly', b, b + interval '1 week' FROM generate_series(date_trunc('week', _now) - interval '25 weeks', date_trunc('week', _now), interval '1 week') b
    UNION ALL SELECT 'monthly', b, b + interval '1 month' FROM generate_series(date_trunc('month', _now) - interval '23 months', date_trunc('month', _now), interval '1 month') b
    UNION ALL SELECT 'yearly', b, b + interval '1 year' FROM generate_series(LEAST(date_trunc('year', COALESCE((SELECT min(created_at) FROM u), _now)), date_trunc('year', _now) - interval '4 years'), date_trunc('year', _now), interval '1 year') b
  )
  SELECT jsonb_build_object(
    'generated_at', _now,
    'active_window_days', 100,
    'total', (SELECT count(*) FROM u),
    'new_today', (SELECT count(*) FROM u WHERE created_at >= date_trunc('day', _now)),
    'new_yesterday', (SELECT count(*) FROM u WHERE created_at >= date_trunc('day', _now) - interval '1 day' AND created_at < date_trunc('day', _now)),
    'new_week', (SELECT count(*) FROM u WHERE created_at >= date_trunc('week', _now)),
    'new_last_week', (SELECT count(*) FROM u WHERE created_at >= date_trunc('week', _now) - interval '1 week' AND created_at < date_trunc('week', _now)),
    'new_month', (SELECT count(*) FROM u WHERE created_at >= date_trunc('month', _now)),
    'new_last_month', (SELECT count(*) FROM u WHERE created_at >= date_trunc('month', _now) - interval '1 month' AND created_at < date_trunc('month', _now)),
    'active', (SELECT count(*) FROM u WHERE last_active >= _now - interval '100 days'),
    'inactive', (SELECT count(*) FROM u WHERE last_active IS NULL OR last_active < _now - interval '100 days'),
    'series', (SELECT COALESCE(jsonb_agg(jsonb_build_object('period', s.period, 'bucket', s.bucket,
        'new', (SELECT count(*) FROM u WHERE u.created_at >= s.bucket AND u.created_at < s.bucket_end),
        'total', (SELECT count(*) FROM u WHERE u.created_at < s.bucket_end)) ORDER BY s.period, s.bucket), '[]'::jsonb) FROM series s)
  ) INTO _r;
  RETURN _r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_user_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_balance(_user_id uuid, _currency text, _completed_only boolean) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END), 0)
  FROM public.account_ledger WHERE user_id = _user_id AND currency = _currency
    AND (CASE WHEN _completed_only THEN status = 'completed' ELSE status IN ('completed','pending') END)
$$;
REVOKE ALL ON FUNCTION public.admin_balance(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text, _limit integer, _offset integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _q text := NULLIF(btrim(COALESCE(_search, '')), ''); _r jsonb;
BEGIN
  PERFORM public.admin_require();
  WITH rows AS (
    SELECT a.*, s.display_name, s.fin3a_id, COALESCE(st.status, 'active') AS status, COALESCE(st.verification, 'unverified') AS verification
    FROM public.admin_user_activity() a
    LEFT JOIN public.user_settings s ON s.user_id = a.user_id
    LEFT JOIN public.admin_account_status st ON st.user_id = a.user_id
    WHERE _q IS NULL OR a.email ILIKE '%' || _q || '%' OR a.phone ILIKE '%' || _q || '%' OR s.display_name ILIKE '%' || _q || '%'
      OR s.fin3a_id ILIKE '%' || _q || '%' OR a.user_id::text ILIKE '%' || _q || '%'
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM rows), 'rows', COALESCE((SELECT jsonb_agg(x) FROM (
    SELECT r.user_id, r.email, r.phone, r.display_name, r.fin3a_id, r.created_at, r.last_active, r.status, r.verification,
      public.admin_balance(r.user_id, 'NGN', true) AS ngn, public.admin_balance(r.user_id, 'USD', true) AS usd
    FROM rows r ORDER BY r.created_at DESC LIMIT LEAST(GREATEST(_limit, 1), 100) OFFSET GREATEST(_offset, 0)) x), '[]'::jsonb)) INTO _r;
  RETURN _r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  PERFORM public.admin_require();
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id) VALUES (auth.uid(), 'view_user', _user_id);
  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object('user_id', a.user_id, 'email', a.email, 'phone', a.phone, 'created_at', a.created_at, 'last_active', a.last_active,
        'display_name', s.display_name, 'fin3a_id', s.fin3a_id, 'currency', s.currency, 'onboarding_completed', s.onboarding_completed,
        'status', COALESCE(st.status, 'active'), 'verification', COALESCE(st.verification, 'unverified'), 'verification_note', st.verification_note,
        'is_admin', public.has_role(a.user_id, 'admin'))
      FROM public.admin_user_activity() a LEFT JOIN public.user_settings s ON s.user_id = a.user_id LEFT JOIN public.admin_account_status st ON st.user_id = a.user_id WHERE a.user_id = _user_id),
    'balances', jsonb_build_object('NGN', jsonb_build_object('available', public.admin_balance(_user_id, 'NGN', true), 'with_pending', public.admin_balance(_user_id, 'NGN', false)),
                                   'USD', jsonb_build_object('available', public.admin_balance(_user_id, 'USD', true), 'with_pending', public.admin_balance(_user_id, 'USD', false))),
    'crypto', COALESCE((SELECT jsonb_agg(jsonb_build_object('symbol', ca.symbol, 'network', ca.network, 'address', c.address, 'status', c.status, 'created_at', c.created_at))
      FROM public.crypto_addresses c JOIN public.crypto_assets ca ON ca.id = c.asset_id WHERE c.user_id = _user_id), '[]'::jsonb),
    'ledger', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT id, kind, status, amount, currency, reference, provider, created_at FROM public.account_ledger WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 200) x), '[]'::jsonb),
    'ledger_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.account_ledger WHERE user_id = _user_id GROUP BY status) x), '{}'::jsonb),
    'transfers', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT id, CASE WHEN from_user_id = _user_id THEN 'sent' ELSE 'received' END AS direction, currency, amount, status, reference, created_at FROM public.internal_transfers WHERE from_user_id = _user_id OR to_user_id = _user_id ORDER BY created_at DESC LIMIT 100) x), '[]'::jsonb),
    'swaps', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT id, from_currency, to_currency, source_amount, destination_amount, rate, status, created_at FROM public.currency_swaps WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 100) x), '[]'::jsonb),
    'records', COALESCE((SELECT jsonb_agg(x ORDER BY x.occurred_at DESC) FROM (SELECT id, type, amount, currency, description, merchant, occurred_at, status, source FROM public.transactions WHERE user_id = _user_id ORDER BY occurred_at DESC LIMIT 100) x), '[]'::jsonb),
    'adjustments', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT * FROM public.balance_adjustments WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 50) x), '[]'::jsonb),
    'audit', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT l.id, l.action, l.detail, l.created_at, u.email AS admin_email FROM public.admin_audit_log l LEFT JOIN auth.users u ON u.id = l.admin_id WHERE l.target_user_id = _user_id ORDER BY l.created_at DESC LIMIT 100) x), '[]'::jsonb)
  ) INTO _r;
  RETURN _r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text, _reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old text;
BEGIN
  PERFORM public.admin_require();
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own account status'; END IF;
  IF _status NOT IN ('active','suspended','deactivated','restricted') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  SELECT status INTO _old FROM public.admin_account_status WHERE user_id = _user_id FOR UPDATE;
  INSERT INTO public.admin_account_status (user_id, status, updated_by, updated_at) VALUES (_user_id, _status, auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, detail)
    VALUES (auth.uid(), 'set_status', _user_id, jsonb_build_object('from', COALESCE(_old, 'active'), 'to', _status, 'reason', btrim(_reason)));
  RETURN COALESCE(_old, 'active');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_verification(_user_id uuid, _verification text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old text;
BEGIN
  PERFORM public.admin_require();
  IF _verification NOT IN ('unverified','verified','rejected') THEN RAISE EXCEPTION 'Invalid verification status'; END IF;
  IF length(btrim(COALESCE(_note, ''))) < 5 THEN RAISE EXCEPTION 'A note describing the manual check is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  SELECT verification INTO _old FROM public.admin_account_status WHERE user_id = _user_id FOR UPDATE;
  INSERT INTO public.admin_account_status (user_id, verification, verification_note, updated_by, updated_at) VALUES (_user_id, _verification, btrim(_note), auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE SET verification = EXCLUDED.verification, verification_note = EXCLUDED.verification_note, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, detail)
    VALUES (auth.uid(), 'set_verification', _user_id, jsonb_build_object('from', COALESCE(_old, 'unverified'), 'to', _verification, 'note', btrim(_note), 'method', 'manual_admin_check'));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_profile(_user_id uuid, _display_name text, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old text; _new text := NULLIF(btrim(COALESCE(_display_name, '')), '');
BEGIN
  PERFORM public.admin_require();
  IF _new IS NULL OR length(_new) > 80 THEN RAISE EXCEPTION 'Name must be 1-80 characters'; END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT display_name INTO _old FROM public.user_settings WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This user has not finished setup yet'; END IF;
  UPDATE public.user_settings SET display_name = _new, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, detail)
    VALUES (auth.uid(), 'update_profile', _user_id, jsonb_build_object('field', 'display_name', 'from', _old, 'to', _new, 'reason', btrim(_reason)));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_request_adjustment(_user_id uuid, _currency text, _direction text, _amount numeric, _reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  PERFORM public.admin_require();
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot request an adjustment to your own account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) THEN RAISE EXCEPTION 'Amount must be positive with at most 2 decimals'; END IF;
  INSERT INTO public.balance_adjustments (user_id, currency, direction, amount, reason, requested_by)
    VALUES (_user_id, _currency, _direction, _amount, btrim(_reason), auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, detail)
    VALUES (auth.uid(), 'request_adjustment', _user_id, jsonb_build_object('adjustment_id', _id, 'currency', _currency, 'direction', _direction, 'amount', _amount, 'reason', btrim(_reason)));
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_request_adjustment(uuid, text, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_decide_adjustment(_id uuid, _approve boolean, _note text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.balance_adjustments; _account uuid; _available numeric; _ledger uuid;
BEGIN
  PERFORM public.admin_require();
  SELECT * INTO _a FROM public.balance_adjustments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment not found'; END IF;
  IF _a.status <> 'pending' THEN RAISE EXCEPTION 'This adjustment was already decided'; END IF;
  IF _a.requested_by = auth.uid() THEN RAISE EXCEPTION 'A different administrator must approve this adjustment'; END IF;
  IF _a.user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot decide an adjustment to your own account'; END IF;
  IF length(btrim(COALESCE(_note, ''))) < 5 THEN RAISE EXCEPTION 'A decision note is required'; END IF;
  IF _approve THEN
    SELECT id INTO _account FROM public.accounts WHERE user_id = _a.user_id AND currency = _a.currency FOR UPDATE;
    IF _account IS NULL THEN
      IF _a.direction = 'debit' THEN RAISE EXCEPTION 'Insufficient balance for this debit'; END IF;
      INSERT INTO public.accounts (user_id, currency) VALUES (_a.user_id, _a.currency) RETURNING id INTO _account;
    END IF;
    IF _a.direction = 'debit' THEN
      SELECT COALESCE(SUM(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END), 0) INTO _available
        FROM public.account_ledger WHERE account_id = _account AND status IN ('completed','pending') AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));
      IF _available < _a.amount THEN RAISE EXCEPTION 'Insufficient balance for this debit'; END IF;
    END IF;
    INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
      VALUES (_a.user_id, _account, CASE WHEN _a.direction = 'credit' THEN 'deposit' ELSE 'withdrawal' END, 'completed', _a.amount, _a.currency, 'Balance adjustment', 'admin_adjustment', _a.id::text)
      RETURNING id INTO _ledger;
  END IF;
  UPDATE public.balance_adjustments SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, decided_by = auth.uid(), decided_at = now(), decision_note = btrim(_note), ledger_id = _ledger WHERE id = _id;
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, detail)
    VALUES (auth.uid(), CASE WHEN _approve THEN 'approve_adjustment' ELSE 'reject_adjustment' END, _a.user_id, jsonb_build_object('adjustment_id', _id, 'ledger_id', _ledger, 'note', btrim(_note), 'amount', _a.amount, 'currency', _a.currency, 'direction', _a.direction));
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_decide_adjustment(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_feed(_limit integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_require();
  RETURN jsonb_build_object(
    'audit', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT l.id, l.action, l.target_user_id, l.detail, l.created_at, a.email::text AS admin_email, t.email::text AS target_email
      FROM public.admin_audit_log l LEFT JOIN auth.users a ON a.id = l.admin_id LEFT JOIN auth.users t ON t.id = l.target_user_id ORDER BY l.created_at DESC LIMIT LEAST(GREATEST(_limit, 1), 500)) x), '[]'::jsonb),
    'pending_adjustments', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at) FROM (SELECT b.*, r.email::text AS requested_by_email, t.email::text AS target_email
      FROM public.balance_adjustments b LEFT JOIN auth.users r ON r.id = b.requested_by LEFT JOIN auth.users t ON t.id = b.user_id WHERE b.status = 'pending') x), '[]'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_audit_feed(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_require() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.account_blocked(uuid) FROM PUBLIC, anon, authenticated;
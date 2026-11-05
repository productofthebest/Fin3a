CREATE TABLE public.ngn_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  reference text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL CHECK (account_number ~ '^\d{10}$'),
  account_name text NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount >= 100 AND amount <= 5000000),
  fin3a_fee numeric(20,2) NOT NULL CHECK (fin3a_fee >= 0),
  payout numeric(20,2) NOT NULL CHECK (payout > 0 AND payout = amount - fin3a_fee),
  fee_version_id uuid REFERENCES public.fee_versions(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed')),
  provider_transfer_id text UNIQUE,
  ledger_id uuid NOT NULL REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ngn_withdrawals TO authenticated;
GRANT ALL ON public.ngn_withdrawals TO service_role;
ALTER TABLE public.ngn_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY ngn_withdrawal_owner_read ON public.ngn_withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ngn_withdrawal_admin_read ON public.ngn_withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ngn_withdrawals_user ON public.ngn_withdrawals(user_id, created_at DESC);

-- Reserves funds atomically: locks the wallet, checks spendable balance, posts a pending debit.
CREATE FUNCTION public.reserve_ngn_withdrawal(_user_id uuid, _idempotency_key text, _amount numeric, _bank_code text, _bank_name text, _account_number text, _account_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc uuid; existing public.ngn_withdrawals; fee_row jsonb; fee numeric(20,2); fee_id uuid; spendable numeric; lid uuid; ref text; amt numeric(20,2) := round(_amount,2);
BEGIN
  SELECT * INTO existing FROM public.ngn_withdrawals WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing.user_id <> _user_id THEN RAISE EXCEPTION 'Idempotency conflict'; END IF;
    RETURN jsonb_build_object('status','existing','reference',existing.reference,'payout',existing.payout);
  END IF;
  SELECT id INTO acc FROM public.accounts WHERE user_id = _user_id AND currency = 'NGN' FOR UPDATE;
  IF acc IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;
  SELECT f INTO fee_row FROM jsonb_array_elements(public.current_fee_schedule()) f WHERE f->>'service' = 'ngn_withdrawal';
  fee := (fee_row->>'flat_ngn')::numeric; fee_id := nullif(fee_row->>'id','')::uuid;
  IF fee IS NULL THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF amt < 100 OR amt > 5000000 OR amt <= fee THEN RETURN jsonb_build_object('status','invalid_amount'); END IF;
  SELECT coalesce(sum(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END),0) INTO spendable
    FROM public.account_ledger WHERE account_id = acc AND status IN ('completed','pending')
    AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));
  IF spendable < amt THEN RETURN jsonb_build_object('status','insufficient','available',spendable); END IF;
  ref := 'F3W-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_user_id, acc, 'withdrawal', 'pending', amt, 'NGN', 'Bank withdrawal to ' || _bank_name, 'flutterwave_transfer', ref) RETURNING id INTO lid;
  INSERT INTO public.ngn_withdrawals(user_id, account_id, reference, idempotency_key, bank_code, bank_name, account_number, account_name, amount, fin3a_fee, payout, fee_version_id, ledger_id)
  VALUES (_user_id, acc, ref, _idempotency_key, _bank_code, _bank_name, _account_number, _account_name, amt, fee, amt - fee, fee_id, lid);
  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',amt - fee);
END $$;
REVOKE ALL ON FUNCTION public.reserve_ngn_withdrawal(uuid,text,numeric,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ngn_withdrawal(uuid,text,numeric,text,text,text,text) TO service_role;

-- Applies a provider-verified final outcome exactly once. Failure releases the reserved funds.
CREATE FUNCTION public.finish_ngn_withdrawal(_reference text, _provider_transfer_id text, _outcome text, _amount numeric, _currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.ngn_withdrawals; sid uuid;
BEGIN
  SELECT * INTO w FROM public.ngn_withdrawals WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;
  IF _provider_transfer_id IS NOT NULL AND w.provider_transfer_id IS NULL THEN
    UPDATE public.ngn_withdrawals SET provider_transfer_id = _provider_transfer_id, updated_at = now() WHERE id = w.id;
  ELSIF _provider_transfer_id IS NOT NULL AND w.provider_transfer_id <> _provider_transfer_id THEN
    RAISE EXCEPTION 'Provider transfer mismatch';
  END IF;
  IF w.status <> 'pending' OR _outcome = 'pending' THEN RETURN jsonb_build_object('status', w.status); END IF;
  IF _outcome = 'successful' THEN
    IF _currency <> 'NGN' OR round(_amount,2) <> w.payout THEN RAISE EXCEPTION 'Verified transfer does not match'; END IF;
    UPDATE public.account_ledger SET status = 'completed', updated_at = now() WHERE id = w.ledger_id;
    INSERT INTO public.payment_fee_snapshots(user_id, account_id, ledger_id, service, currency, original_amount, quoted_payout, rate_state, fee_version_id, fee_rate_bps, fin3a_fee, provider_charge, network_charge, final_amount, provider, provider_reference, idempotency_key)
    VALUES (w.user_id, w.account_id, w.ledger_id, 'ngn_withdrawal', 'NGN', w.amount, w.amount, 'confirmed', w.fee_version_id, 0, w.fin3a_fee, 0, 0, w.payout, 'flutterwave_transfer', w.reference, 'ngn_withdrawal:' || w.reference)
    RETURNING id INTO sid;
    IF w.fin3a_fee > 0 THEN
      INSERT INTO public.revenue_events(snapshot_id, event_kind, fin3a_fee, provider_event_reference, verified_at, occurred_at)
      VALUES (sid, 'earned', w.fin3a_fee, 'flutterwave_transfer:' || coalesce(_provider_transfer_id, w.provider_transfer_id, w.reference), now(), now());
    END IF;
    UPDATE public.ngn_withdrawals SET status = 'successful', updated_at = now() WHERE id = w.id;
    RETURN jsonb_build_object('status','successful');
  ELSIF _outcome = 'failed' THEN
    UPDATE public.account_ledger SET status = 'failed', updated_at = now() WHERE id = w.ledger_id;
    UPDATE public.ngn_withdrawals SET status = 'failed', updated_at = now() WHERE id = w.id;
    RETURN jsonb_build_object('status','failed');
  END IF;
  RAISE EXCEPTION 'Invalid outcome';
END $$;
REVOKE ALL ON FUNCTION public.finish_ngn_withdrawal(text,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ngn_withdrawal(text,text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN ('recipient_lookup','internal_transfer','qr_request_create','qr_resolve','qr_pay','qr_scan_log','ngn_topup','ngn_withdrawal','bank_resolve')
     OR _limit < 1 OR _limit > 500 OR _window_seconds < 60 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate limit request';
  END IF;
  _start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limit_counters AS c (user_id, bucket, window_start, used)
  VALUES (_uid, _bucket, _start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET used = c.used + 1 WHERE c.used < _limit
  RETURNING 1 INTO _ok;
  RETURN _ok IS NOT NULL;
END;
$function$;
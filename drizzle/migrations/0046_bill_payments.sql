-- Bill payments paid from the NGN wallet through Flutterwave billers.
ALTER TABLE public.account_ledger DROP CONSTRAINT account_ledger_kind_check;
ALTER TABLE public.account_ledger ADD CONSTRAINT account_ledger_kind_check CHECK (kind = ANY (ARRAY['deposit','withdrawal','transfer_in','transfer_out','swap_in','swap_out','bill_payment']));

CREATE TABLE public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  reference text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('airtime','data','electricity','cable','internet','tax')),
  biller_code text NOT NULL,
  biller_name text NOT NULL,
  item_code text NOT NULL,
  customer text NOT NULL,
  customer_name text,
  amount numeric(20,2) NOT NULL CHECK (amount >= 50 AND amount <= 5000000),
  fin3a_fee numeric(20,2) NOT NULL DEFAULT 0 CHECK (fin3a_fee = 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed')),
  provider_tx_id text UNIQUE,
  ledger_id uuid NOT NULL REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY bill_payment_owner_read ON public.bill_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY bill_payment_admin_read ON public.bill_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX bill_payments_user ON public.bill_payments(user_id, created_at DESC);

-- Reserves funds atomically: locks the wallet, checks spendable balance, posts a pending debit.
CREATE FUNCTION public.reserve_bill_payment(_user_id uuid, _idempotency_key text, _amount numeric, _category text, _biller_code text, _biller_name text, _item_code text, _customer text, _customer_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc uuid; existing public.bill_payments; spendable numeric; lid uuid; ref text; amt numeric(20,2) := round(_amount,2);
BEGIN
  SELECT * INTO existing FROM public.bill_payments WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing.user_id <> _user_id THEN RAISE EXCEPTION 'Idempotency conflict'; END IF;
    RETURN jsonb_build_object('status','existing','reference',existing.reference);
  END IF;
  SELECT id INTO acc FROM public.accounts WHERE user_id = _user_id AND currency = 'NGN' FOR UPDATE;
  IF acc IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;
  IF amt < 50 OR amt > 5000000 THEN RETURN jsonb_build_object('status','invalid_amount'); END IF;
  IF _category NOT IN ('airtime','data','electricity','cable','internet','tax') THEN RETURN jsonb_build_object('status','invalid_category'); END IF;
  SELECT coalesce(sum(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END),0) INTO spendable
    FROM public.account_ledger WHERE account_id = acc AND status IN ('completed','pending')
    AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));
  IF spendable < amt THEN RETURN jsonb_build_object('status','insufficient','available',spendable); END IF;
  ref := 'F3B-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_user_id, acc, 'bill_payment', 'pending', amt, 'NGN', _biller_name || ' bill payment', 'flutterwave_bills', ref) RETURNING id INTO lid;
  INSERT INTO public.bill_payments(user_id, account_id, reference, idempotency_key, category, biller_code, biller_name, item_code, customer, customer_name, amount, ledger_id)
  VALUES (_user_id, acc, ref, _idempotency_key, _category, _biller_code, _biller_name, _item_code, _customer, _customer_name, amt, lid);
  RETURN jsonb_build_object('status','reserved','reference',ref);
END $$;
REVOKE ALL ON FUNCTION public.reserve_bill_payment(uuid,text,numeric,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_bill_payment(uuid,text,numeric,text,text,text,text,text,text) TO service_role;

-- Applies a provider-verified final outcome exactly once. Failure releases the reserved funds.
CREATE FUNCTION public.finish_bill_payment(_reference text, _provider_tx_id text, _outcome text, _amount numeric, _currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bill_payments;
BEGIN
  SELECT * INTO b FROM public.bill_payments WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;
  IF _provider_tx_id IS NOT NULL AND b.provider_tx_id IS NULL THEN
    UPDATE public.bill_payments SET provider_tx_id = _provider_tx_id, updated_at = now() WHERE id = b.id;
  ELSIF _provider_tx_id IS NOT NULL AND b.provider_tx_id <> _provider_tx_id THEN
    RAISE EXCEPTION 'Provider transaction mismatch';
  END IF;
  IF b.status <> 'pending' OR _outcome = 'pending' THEN RETURN jsonb_build_object('status', b.status); END IF;
  IF _outcome = 'successful' THEN
    IF _currency <> 'NGN' OR round(_amount,2) <> b.amount THEN RAISE EXCEPTION 'Verified bill payment does not match'; END IF;
    UPDATE public.account_ledger SET status = 'completed', updated_at = now() WHERE id = b.ledger_id;
    UPDATE public.bill_payments SET status = 'successful', updated_at = now() WHERE id = b.id;
    RETURN jsonb_build_object('status','successful');
  ELSIF _outcome = 'failed' THEN
    UPDATE public.account_ledger SET status = 'failed', updated_at = now() WHERE id = b.ledger_id;
    UPDATE public.bill_payments SET status = 'failed', updated_at = now() WHERE id = b.id;
    RETURN jsonb_build_object('status','failed');
  END IF;
  RAISE EXCEPTION 'Invalid outcome';
END $$;
REVOKE ALL ON FUNCTION public.finish_bill_payment(text,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_bill_payment(text,text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN ('recipient_lookup','internal_transfer','qr_request_create','qr_resolve','qr_pay','qr_scan_log','ngn_topup','ngn_withdrawal','bank_resolve','bill_payment','bill_validate')
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
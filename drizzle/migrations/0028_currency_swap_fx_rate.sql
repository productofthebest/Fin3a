-- NGN<->USD swap support: admin-managed FX rate, swap records, atomic swap executor.

CREATE TABLE public.fx_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ngn_per_usd numeric NOT NULL DEFAULT 1400 CHECK (ngn_per_usd > 0 AND ngn_per_usd <= 1000000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fx_settings (id, ngn_per_usd) VALUES (true, 1400);
GRANT SELECT ON public.fx_settings TO authenticated;
GRANT ALL ON public.fx_settings TO service_role;
ALTER TABLE public.fx_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read the FX rate"
  ON public.fx_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.currency_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  source_amount numeric NOT NULL,
  destination_amount numeric NOT NULL,
  rate numeric NOT NULL,
  status text NOT NULL,
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currency_swaps TO authenticated;
GRANT ALL ON public.currency_swaps TO service_role;
ALTER TABLE public.currency_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own swaps"
  ON public.currency_swaps FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_set_fx_rate(_ngn_per_usd numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _ngn_per_usd IS NULL OR _ngn_per_usd <= 0 OR _ngn_per_usd > 1000000 THEN
    RAISE EXCEPTION 'Invalid rate';
  END IF;
  INSERT INTO public.fx_settings (id, ngn_per_usd, updated_by, updated_at)
  VALUES (true, _ngn_per_usd, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
    SET ngn_per_usd = EXCLUDED.ngn_per_usd, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_fx_rate(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.execute_currency_swap(
  _user_id uuid, _from_currency text, _amount numeric, _idempotency_key text, _reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _to_currency text;
  _rate numeric;
  _dest numeric;
  _from_account uuid;
  _to_account uuid;
  _available numeric;
  _swap public.currency_swaps%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Swap must be for the signed-in user';
  END IF;
  IF _from_currency NOT IN ('NGN','USD') THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;
  _to_currency := CASE WHEN _from_currency = 'NGN' THEN 'USD' ELSE 'NGN' END;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT ngn_per_usd INTO _rate FROM public.fx_settings WHERE id = true;
  IF _rate IS NULL THEN _rate := 1400; END IF;
  IF _from_currency = 'USD' THEN
    _dest := round(_amount * _rate, 2);
  ELSE
    _dest := round(_amount / _rate, 2);
  END IF;
  IF _dest IS NULL OR _dest <= 0 THEN
    RAISE EXCEPTION 'Amount too small to swap';
  END IF;

  SELECT * INTO _swap FROM public.currency_swaps
  WHERE idempotency_key = _idempotency_key AND status = 'completed';
  IF FOUND THEN
    RETURN jsonb_build_object('id', _swap.id, 'status', 'completed', 'destination_amount', _swap.destination_amount, 'duplicate', true);
  END IF;

  SELECT id INTO _from_account FROM public.accounts
  WHERE user_id = _user_id AND currency = _from_currency
  FOR UPDATE;
  IF _from_account IS NULL THEN
    RAISE EXCEPTION 'Source account not found';
  END IF;
  SELECT id INTO _to_account FROM public.accounts WHERE user_id = _user_id AND currency = _to_currency;
  IF _to_account IS NULL THEN
    INSERT INTO public.accounts (user_id, currency) VALUES (_user_id, _to_currency) RETURNING id INTO _to_account;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END), 0)
  INTO _available
  FROM public.account_ledger
  WHERE account_id = _from_account AND status = 'completed';

  IF _available < _amount THEN
    INSERT INTO public.currency_swaps (user_id, from_currency, to_currency, source_amount, destination_amount, rate, status, reference, idempotency_key)
    VALUES (_user_id, _from_currency, _to_currency, _amount, _dest, _rate, 'failed', _reference, _idempotency_key || ':failed:' || gen_random_uuid()::text)
    RETURNING * INTO _swap;
    RETURN jsonb_build_object('id', _swap.id, 'status', 'failed', 'reason', 'Insufficient balance');
  END IF;

  INSERT INTO public.currency_swaps (user_id, from_currency, to_currency, source_amount, destination_amount, rate, status, reference, idempotency_key)
  VALUES (_user_id, _from_currency, _to_currency, _amount, _dest, _rate, 'completed', _reference, _idempotency_key)
  RETURNING * INTO _swap;

  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_user_id, _from_account, 'swap_out', 'completed', _amount, _from_currency, _reference, 'internal', _swap.id::text || ':out'),
         (_user_id, _to_account, 'swap_in', 'completed', _dest, _to_currency, _reference, 'internal', _swap.id::text || ':in');

  RETURN jsonb_build_object('id', _swap.id, 'status', 'completed', 'destination_amount', _dest, 'rate', _rate);
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_currency_swap(uuid, text, numeric, text, text) TO authenticated;

-- Crypto deposit destination preference: which currency account verified deposits should credit.
ALTER TABLE public.user_settings ADD COLUMN deposit_credit_currency text;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_deposit_credit_currency_check
  CHECK (deposit_credit_currency IS NULL OR deposit_credit_currency IN ('NGN','USD'));
COMMENT ON COLUMN public.user_settings.deposit_credit_currency IS 'Currency account chosen by the user for crediting verified crypto deposits';
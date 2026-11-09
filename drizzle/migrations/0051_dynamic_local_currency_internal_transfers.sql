-- Enable same-currency internal Fin3a transfers for every supported country wallet.
-- The sender must already own the selected currency account; no FX or conversion occurs.
-- The existing atomic balance, locking, immutable ledger and idempotency behavior is preserved.

CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  _from_user uuid, _to_user uuid, _currency text, _amount numeric,
  _idempotency_key text, _reference text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from_account uuid;
  _to_account uuid;
  _available numeric;
  _transfer_id uuid;
BEGIN
  IF _from_user IS NULL OR _to_user IS NULL OR _from_user = _to_user THEN
    RAISE EXCEPTION 'Invalid transfer parties';
  END IF;
  IF _currency IS NULL OR _currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT id INTO _transfer_id FROM public.internal_transfers
  WHERE idempotency_key = _idempotency_key AND status = 'completed';
  IF FOUND THEN
    RETURN _transfer_id;
  END IF;

  INSERT INTO public.accounts (user_id, currency) VALUES (_to_user, _currency)
  ON CONFLICT (user_id, currency) DO NOTHING RETURNING id INTO _to_account;
  IF _to_account IS NULL THEN
    SELECT id INTO _to_account FROM public.accounts WHERE user_id = _to_user AND currency = _currency;
  END IF;

  -- Require a real sender wallet in the exact currency. Recipient receives the
  -- same currency; this operation never performs an FX conversion.
  SELECT id INTO _from_account FROM public.accounts
  WHERE user_id = _from_user AND currency = _currency
  FOR UPDATE;
  IF _from_account IS NULL THEN
    RAISE EXCEPTION 'Sender account not found';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind IN ('deposit','transfer_in') THEN amount ELSE -amount END), 0)
  INTO _available
  FROM public.account_ledger
  WHERE account_id = _from_account AND status = 'completed';

  IF _available < _amount THEN
    INSERT INTO public.internal_transfers (from_user_id, to_user_id, currency, amount, status, reference, idempotency_key)
    VALUES (_from_user, _to_user, _currency, _amount, 'failed', _reference, _idempotency_key || ':failed:' || gen_random_uuid()::text);
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.internal_transfers (from_user_id, to_user_id, currency, amount, status, reference, idempotency_key)
  VALUES (_from_user, _to_user, _currency, _amount, 'completed', _reference, _idempotency_key)
  RETURNING id INTO _transfer_id;

  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_from_user, _from_account, 'transfer_out', 'completed', _amount, _currency, _reference, 'internal', _transfer_id::text || ':out');
  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_to_user, _to_account, 'transfer_in', 'completed', _amount, _currency, _reference, 'internal', _transfer_id::text || ':in');

  RETURN _transfer_id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.execute_internal_transfer(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;

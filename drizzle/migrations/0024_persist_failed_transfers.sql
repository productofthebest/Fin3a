-- Failed transfer attempts were rolled back together with the raised error, so admins
-- could never see them. The transfer functions now return a status object instead of
-- raising on insufficient balance, letting the failed audit row commit.
DROP FUNCTION public.transfer_internal(uuid, text, numeric, text, text);
DROP FUNCTION public.pay_split_share(uuid, text);
DROP FUNCTION public.execute_internal_transfer(uuid, uuid, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  _from_user uuid, _to_user uuid, _currency text, _amount numeric,
  _idempotency_key text, _reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from_account uuid;
  _to_account uuid;
  _available numeric;
  _transfer record;
BEGIN
  IF _from_user IS NULL OR _to_user IS NULL OR _from_user = _to_user THEN
    RAISE EXCEPTION 'Invalid transfer parties';
  END IF;
  IF _currency NOT IN ('NGN','USD') THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT * INTO _transfer FROM public.internal_transfers
  WHERE idempotency_key = _idempotency_key AND status = 'completed';
  IF FOUND THEN
    RETURN jsonb_build_object('id', _transfer.id, 'status', 'completed', 'duplicate', true);
  END IF;

  INSERT INTO public.accounts (user_id, currency) VALUES (_to_user, _currency)
  ON CONFLICT (user_id, currency) DO NOTHING RETURNING id INTO _to_account;
  IF _to_account IS NULL THEN
    SELECT id INTO _to_account FROM public.accounts WHERE user_id = _to_user AND currency = _currency;
  END IF;

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
    VALUES (_from_user, _to_user, _currency, _amount, 'failed', _reference, _idempotency_key || ':failed:' || gen_random_uuid()::text)
    RETURNING id INTO _transfer;
    RETURN jsonb_build_object('id', _transfer.id, 'status', 'failed', 'reason', 'Insufficient balance');
  END IF;

  INSERT INTO public.internal_transfers (from_user_id, to_user_id, currency, amount, status, reference, idempotency_key)
  VALUES (_from_user, _to_user, _currency, _amount, 'completed', _reference, _idempotency_key)
  RETURNING id INTO _transfer;

  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_from_user, _from_account, 'transfer_out', 'completed', _amount, _currency, _reference, 'internal', _transfer.id::text || ':out');
  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_to_user, _to_account, 'transfer_in', 'completed', _amount, _currency, _reference, 'internal', _transfer.id::text || ':in');

  RETURN jsonb_build_object('id', _transfer.id, 'status', 'completed');
END
$$;
REVOKE EXECUTE ON FUNCTION public.execute_internal_transfer(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.transfer_internal(
  _to_user uuid, _currency text, _amount numeric, _idempotency_key text, _reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.consume_rate_limit('internal_transfer', 30, 3600) THEN
    RAISE EXCEPTION 'Too many transfers; try again later';
  END IF;
  RETURN public.execute_internal_transfer(auth.uid(), _to_user, _currency, _amount, _idempotency_key, _reference);
END
$$;

CREATE OR REPLACE FUNCTION public.pay_split_share(_participant_id uuid, _idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p record;
  _bill record;
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO _p FROM public.split_bill_participants WHERE id = _participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;
  IF _p.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not your payment request';
  END IF;
  IF _p.status = 'paid' THEN
    RETURN jsonb_build_object('id', _p.transfer_id, 'status', 'completed', 'duplicate', true);
  END IF;
  SELECT * INTO _bill FROM public.split_bills WHERE id = _p.bill_id;
  IF _bill.status <> 'open' THEN
    RAISE EXCEPTION 'This bill is no longer open';
  END IF;
  _result := public.execute_internal_transfer(auth.uid(), _bill.creator_id, _bill.currency, _p.amount, _idempotency_key, 'Split bill: ' || _bill.title);
  IF _result->>'status' <> 'completed' THEN
    RETURN _result;
  END IF;
  UPDATE public.split_bill_participants
  SET status = 'paid', paid_at = now(), transfer_id = (_result->>'id')::uuid
  WHERE id = _participant_id;
  UPDATE public.split_bills
  SET status = 'completed', updated_at = now()
  WHERE id = _bill.id
    AND NOT EXISTS (
      SELECT 1 FROM public.split_bill_participants
      WHERE bill_id = _bill.id AND status = 'pending' AND is_creator = false
    );
  RETURN _result;
END
$$;
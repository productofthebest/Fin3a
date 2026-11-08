-- Additive international payout ledger foundation.
-- Existing NGN withdrawal tables/functions are intentionally untouched.
-- A route is unusable until an operator records explicit merchant verification.
CREATE TABLE public.flutterwave_payout_route_verifications (
  route_id text PRIMARY KEY CHECK (route_id ~ '^flw:[A-Z]{2}:[A-Z]{3}:(bank|mobile_money)$'),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('bank','mobile_money')),
  provider text NOT NULL DEFAULT 'flutterwave' CHECK (provider = 'flutterwave'),
  merchant_reference text NOT NULL,
  verification_source text NOT NULL,
  verified_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > verified_at),
  CHECK (route_id = 'flw:' || country || ':' || currency || ':' || method)
);
ALTER TABLE public.flutterwave_payout_route_verifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.flutterwave_payout_route_verifications TO authenticated;
GRANT ALL ON public.flutterwave_payout_route_verifications TO service_role;
CREATE POLICY flw_payout_routes_admin_read ON public.flutterwave_payout_route_verifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.international_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  route_id text NOT NULL REFERENCES public.flutterwave_payout_route_verifications(route_id),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('bank','mobile_money')),
  reference text NOT NULL UNIQUE CHECK (reference ~ '^F3W-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  idempotency_key text NOT NULL UNIQUE,
  beneficiary_name text NOT NULL CHECK (length(trim(beneficiary_name)) BETWEEN 2 AND 120),
  beneficiary_account text NOT NULL CHECK (length(trim(beneficiary_account)) BETWEEN 5 AND 64),
  bank_code text,
  bank_name text,
  network text,
  amount numeric(20,2) NOT NULL CHECK (amount > 0 AND amount = round(amount,2)),
  payout numeric(20,2) NOT NULL CHECK (payout = amount),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','review')),
  provider_transfer_id text UNIQUE,
  provider_status text,
  ledger_id uuid NOT NULL REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((method = 'bank' AND bank_code IS NOT NULL AND bank_name IS NOT NULL)
      OR (method = 'mobile_money' AND network IS NOT NULL))
);
ALTER TABLE public.international_withdrawals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.international_withdrawals TO authenticated;
GRANT ALL ON public.international_withdrawals TO service_role;
CREATE POLICY international_withdrawal_owner_read ON public.international_withdrawals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY international_withdrawal_admin_read ON public.international_withdrawals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX international_withdrawals_user_created
  ON public.international_withdrawals(user_id, created_at DESC);
CREATE INDEX international_withdrawals_pending
  ON public.international_withdrawals(status, created_at)
  WHERE status IN ('pending','review');

CREATE TABLE public.flw_international_withdrawal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  withdrawal_id uuid REFERENCES public.international_withdrawals(id),
  reference text NOT NULL,
  provider_transfer_id text NOT NULL,
  provider_status text NOT NULL,
  amount numeric(20,2),
  currency text,
  outcome text NOT NULL CHECK (outcome IN ('pending','successful','failed','review','unknown')),
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flw_international_withdrawal_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.flw_international_withdrawal_events TO authenticated;
GRANT ALL ON public.flw_international_withdrawal_events TO service_role;
CREATE POLICY flw_international_withdrawal_events_admin_read
  ON public.flw_international_withdrawal_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER immutable_flw_international_withdrawal_events
  BEFORE UPDATE OR DELETE ON public.flw_international_withdrawal_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_financial_history_mutation();

-- Only service_role may reserve. The RPC refuses unverified/expired merchant routes.
-- It locks the currency-specific account and writes the pending debit + withdrawal
-- record in one transaction. The existing NGN reservation RPC remains unchanged.
CREATE FUNCTION public.reserve_international_withdrawal(
  _user_id uuid, _idempotency_key text, _country text, _currency text,
  _method text, _amount numeric, _beneficiary_name text, _beneficiary_account text,
  _bank_code text DEFAULT NULL, _bank_name text DEFAULT NULL, _network text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc uuid;
  existing public.international_withdrawals;
  spendable numeric;
  lid uuid;
  ref text;
  route text;
  amt numeric(20,2) := round(_amount,2);
BEGIN
  IF _user_id IS NULL OR _idempotency_key IS NULL OR length(_idempotency_key) NOT BETWEEN 16 AND 128
     OR _country IS NULL OR _country !~ '^[A-Z]{2}
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2)
     OR length(trim(coalesce(_beneficiary_name,''))) NOT BETWEEN 2 AND 120
     OR length(trim(coalesce(_beneficiary_account,''))) NOT BETWEEN 5 AND 64
     OR (_method = 'bank' AND (coalesce(_bank_code,'') = '' OR coalesce(_bank_name,'') = ''))
     OR (_method = 'mobile_money' AND coalesce(_network,'') = '') THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  route := 'flw:' || _country || ':' || _currency || ':' || _method;
  SELECT * INTO existing FROM public.international_withdrawals
    WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing.user_id <> _user_id OR existing.country <> _country
       OR existing.currency <> _currency OR existing.method <> _method
       OR existing.amount <> amt OR existing.beneficiary_name <> trim(_beneficiary_name)
       OR existing.beneficiary_account <> trim(_beneficiary_account)
       OR existing.bank_code IS DISTINCT FROM _bank_code OR existing.bank_name IS DISTINCT FROM _bank_name
       OR existing.network IS DISTINCT FROM _network THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status',existing.status,'reference',existing.reference,'duplicate',true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flutterwave_payout_route_verifications v
    WHERE v.route_id = route AND v.country = _country AND v.currency = _currency
      AND v.method = _method AND v.provider = 'flutterwave' AND v.expires_at > now()
  ) THEN
    RETURN jsonb_build_object('status','route_unverified');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_settings s WHERE s.user_id = _user_id AND s.country = _country
  ) THEN
    RETURN jsonb_build_object('status','country_mismatch');
  END IF;

  SELECT id INTO acc FROM public.accounts
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  IF acc IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;

  SELECT coalesce(sum(
    CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END
  ),0) INTO spendable
  FROM public.account_ledger
  WHERE account_id = acc AND status IN ('completed','pending')
    AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));

  IF spendable < amt THEN
    RETURN jsonb_build_object('status','insufficient','available',spendable);
  END IF;

  ref := 'F3W-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(user_id,account_id,kind,status,amount,currency,reference,provider,provider_ref)
  VALUES (_user_id,acc,'withdrawal','pending',amt,_currency,
    'International withdrawal (' || _country || ')','flutterwave_transfer',ref)
  RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id,account_id,route_id,country,currency,method,reference,idempotency_key,
    beneficiary_name,beneficiary_account,bank_code,bank_name,network,amount,payout,ledger_id
  ) VALUES (
    _user_id,acc,route,_country,_currency,_method,ref,_idempotency_key,
    trim(_beneficiary_name),trim(_beneficiary_account),_bank_code,_bank_name,_network,amt,amt,lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',amt,'currency',_currency);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) TO service_role;

-- Called only after the server independently verifies the transfer with Flutterwave.
-- A timeout or non-final provider status stays pending/reserved; it never triggers a retry.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text, _provider_transfer_id text, _event_key text,
  _provider_status text, _outcome text, _amount numeric, _currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
  final_outcome text;
  ledger_rows integer;
BEGIN
  IF _reference IS NULL OR _reference !~ '^F3W-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR _provider_transfer_id IS NULL OR _provider_transfer_id !~ '^[1-9][0-9]{0,19}$'
     OR _event_key IS NULL OR length(_event_key) NOT BETWEEN 8 AND 200
     OR _provider_status IS NULL OR length(_provider_status) NOT BETWEEN 1 AND 80
     OR _outcome IS NULL OR _outcome NOT IN ('pending','successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified transfer evidence';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('flw-international-payout:' || _provider_transfer_id,0));
  SELECT * INTO w FROM public.international_withdrawals WHERE reference = _reference FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.flw_international_withdrawal_events WHERE event_key = _event_key) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  IF w.id IS NULL THEN
    INSERT INTO public.flw_international_withdrawal_events(
      event_key,reference,provider_transfer_id,provider_status,amount,currency,outcome
    ) VALUES (_event_key,_reference,_provider_transfer_id,_provider_status,_amount,_currency,'unknown');
    RETURN jsonb_build_object('status','unknown');
  END IF;

  IF EXISTS (SELECT 1 FROM public.international_withdrawals
      WHERE provider_transfer_id = _provider_transfer_id AND id <> w.id) THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2) THEN
    UPDATE public.international_withdrawals SET status='review',provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF w.status IN ('successful','failed') THEN
    IF w.status = _outcome THEN final_outcome := w.status;
    ELSE
      UPDATE public.international_withdrawals SET status='review',provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'review';
    END IF;
  ELSIF _outcome = 'pending' THEN
    UPDATE public.international_withdrawals SET provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'pending';
  ELSIF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    GET DIAGNOSTICS ledger_rows = ROW_COUNT;
    IF ledger_rows = 1 THEN
      UPDATE public.international_withdrawals SET status='successful',provider_transfer_id=_provider_transfer_id,
        provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'successful';
    ELSE
      UPDATE public.international_withdrawals SET status='review',provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
        provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'review';
    END IF;
  ELSIF _outcome = 'failed' THEN
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    GET DIAGNOSTICS ledger_rows = ROW_COUNT;
    IF ledger_rows = 1 THEN
      UPDATE public.international_withdrawals SET status='failed',provider_transfer_id=_provider_transfer_id,
        provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'failed';
    ELSE
      UPDATE public.international_withdrawals SET status='review',provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
        provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'review';
    END IF;
  ELSE
    final_outcome := 'review';
  END IF;

  INSERT INTO public.flw_international_withdrawal_events(
    event_key,withdrawal_id,reference,provider_transfer_id,provider_status,amount,currency,outcome
  ) VALUES (_event_key,w.id,_reference,_provider_transfer_id,_provider_status,_amount,_currency,final_outcome);
  RETURN jsonb_build_object('status',final_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) TO service_role;

     OR _currency IS NULL OR _currency !~ '^[A-Z]{3}
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2)
     OR length(trim(coalesce(_beneficiary_name,''))) NOT BETWEEN 2 AND 120
     OR length(trim(coalesce(_beneficiary_account,''))) NOT BETWEEN 5 AND 64
     OR (_method = 'bank' AND (coalesce(_bank_code,'') = '' OR coalesce(_bank_name,'') = ''))
     OR (_method = 'mobile_money' AND coalesce(_network,'') = '') THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  route := 'flw:' || _country || ':' || _currency || ':' || _method;
  SELECT * INTO existing FROM public.international_withdrawals
    WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing.user_id <> _user_id OR existing.country <> _country
       OR existing.currency <> _currency OR existing.method <> _method
       OR existing.amount <> amt OR existing.beneficiary_account <> _beneficiary_account THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status',existing.status,'reference',existing.reference,'duplicate',true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flutterwave_payout_route_verifications v
    WHERE v.route_id = route AND v.country = _country AND v.currency = _currency
      AND v.method = _method AND v.provider = 'flutterwave' AND v.expires_at > now()
  ) THEN
    RETURN jsonb_build_object('status','route_unverified');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_settings s WHERE s.user_id = _user_id AND s.country = _country
  ) THEN
    RETURN jsonb_build_object('status','country_mismatch');
  END IF;

  SELECT id INTO acc FROM public.accounts
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  IF acc IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;

  SELECT coalesce(sum(
    CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END
  ),0) INTO spendable
  FROM public.account_ledger
  WHERE account_id = acc AND status IN ('completed','pending')
    AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));

  IF spendable < amt THEN
    RETURN jsonb_build_object('status','insufficient','available',spendable);
  END IF;

  ref := 'F3W-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(user_id,account_id,kind,status,amount,currency,reference,provider,provider_ref)
  VALUES (_user_id,acc,'withdrawal','pending',amt,_currency,
    'International withdrawal (' || _country || ')','flutterwave_transfer',ref)
  RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id,account_id,route_id,country,currency,method,reference,idempotency_key,
    beneficiary_name,beneficiary_account,bank_code,bank_name,network,amount,payout,ledger_id
  ) VALUES (
    _user_id,acc,route,_country,_currency,_method,ref,_idempotency_key,
    trim(_beneficiary_name),trim(_beneficiary_account),_bank_code,_bank_name,_network,amt,amt,lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',amt,'currency',_currency);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) TO service_role;

-- Called only after the server independently verifies the transfer with Flutterwave.
-- A timeout or non-final provider status stays pending/reserved; it never triggers a retry.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text, _provider_transfer_id text, _event_key text,
  _provider_status text, _outcome text, _amount numeric, _currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
  final_outcome text;
BEGIN
  IF _reference IS NULL OR _reference !~ '^F3W-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR _provider_transfer_id IS NULL OR _provider_transfer_id !~ '^[1-9][0-9]{0,19}$'
     OR _event_key IS NULL OR length(_event_key) NOT BETWEEN 8 AND 200
     OR _provider_status IS NULL OR length(_provider_status) NOT BETWEEN 1 AND 80
     OR _outcome NOT IN ('pending','successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified transfer evidence';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('flw-international-payout:' || _provider_transfer_id,0));
  SELECT * INTO w FROM public.international_withdrawals WHERE reference = _reference FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.flw_international_withdrawal_events WHERE event_key = _event_key) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  IF w.id IS NULL THEN
    INSERT INTO public.flw_international_withdrawal_events(
      event_key,reference,provider_transfer_id,provider_status,amount,currency,outcome
    ) VALUES (_event_key,_reference,_provider_transfer_id,_provider_status,_amount,_currency,'unknown');
    RETURN jsonb_build_object('status','unknown');
  END IF;

  IF EXISTS (SELECT 1 FROM public.international_withdrawals
      WHERE provider_transfer_id = _provider_transfer_id AND id <> w.id) THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2) THEN
    UPDATE public.international_withdrawals SET status='review',provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF w.status IN ('successful','failed') THEN
    IF w.status = _outcome THEN final_outcome := w.status;
    ELSE
      UPDATE public.international_withdrawals SET status='review',provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'review';
    END IF;
  ELSIF _outcome = 'pending' THEN
    UPDATE public.international_withdrawals SET provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'pending';
  ELSIF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    UPDATE public.international_withdrawals SET status='successful',provider_transfer_id=_provider_transfer_id,
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'successful';
  ELSIF _outcome = 'failed' THEN
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    UPDATE public.international_withdrawals SET status='failed',provider_transfer_id=_provider_transfer_id,
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'failed';
  ELSE
    final_outcome := 'review';
  END IF;

  INSERT INTO public.flw_international_withdrawal_events(
    event_key,withdrawal_id,reference,provider_transfer_id,provider_status,amount,currency,outcome
  ) VALUES (_event_key,w.id,_reference,_provider_transfer_id,_provider_status,_amount,_currency,final_outcome);
  RETURN jsonb_build_object('status',final_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) TO service_role;

     OR _method IS NULL OR _method NOT IN ('bank','mobile_money')
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2)
     OR length(trim(coalesce(_beneficiary_name,''))) NOT BETWEEN 2 AND 120
     OR length(trim(coalesce(_beneficiary_account,''))) NOT BETWEEN 5 AND 64
     OR (_method = 'bank' AND (coalesce(_bank_code,'') = '' OR coalesce(_bank_name,'') = ''))
     OR (_method = 'mobile_money' AND coalesce(_network,'') = '') THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  route := 'flw:' || _country || ':' || _currency || ':' || _method;
  SELECT * INTO existing FROM public.international_withdrawals
    WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing.user_id <> _user_id OR existing.country <> _country
       OR existing.currency <> _currency OR existing.method <> _method
       OR existing.amount <> amt OR existing.beneficiary_account <> _beneficiary_account THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status',existing.status,'reference',existing.reference,'duplicate',true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.flutterwave_payout_route_verifications v
    WHERE v.route_id = route AND v.country = _country AND v.currency = _currency
      AND v.method = _method AND v.provider = 'flutterwave' AND v.expires_at > now()
  ) THEN
    RETURN jsonb_build_object('status','route_unverified');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_settings s WHERE s.user_id = _user_id AND s.country = _country
  ) THEN
    RETURN jsonb_build_object('status','country_mismatch');
  END IF;

  SELECT id INTO acc FROM public.accounts
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  IF acc IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;

  SELECT coalesce(sum(
    CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END
  ),0) INTO spendable
  FROM public.account_ledger
  WHERE account_id = acc AND status IN ('completed','pending')
    AND NOT (status = 'pending' AND kind IN ('deposit','transfer_in','swap_in'));

  IF spendable < amt THEN
    RETURN jsonb_build_object('status','insufficient','available',spendable);
  END IF;

  ref := 'F3W-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(user_id,account_id,kind,status,amount,currency,reference,provider,provider_ref)
  VALUES (_user_id,acc,'withdrawal','pending',amt,_currency,
    'International withdrawal (' || _country || ')','flutterwave_transfer',ref)
  RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id,account_id,route_id,country,currency,method,reference,idempotency_key,
    beneficiary_name,beneficiary_account,bank_code,bank_name,network,amount,payout,ledger_id
  ) VALUES (
    _user_id,acc,route,_country,_currency,_method,ref,_idempotency_key,
    trim(_beneficiary_name),trim(_beneficiary_account),_bank_code,_bank_name,_network,amt,amt,lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',amt,'currency',_currency);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,text,text,text,text,numeric,text,text,text,text,text) TO service_role;

-- Called only after the server independently verifies the transfer with Flutterwave.
-- A timeout or non-final provider status stays pending/reserved; it never triggers a retry.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text, _provider_transfer_id text, _event_key text,
  _provider_status text, _outcome text, _amount numeric, _currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
  final_outcome text;
BEGIN
  IF _reference IS NULL OR _reference !~ '^F3W-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR _provider_transfer_id IS NULL OR _provider_transfer_id !~ '^[1-9][0-9]{0,19}$'
     OR _event_key IS NULL OR length(_event_key) NOT BETWEEN 8 AND 200
     OR _provider_status IS NULL OR length(_provider_status) NOT BETWEEN 1 AND 80
     OR _outcome NOT IN ('pending','successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified transfer evidence';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('flw-international-payout:' || _provider_transfer_id,0));
  SELECT * INTO w FROM public.international_withdrawals WHERE reference = _reference FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.flw_international_withdrawal_events WHERE event_key = _event_key) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  IF w.id IS NULL THEN
    INSERT INTO public.flw_international_withdrawal_events(
      event_key,reference,provider_transfer_id,provider_status,amount,currency,outcome
    ) VALUES (_event_key,_reference,_provider_transfer_id,_provider_status,_amount,_currency,'unknown');
    RETURN jsonb_build_object('status','unknown');
  END IF;

  IF EXISTS (SELECT 1 FROM public.international_withdrawals
      WHERE provider_transfer_id = _provider_transfer_id AND id <> w.id) THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2) THEN
    UPDATE public.international_withdrawals SET status='review',provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'review';
  ELSIF w.status IN ('successful','failed') THEN
    IF w.status = _outcome THEN final_outcome := w.status;
    ELSE
      UPDATE public.international_withdrawals SET status='review',provider_status=_provider_status,updated_at=now() WHERE id=w.id;
      final_outcome := 'review';
    END IF;
  ELSIF _outcome = 'pending' THEN
    UPDATE public.international_withdrawals SET provider_transfer_id=coalesce(provider_transfer_id,_provider_transfer_id),
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'pending';
  ELSIF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    UPDATE public.international_withdrawals SET status='successful',provider_transfer_id=_provider_transfer_id,
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'successful';
  ELSIF _outcome = 'failed' THEN
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id AND status='pending';
    UPDATE public.international_withdrawals SET status='failed',provider_transfer_id=_provider_transfer_id,
      provider_status=_provider_status,updated_at=now() WHERE id=w.id;
    final_outcome := 'failed';
  ELSE
    final_outcome := 'review';
  END IF;

  INSERT INTO public.flw_international_withdrawal_events(
    event_key,withdrawal_id,reference,provider_transfer_id,provider_status,amount,currency,outcome
  ) VALUES (_event_key,w.id,_reference,_provider_transfer_id,_provider_status,_amount,_currency,final_outcome);
  RETURN jsonb_build_object('status',final_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,text,text,numeric,text) TO service_role;

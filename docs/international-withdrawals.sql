-- Additive international-only foundation. No existing table, function or row
-- is changed. No opening balances are copied or backfilled. Live gate is OFF.
CREATE TABLE public.international_merchant_routes (
  route_id text PRIMARY KEY CHECK (route_id ~ '^flw:[A-Z]{2}:[A-Z]{3}:(bank|mobile_money)$'),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$' AND country <> 'NG'),
  currency text NOT NULL CHECK (currency IN ('USD','GBP','EUR','GHS','KES','ZAR','UGX','RWF','TZS','XOF','XAF')),
  method text NOT NULL CHECK (method IN ('bank','mobile_money')),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  schema_version text NOT NULL,
  provider_codes text[] NOT NULL,
  evidence_ref text NOT NULL,
  verified_by uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  max_minor bigint NOT NULL CHECK (max_minor > fee_minor AND max_minor <= 1000000000000),
  CHECK (route_id = 'flw:' || country || ':' || currency || ':' || method)
);
GRANT SELECT ON public.international_merchant_routes TO authenticated;
GRANT ALL ON public.international_merchant_routes TO service_role;
ALTER TABLE public.international_merchant_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY international_routes_admin ON public.international_merchant_routes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.international_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  route_id text NOT NULL REFERENCES public.international_merchant_routes(route_id),
  currency text NOT NULL CHECK (currency <> 'NGN'), exponent integer NOT NULL CHECK (exponent IN (0,2)),
  reference text NOT NULL UNIQUE DEFAULT ('F3X-' || gen_random_uuid()::text),
  idempotency_key uuid NOT NULL UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 1000000000000),
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  payout_minor bigint NOT NULL CHECK (payout_minor > 0 AND payout_minor = amount_minor - fee_minor),
  beneficiary jsonb NOT NULL CHECK (jsonb_typeof(beneficiary) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','reversed','review')),
  provider_transfer_id text UNIQUE, review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.international_withdrawals TO authenticated;
GRANT ALL ON public.international_withdrawals TO service_role;
ALTER TABLE public.international_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY international_withdrawal_owner ON public.international_withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY international_withdrawal_admin ON public.international_withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX international_withdrawal_owner_time ON public.international_withdrawals(user_id,created_at DESC);

CREATE TABLE public.international_withdrawal_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), withdrawal_id uuid NOT NULL REFERENCES public.international_withdrawals(id),
  account_id uuid NOT NULL REFERENCES public.accounts(id), user_id uuid NOT NULL,
  currency text NOT NULL CHECK (currency <> 'NGN'),
  kind text NOT NULL CHECK (kind IN ('reservation','release','reversal')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(withdrawal_id,kind)
);
GRANT SELECT ON public.international_withdrawal_ledger TO authenticated;
GRANT ALL ON public.international_withdrawal_ledger TO service_role;
ALTER TABLE public.international_withdrawal_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY international_ledger_owner ON public.international_withdrawal_ledger FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY international_ledger_admin ON public.international_withdrawal_ledger FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));

CREATE TABLE public.international_withdrawal_events (
  event_key text PRIMARY KEY, withdrawal_id uuid NOT NULL REFERENCES public.international_withdrawals(id),
  provider_transfer_id text NOT NULL, outcome text NOT NULL CHECK(outcome IN ('pending','successful','failed','reversed')),
  amount_minor bigint NOT NULL, currency text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.international_withdrawal_events TO authenticated;
GRANT ALL ON public.international_withdrawal_events TO service_role;
ALTER TABLE public.international_withdrawal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY international_events_admin ON public.international_withdrawal_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.international_history_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'International financial history is immutable'; END $$;
CREATE TRIGGER international_ledger_immutable BEFORE UPDATE OR DELETE ON public.international_withdrawal_ledger FOR EACH ROW EXECUTE FUNCTION public.international_history_immutable();
CREATE TRIGGER international_events_immutable BEFORE UPDATE OR DELETE ON public.international_withdrawal_events FOR EACH ROW EXECUTE FUNCTION public.international_history_immutable();
CREATE TRIGGER international_withdrawals_retained BEFORE DELETE ON public.international_withdrawals FOR EACH ROW EXECUTE FUNCTION public.international_history_immutable();

CREATE FUNCTION public.international_payouts_live_enabled() RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION public.international_payouts_live_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.international_payouts_live_enabled() TO service_role;

CREATE FUNCTION public.admin_verify_international_route(_route_id text,_country text,_currency text,_method text,_environment text,_schema_version text,_provider_codes text[],_evidence_ref text,_expires_at timestamptz,_fee_minor bigint,_max_minor bigint,_revoked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.admin_require();
  IF _expires_at <= now() OR _expires_at > now()+interval '90 days' OR length(trim(_evidence_ref)) NOT BETWEEN 3 AND 200
    OR _schema_version <> 'flw-v3-gh-bank-momo-1' OR _country <> 'GH' OR _currency <> 'GHS'
    OR cardinality(_provider_codes) NOT BETWEEN 1 AND 100 OR _environment NOT IN ('sandbox','production') THEN
    RAISE EXCEPTION 'Verified schema and current merchant evidence required';
  END IF;
  INSERT INTO public.international_merchant_routes(route_id,country,currency,method,environment,schema_version,provider_codes,evidence_ref,verified_by,expires_at,fee_minor,max_minor,revoked)
  VALUES(_route_id,_country,_currency,_method,_environment,_schema_version,_provider_codes,trim(_evidence_ref),auth.uid(),_expires_at,_fee_minor,_max_minor,_revoked)
  ON CONFLICT(route_id) DO UPDATE SET environment=excluded.environment,schema_version=excluded.schema_version,provider_codes=excluded.provider_codes,
    evidence_ref=excluded.evidence_ref,verified_by=excluded.verified_by,verified_at=now(),expires_at=excluded.expires_at,fee_minor=excluded.fee_minor,max_minor=excluded.max_minor,revoked=excluded.revoked;
  INSERT INTO public.admin_audit_log(admin_id,action,detail) VALUES(auth.uid(),'international_route_verification',jsonb_build_object('route_id',_route_id,'evidence_ref',_evidence_ref,'environment',_environment,'revoked',_revoked));
END $$;
REVOKE ALL ON FUNCTION public.admin_verify_international_route(text,text,text,text,text,text,text[],text,timestamptz,bigint,bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_international_route(text,text,text,text,text,text,text[],text,timestamptz,bigint,bigint,boolean) TO authenticated;

CREATE FUNCTION public.reserve_international_withdrawal(_user_id uuid,_route_id text,_idempotency_key uuid,_amount_minor bigint,_beneficiary jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; r public.international_merchant_routes; w public.international_withdrawals; exponent integer; opening numeric; reserved numeric;
BEGIN
  IF NOT public.international_payouts_live_enabled() THEN RETURN jsonb_build_object('status','locked'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key::text,913));
  SELECT * INTO w FROM public.international_withdrawals WHERE idempotency_key=_idempotency_key;
  IF FOUND THEN
    IF w.user_id<>_user_id OR w.route_id<>_route_id OR w.amount_minor<>_amount_minor OR w.beneficiary<>_beneficiary THEN RAISE EXCEPTION 'Idempotency conflict'; END IF;
    RETURN jsonb_build_object('status','existing','reference',w.reference);
  END IF;
  SELECT * INTO r FROM public.international_merchant_routes WHERE route_id=_route_id FOR SHARE;
  IF NOT FOUND OR r.revoked OR r.environment<>'production' OR r.verified_at>now() OR r.expires_at<=now() THEN RETURN jsonb_build_object('status','route_unverified'); END IF;
  IF public.account_blocked(_user_id) THEN RETURN jsonb_build_object('status','blocked'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=_user_id AND country=r.country) THEN RETURN jsonb_build_object('status','country_mismatch'); END IF;
  IF _amount_minor IS NULL OR _amount_minor<=r.fee_minor OR _amount_minor>r.max_minor OR jsonb_typeof(_beneficiary)<>'object' THEN RETURN jsonb_build_object('status','invalid'); END IF;
  SELECT id INTO a FROM public.accounts WHERE user_id=_user_id AND currency=r.currency FOR UPDATE;
  IF a IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;
  exponent := CASE WHEN r.currency IN ('UGX','RWF','XOF','XAF') THEN 0 ELSE 2 END;
  SELECT coalesce(sum(CASE WHEN kind IN ('deposit','transfer_in','swap_in') THEN amount ELSE -amount END),0)*power(10,exponent) INTO opening
    FROM public.account_ledger WHERE account_id=a AND currency=r.currency AND status IN ('completed','pending') AND NOT(status='pending' AND kind IN ('deposit','transfer_in','swap_in'));
  SELECT coalesce(sum(CASE WHEN kind='reservation' THEN amount_minor ELSE -amount_minor END),0) INTO reserved FROM public.international_withdrawal_ledger WHERE account_id=a AND currency=r.currency;
  IF opening<>trunc(opening) OR opening-reserved<_amount_minor THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  INSERT INTO public.international_withdrawals(user_id,account_id,route_id,currency,exponent,idempotency_key,amount_minor,fee_minor,payout_minor,beneficiary)
    VALUES(_user_id,a,_route_id,r.currency,exponent,_idempotency_key,_amount_minor,r.fee_minor,_amount_minor-r.fee_minor,_beneficiary) RETURNING * INTO w;
  INSERT INTO public.international_withdrawal_ledger(withdrawal_id,account_id,user_id,currency,kind,amount_minor) VALUES(w.id,a,_user_id,r.currency,'reservation',_amount_minor);
  RETURN jsonb_build_object('status','reserved','reference',w.reference,'payout_minor',w.payout_minor);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,text,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,text,uuid,bigint,jsonb) TO service_role;

CREATE FUNCTION public.finish_international_withdrawal(_reference text,_provider_transfer_id text,_outcome text,_amount_minor bigint,_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.international_withdrawals; e public.international_withdrawal_events; k text;
BEGIN
  SELECT * INTO w FROM public.international_withdrawals WHERE reference=_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;
  IF _provider_transfer_id IS NULL OR _provider_transfer_id !~ '^[1-9][0-9]{0,19}$' OR _outcome NOT IN ('pending','successful','failed','reversed') OR _outcome IS NULL
    OR _amount_minor IS DISTINCT FROM w.payout_minor OR _currency IS DISTINCT FROM w.currency THEN RAISE EXCEPTION 'Verified evidence mismatch'; END IF;
  IF w.provider_transfer_id IS NOT NULL AND w.provider_transfer_id<>_provider_transfer_id THEN RAISE EXCEPTION 'Provider identity mismatch'; END IF;
  k := _provider_transfer_id || ':' || _outcome;
  SELECT * INTO e FROM public.international_withdrawal_events WHERE event_key=k;
  IF FOUND THEN
    IF e.withdrawal_id<>w.id OR e.amount_minor<>_amount_minor OR e.currency<>_currency THEN RAISE EXCEPTION 'Duplicate evidence conflict'; END IF;
    RETURN jsonb_build_object('status',w.status,'duplicate',true);
  END IF;
  UPDATE public.international_withdrawals SET provider_transfer_id=_provider_transfer_id,updated_at=now() WHERE id=w.id;
  INSERT INTO public.international_withdrawal_events(event_key,withdrawal_id,provider_transfer_id,outcome,amount_minor,currency) VALUES(k,w.id,_provider_transfer_id,_outcome,_amount_minor,_currency);
  IF _outcome='pending' OR w.status='review' THEN RETURN jsonb_build_object('status',w.status); END IF;
  IF w.status='pending' AND _outcome='successful' THEN
    UPDATE public.international_withdrawals SET status='successful',updated_at=now() WHERE id=w.id;
  ELSIF w.status='pending' AND _outcome='failed' THEN
    INSERT INTO public.international_withdrawal_ledger(withdrawal_id,account_id,user_id,currency,kind,amount_minor) VALUES(w.id,w.account_id,w.user_id,w.currency,'release',w.amount_minor);
    UPDATE public.international_withdrawals SET status='failed',updated_at=now() WHERE id=w.id;
  ELSIF w.status='successful' AND _outcome='reversed' THEN
    -- Do not automatically restore fees or wallet funds: provider return amount
    -- and charges must be reviewed. The immutable reversal evidence stays here.
    UPDATE public.international_withdrawals SET status='review',review_reason='verified_post_settlement_reversal',updated_at=now() WHERE id=w.id;
  ELSIF w.status<>_outcome THEN
    UPDATE public.international_withdrawals SET status='review',review_reason='contradictory_provider_outcome',updated_at=now() WHERE id=w.id;
  END IF;
  SELECT * INTO w FROM public.international_withdrawals WHERE id=w.id;
  RETURN jsonb_build_object('status',w.status);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,bigint,text) TO service_role;

CREATE FUNCTION public.admin_review_international_reversal(_withdrawal_id uuid,_confirmed_return_minor bigint,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.international_withdrawals;
BEGIN
  PERFORM public.admin_require();
  SELECT * INTO w FROM public.international_withdrawals WHERE id=_withdrawal_id FOR UPDATE;
  IF NOT FOUND OR w.status<>'review' OR w.review_reason<>'verified_post_settlement_reversal' OR _confirmed_return_minor IS DISTINCT FROM w.amount_minor OR length(trim(_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Full provider return including fees must be verified; partial returns require separate review';
  END IF;
  INSERT INTO public.international_withdrawal_ledger(withdrawal_id,account_id,user_id,currency,kind,amount_minor) VALUES(w.id,w.account_id,w.user_id,w.currency,'reversal',_confirmed_return_minor);
  UPDATE public.international_withdrawals SET status='reversed',updated_at=now() WHERE id=w.id;
  INSERT INTO public.admin_audit_log(admin_id,action,target_user_id,detail) VALUES(auth.uid(),'international_reversal_review',w.user_id,jsonb_build_object('withdrawal_id',w.id,'return_minor',_confirmed_return_minor,'reason',_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_review_international_reversal(uuid,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_international_reversal(uuid,bigint,text) TO authenticated;
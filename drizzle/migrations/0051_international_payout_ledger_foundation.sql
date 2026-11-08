-- International payout ledger foundation. No route is enabled by this migration.
-- The NGN withdrawal tables/functions are deliberately untouched.

CREATE TABLE public.flutterwave_payout_route_verifications (
  route_id text PRIMARY KEY CHECK (route_id ~ '^flw:[A-Z]{2}:[A-Z]{3}:(bank|mobile_money)$'),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('bank','mobile_money')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','disabled')),
  verified_by uuid,
  evidence_ref text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (route_id = 'flw:' || country || ':' || currency || ':' || method),
  CHECK (
    status <> 'verified'
    OR (verified_by IS NOT NULL AND length(trim(coalesce(evidence_ref,''))) > 0 AND verified_at IS NOT NULL)
  )
);
ALTER TABLE public.flutterwave_payout_route_verifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.flutterwave_payout_route_verifications TO service_role;
-- No authenticated read/write policy: merchant evidence is server-only.

CREATE TABLE public.international_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  route_id text NOT NULL REFERENCES public.flutterwave_payout_route_verifications(route_id),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('bank','mobile_money')),
  reference text NOT NULL UNIQUE CHECK (reference ~ '^F3X-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  idempotency_key uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  payout numeric(20,2) NOT NULL CHECK (payout > 0 AND payout = amount),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','review')),
  provider_transfer_id text UNIQUE,
  ledger_id uuid NOT NULL REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CHECK (
    (currency IN ('UGX','RWF','XOF','XAF') AND amount = trunc(amount))
    OR (currency NOT IN ('UGX','RWF','XOF','XAF') AND amount = round(amount,2))
  )
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

-- Reserve wallet funds atomically. This function never calls Flutterwave.
CREATE FUNCTION public.reserve_international_withdrawal(
  _user_id uuid,
  _idempotency_key uuid,
  _route_id text,
  _country text,
  _currency text,
  _method text,
  _amount numeric,
  _request_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc uuid;
  existing public.international_withdrawals;
  spendable numeric;
  ref text;
  lid uuid;
  verified public.flutterwave_payout_route_verifications;
  wallet_country text;
BEGIN
  IF _user_id IS NULL OR _idempotency_key IS NULL OR _route_id IS NULL
     OR _country IS NULL OR _currency IS NULL OR _method IS NULL OR _request_fingerprint IS NULL
     OR _country !~ '^[A-Z]{2}
     OR _method NOT IN ('bank','mobile_money')
     OR _route_id <> 'flw:' || _country || ':' || _currency || ':' || _method
     OR _request_fingerprint !~ '^[0-9a-f]{64}$'
     OR _amount IS NULL OR _amount <= 0
     OR (_currency IN ('UGX','RWF','XOF','XAF') AND _amount <> trunc(_amount))
     OR (_currency NOT IN ('UGX','RWF','XOF','XAF') AND _amount <> round(_amount,2)) THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'international-withdrawal:' || _user_id::text || ':' || _idempotency_key::text, 0
  ));

  SELECT * INTO existing FROM public.international_withdrawals
    WHERE user_id = _user_id AND idempotency_key = _idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF existing.request_fingerprint <> _request_fingerprint THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status','existing','reference',existing.reference,'payout',existing.payout,'withdrawal_status',existing.status);
  END IF;

  SELECT country INTO wallet_country FROM public.user_settings WHERE user_id = _user_id;
  IF wallet_country IS DISTINCT FROM _country THEN
    RETURN jsonb_build_object('status','wallet_country_mismatch');
  END IF;

  SELECT * INTO verified FROM public.flutterwave_payout_route_verifications
    WHERE route_id = _route_id AND country = _country AND currency = _currency
      AND method = _method AND status = 'verified'
      AND verified_by IS NOT NULL AND length(trim(coalesce(evidence_ref,''))) > 0
      AND verified_at <= now() AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','route_not_verified');
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

  IF spendable < _amount THEN RETURN jsonb_build_object('status','insufficient'); END IF;

  ref := 'F3X-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(
    user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref
  ) VALUES (
    _user_id, acc, 'withdrawal', 'pending', _amount, _currency,
    'International withdrawal', 'flutterwave_transfer', ref
  ) RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id, account_id, route_id, country, currency, method, reference,
    idempotency_key, request_fingerprint, amount, payout, ledger_id
  ) VALUES (
    _user_id, acc, _route_id, _country, _currency, _method, ref,
    _idempotency_key, _request_fingerprint, _amount, _amount, lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',_amount);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  TO service_role;

-- Only a server-side, provider-verified final status may complete or release the reservation.
-- Pending/unknown results remain reserved. Mismatches go to review without changing the ledger.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text,
  _provider_transfer_id text,
  _outcome text,
  _amount numeric,
  _currency text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
BEGIN
  SELECT * INTO w FROM public.international_withdrawals
    WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;

  IF _provider_transfer_id IS NOT NULL THEN
    IF _provider_transfer_id !~ '^[1-9][0-9]{0,19}$' THEN
      RAISE EXCEPTION 'Invalid provider transfer id';
    END IF;
    IF w.provider_transfer_id IS NOT NULL AND w.provider_transfer_id <> _provider_transfer_id THEN
      UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
      RETURN jsonb_build_object('status','review');
    END IF;
    IF w.provider_transfer_id IS NULL THEN
      UPDATE public.international_withdrawals
        SET provider_transfer_id=_provider_transfer_id,updated_at=now() WHERE id=w.id;
    END IF;
  END IF;

  IF _outcome = 'pending' THEN
    RETURN jsonb_build_object('status',w.status);
  END IF;
  IF _outcome NOT IN ('successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified withdrawal outcome';
  END IF;

  IF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF w.status = _outcome THEN RETURN jsonb_build_object('status',w.status); END IF;
  IF w.status <> 'pending' THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='successful',updated_at=now() WHERE id=w.id;
  ELSE
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='failed',updated_at=now() WHERE id=w.id;
  END IF;

  RETURN jsonb_build_object('status',_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  TO service_role;

-- Restore the pre-0050 withdrawal/bank-resolution buckets while retaining the
-- international preflight bucket. Add a separate bucket for payout creation.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN (
    'recipient_lookup',
    'internal_transfer',
    'qr_request_create',
    'qr_resolve',
    'qr_pay',
    'qr_scan_log',
    'ngn_topup',
    'ngn_withdrawal',
    'bank_resolve',
    'international_payout_preflight',
    'international_withdrawal'
  ) OR _limit < 1 OR _limit > 500 OR _window_seconds < 60 OR _window_seconds > 86400 THEN
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
 OR _currency !~ '^[A-Z]{3}
     OR _method NOT IN ('bank','mobile_money')
     OR _route_id <> 'flw:' || _country || ':' || _currency || ':' || _method
     OR _request_fingerprint !~ '^[0-9a-f]{64}$'
     OR _amount IS NULL OR _amount <= 0
     OR (_currency IN ('UGX','RWF','XOF','XAF') AND _amount <> trunc(_amount))
     OR (_currency NOT IN ('UGX','RWF','XOF','XAF') AND _amount <> round(_amount,2)) THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'international-withdrawal:' || _user_id::text || ':' || _idempotency_key::text, 0
  ));

  SELECT * INTO existing FROM public.international_withdrawals
    WHERE user_id = _user_id AND idempotency_key = _idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF existing.request_fingerprint <> _request_fingerprint THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status','existing','reference',existing.reference,'payout',existing.payout,'withdrawal_status',existing.status);
  END IF;

  SELECT country INTO wallet_country FROM public.user_settings WHERE user_id = _user_id;
  IF wallet_country IS DISTINCT FROM _country THEN
    RETURN jsonb_build_object('status','wallet_country_mismatch');
  END IF;

  SELECT * INTO verified FROM public.flutterwave_payout_route_verifications
    WHERE route_id = _route_id AND country = _country AND currency = _currency
      AND method = _method AND status = 'verified'
      AND verified_by IS NOT NULL AND length(trim(coalesce(evidence_ref,''))) > 0
      AND verified_at <= now() AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','route_not_verified');
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

  IF spendable < _amount THEN RETURN jsonb_build_object('status','insufficient'); END IF;

  ref := 'F3X-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(
    user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref
  ) VALUES (
    _user_id, acc, 'withdrawal', 'pending', _amount, _currency,
    'International withdrawal', 'flutterwave_transfer', ref
  ) RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id, account_id, route_id, country, currency, method, reference,
    idempotency_key, request_fingerprint, amount, payout, ledger_id
  ) VALUES (
    _user_id, acc, _route_id, _country, _currency, _method, ref,
    _idempotency_key, _request_fingerprint, _amount, _amount, lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',_amount);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  TO service_role;

-- Only a server-side, provider-verified final status may complete or release the reservation.
-- Pending/unknown results remain reserved. Mismatches go to review without changing the ledger.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text,
  _provider_transfer_id text,
  _outcome text,
  _amount numeric,
  _currency text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
BEGIN
  SELECT * INTO w FROM public.international_withdrawals
    WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;

  IF _provider_transfer_id IS NOT NULL THEN
    IF _provider_transfer_id !~ '^[1-9][0-9]{0,19}$' THEN
      RAISE EXCEPTION 'Invalid provider transfer id';
    END IF;
    IF w.provider_transfer_id IS NOT NULL AND w.provider_transfer_id <> _provider_transfer_id THEN
      UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
      RETURN jsonb_build_object('status','review');
    END IF;
    IF w.provider_transfer_id IS NULL THEN
      UPDATE public.international_withdrawals
        SET provider_transfer_id=_provider_transfer_id,updated_at=now() WHERE id=w.id;
    END IF;
  END IF;

  IF _outcome = 'pending' THEN
    RETURN jsonb_build_object('status',w.status);
  END IF;
  IF _outcome NOT IN ('successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified withdrawal outcome';
  END IF;

  IF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF w.status = _outcome THEN RETURN jsonb_build_object('status',w.status); END IF;
  IF w.status <> 'pending' THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='successful',updated_at=now() WHERE id=w.id;
  ELSE
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='failed',updated_at=now() WHERE id=w.id;
  END IF;

  RETURN jsonb_build_object('status',_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  TO service_role;

-- Restore the pre-0050 withdrawal/bank-resolution buckets while retaining the
-- international preflight bucket. Add a separate bucket for payout creation.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN (
    'recipient_lookup',
    'internal_transfer',
    'qr_request_create',
    'qr_resolve',
    'qr_pay',
    'qr_scan_log',
    'ngn_topup',
    'ngn_withdrawal',
    'bank_resolve',
    'international_payout_preflight',
    'international_withdrawal'
  ) OR _limit < 1 OR _limit > 500 OR _window_seconds < 60 OR _window_seconds > 86400 THEN
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

     OR _method NOT IN ('bank','mobile_money')
     OR _route_id <> 'flw:' || _country || ':' || _currency || ':' || _method
     OR _request_fingerprint !~ '^[0-9a-f]{64}$'
     OR _amount IS NULL OR _amount <= 0
     OR (_currency IN ('UGX','RWF','XOF','XAF') AND _amount <> trunc(_amount))
     OR (_currency NOT IN ('UGX','RWF','XOF','XAF') AND _amount <> round(_amount,2)) THEN
    RAISE EXCEPTION 'Invalid international withdrawal request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'international-withdrawal:' || _user_id::text || ':' || _idempotency_key::text, 0
  ));

  SELECT * INTO existing FROM public.international_withdrawals
    WHERE user_id = _user_id AND idempotency_key = _idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF existing.request_fingerprint <> _request_fingerprint THEN
      RAISE EXCEPTION 'Idempotency conflict';
    END IF;
    RETURN jsonb_build_object('status','existing','reference',existing.reference,'payout',existing.payout,'withdrawal_status',existing.status);
  END IF;

  SELECT country INTO wallet_country FROM public.user_settings WHERE user_id = _user_id;
  IF wallet_country IS DISTINCT FROM _country THEN
    RETURN jsonb_build_object('status','wallet_country_mismatch');
  END IF;

  SELECT * INTO verified FROM public.flutterwave_payout_route_verifications
    WHERE route_id = _route_id AND country = _country AND currency = _currency
      AND method = _method AND status = 'verified'
      AND verified_by IS NOT NULL AND length(trim(coalesce(evidence_ref,''))) > 0
      AND verified_at <= now() AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','route_not_verified');
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

  IF spendable < _amount THEN RETURN jsonb_build_object('status','insufficient'); END IF;

  ref := 'F3X-' || gen_random_uuid()::text;
  INSERT INTO public.account_ledger(
    user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref
  ) VALUES (
    _user_id, acc, 'withdrawal', 'pending', _amount, _currency,
    'International withdrawal', 'flutterwave_transfer', ref
  ) RETURNING id INTO lid;

  INSERT INTO public.international_withdrawals(
    user_id, account_id, route_id, country, currency, method, reference,
    idempotency_key, request_fingerprint, amount, payout, ledger_id
  ) VALUES (
    _user_id, acc, _route_id, _country, _currency, _method, ref,
    _idempotency_key, _request_fingerprint, _amount, _amount, lid
  );

  RETURN jsonb_build_object('status','reserved','reference',ref,'payout',_amount);
END $$;
REVOKE ALL ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_international_withdrawal(uuid,uuid,text,text,text,text,numeric,text)
  TO service_role;

-- Only a server-side, provider-verified final status may complete or release the reservation.
-- Pending/unknown results remain reserved. Mismatches go to review without changing the ledger.
CREATE FUNCTION public.finish_international_withdrawal(
  _reference text,
  _provider_transfer_id text,
  _outcome text,
  _amount numeric,
  _currency text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.international_withdrawals;
BEGIN
  SELECT * INTO w FROM public.international_withdrawals
    WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;

  IF _provider_transfer_id IS NOT NULL THEN
    IF _provider_transfer_id !~ '^[1-9][0-9]{0,19}$' THEN
      RAISE EXCEPTION 'Invalid provider transfer id';
    END IF;
    IF w.provider_transfer_id IS NOT NULL AND w.provider_transfer_id <> _provider_transfer_id THEN
      UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
      RETURN jsonb_build_object('status','review');
    END IF;
    IF w.provider_transfer_id IS NULL THEN
      UPDATE public.international_withdrawals
        SET provider_transfer_id=_provider_transfer_id,updated_at=now() WHERE id=w.id;
    END IF;
  END IF;

  IF _outcome = 'pending' THEN
    RETURN jsonb_build_object('status',w.status);
  END IF;
  IF _outcome NOT IN ('successful','failed') THEN
    RAISE EXCEPTION 'Invalid verified withdrawal outcome';
  END IF;

  IF _currency IS DISTINCT FROM w.currency OR _amount IS DISTINCT FROM w.payout THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF w.status = _outcome THEN RETURN jsonb_build_object('status',w.status); END IF;
  IF w.status <> 'pending' THEN
    UPDATE public.international_withdrawals SET status='review',updated_at=now() WHERE id=w.id;
    RETURN jsonb_build_object('status','review');
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.account_ledger SET status='completed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='successful',updated_at=now() WHERE id=w.id;
  ELSE
    UPDATE public.account_ledger SET status='failed',updated_at=now() WHERE id=w.ledger_id;
    UPDATE public.international_withdrawals SET status='failed',updated_at=now() WHERE id=w.id;
  END IF;

  RETURN jsonb_build_object('status',_outcome);
END $$;
REVOKE ALL ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_international_withdrawal(text,text,text,numeric,text)
  TO service_role;

-- Restore the pre-0050 withdrawal/bank-resolution buckets while retaining the
-- international preflight bucket. Add a separate bucket for payout creation.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN (
    'recipient_lookup',
    'internal_transfer',
    'qr_request_create',
    'qr_resolve',
    'qr_pay',
    'qr_scan_log',
    'ngn_topup',
    'ngn_withdrawal',
    'bank_resolve',
    'international_payout_preflight',
    'international_withdrawal'
  ) OR _limit < 1 OR _limit > 500 OR _window_seconds < 60 OR _window_seconds > 86400 THEN
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

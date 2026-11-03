-- consume_ai_quota only accepts AI buckets; payments get their own limiter.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _start timestamptz;
  _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN ('recipient_lookup','internal_transfer') OR _limit < 1 OR _limit > 500
     OR _window_seconds < 60 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate limit request';
  END IF;
  _start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.ai_usage_counters AS c (user_id, bucket, window_start, used)
  VALUES (_uid, _bucket, _start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET used = c.used + 1 WHERE c.used < _limit
  RETURNING 1 INTO _ok;
  DELETE FROM public.ai_usage_counters WHERE user_id = _uid AND window_start < now() - interval '2 days';
  RETURN _ok IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_internal(
  _to_user uuid, _currency text, _amount numeric, _idempotency_key text, _reference text DEFAULT NULL
) RETURNS uuid
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

CREATE OR REPLACE FUNCTION public.lookup_recipient(_identifier text)
RETURNS TABLE(user_id uuid, display_name text, fin3a_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id text;
  _digits text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.consume_rate_limit('recipient_lookup', 20, 3600) THEN
    RAISE EXCEPTION 'Too many lookups; try again later';
  END IF;
  _id := btrim(_identifier);
  IF _id ILIKE 'FIN-%' THEN
    RETURN QUERY
      SELECT s.user_id, s.display_name, s.fin3a_id
      FROM public.user_settings s
      WHERE s.fin3a_id = upper(_id) AND s.user_id <> auth.uid();
  ELSIF position('@' IN _id) > 0 THEN
    RETURN QUERY
      SELECT u.id, s.display_name, s.fin3a_id
      FROM auth.users u
      LEFT JOIN public.user_settings s ON s.user_id = u.id
      WHERE lower(u.email) = lower(_id) AND u.id <> auth.uid();
  ELSE
    _digits := regexp_replace(_id, '[^0-9]', '', 'g');
    IF _digits LIKE '0%' AND length(_digits) = 11 THEN
      _digits := '234' || substr(_digits, 2);
    END IF;
    RETURN QUERY
      SELECT p.user_id, s.display_name, s.fin3a_id
      FROM public.phone_identities p
      LEFT JOIN public.user_settings s ON s.user_id = p.user_id
      WHERE (regexp_replace(p.phone, '[^0-9]', '', 'g') = _digits
        OR regexp_replace(p.phone, '[^0-9]', '', 'g') = '234' || _digits)
        AND p.user_id <> auth.uid();
  END IF;
END
$$;
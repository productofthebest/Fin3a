-- ai_usage_counters has a bucket CHECK limited to AI features, so payment rate
-- limits get their own table (only the security definer limiter touches it).
CREATE TABLE public.rate_limit_counters (
  user_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);
GRANT ALL ON public.rate_limit_counters TO service_role;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

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
  INSERT INTO public.rate_limit_counters AS c (user_id, bucket, window_start, used)
  VALUES (_uid, _bucket, _start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET used = c.used + 1 WHERE c.used < _limit
  RETURNING 1 INTO _ok;
  DELETE FROM public.rate_limit_counters WHERE user_id = _uid AND window_start < now() - interval '2 days';
  RETURN _ok IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO authenticated;
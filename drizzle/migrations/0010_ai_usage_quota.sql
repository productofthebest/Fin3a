CREATE TABLE public.ai_usage_counters (
  user_id uuid NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('landing_chat','transcribe')),
  window_start timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (user_id, bucket, window_start)
);
GRANT ALL ON public.ai_usage_counters TO service_role;
ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(_bucket text, _limit integer, _window_seconds integer)
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
  IF _bucket NOT IN ('landing_chat','transcribe') OR _limit < 1 OR _limit > 500
     OR _window_seconds < 60 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid quota request';
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
REVOKE ALL ON FUNCTION public.consume_ai_quota(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) TO authenticated;
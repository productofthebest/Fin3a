CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket text, _limit integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _ok integer;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _bucket NOT IN ('recipient_lookup','internal_transfer','qr_request_create','qr_resolve','qr_pay','qr_scan_log','ngn_topup')
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
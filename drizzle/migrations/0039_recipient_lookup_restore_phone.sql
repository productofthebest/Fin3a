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
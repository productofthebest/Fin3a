CREATE OR REPLACE FUNCTION public.lookup_recipient(_identifier text)
RETURNS TABLE(user_id uuid, display_name text, fin3a_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id text;
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
  END IF;
END
$$;
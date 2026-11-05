CREATE OR REPLACE FUNCTION public.admin_user_country(_user_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN (SELECT coalesce(country, 'NG') FROM public.user_settings WHERE user_id = _user_id LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.admin_user_country(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_country(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_user_currency_ledger(_user_id uuid, _currency text)
RETURNS TABLE(kind text, status text, amount numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT l.kind::text, l.status::text, l.amount::numeric FROM public.account_ledger l WHERE l.user_id = _user_id AND l.currency = upper(_currency);
END $$;
REVOKE ALL ON FUNCTION public.admin_user_currency_ledger(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_currency_ledger(uuid, text) TO authenticated;
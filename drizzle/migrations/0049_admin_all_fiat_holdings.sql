-- Show every fiat currency a user actually holds in Admin → Users.
-- Balances are derived from the immutable wallet ledger; this does not create
-- accounts, move funds, change preferred currency, or alter payment flows.

CREATE OR REPLACE FUNCTION public.admin_list_user_fiat_balances(_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _balances jsonb;
  _result jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.admin_require();

  FOREACH _user_id IN ARRAY COALESCE(_user_ids, ARRAY[]::uuid[]) LOOP
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'currency', c.currency,
          'available', public.admin_balance(_user_id, c.currency, true),
          'with_pending', public.admin_balance(_user_id, c.currency, false)
        ) ORDER BY c.currency
      ),
      '[]'::jsonb
    )
    INTO _balances
    FROM (
      SELECT a.currency
      FROM public.accounts a
      WHERE a.user_id = _user_id
      UNION
      SELECT l.currency
      FROM public.account_ledger l
      WHERE l.user_id = _user_id
        AND l.status IN ('completed', 'pending')
    ) c
    WHERE c.currency ~ '^[A-Z]{3}$'
      AND public.admin_balance(_user_id, c.currency, false) <> 0;

    _result := _result || jsonb_build_object(_user_id::text, _balances);
  END LOOP;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_fiat_balances(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_user_fiat_balances(uuid[]) TO authenticated;

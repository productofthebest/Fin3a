-- The split_bills and split_bill_participants SELECT policies referenced each other,
-- causing infinite recursion. Break the cycle with a security definer membership check
-- that bypasses RLS on the participants table.
CREATE OR REPLACE FUNCTION public.is_split_participant(_bill_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.split_bill_participants
    WHERE bill_id = _bill_id AND user_id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_split_participant(uuid, uuid) FROM PUBLIC, anon;

DROP POLICY "Creators and participants read bills" ON public.split_bills;
CREATE POLICY "Creators and participants read bills" ON public.split_bills
  FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR public.is_split_participant(id, auth.uid()));
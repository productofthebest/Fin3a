-- Lets bill creators and participants see each other's display names and Fin3a IDs
-- without widening user_settings read access.
CREATE OR REPLACE FUNCTION public.split_participant_directory(_bill_id uuid)
RETURNS TABLE(user_id uuid, display_name text, fin3a_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.split_bills b
    WHERE b.id = _bill_id AND (
      b.creator_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.split_bill_participants p WHERE p.bill_id = b.id AND p.user_id = auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
    SELECT p.user_id, s.display_name, s.fin3a_id
    FROM public.split_bill_participants p
    LEFT JOIN public.user_settings s ON s.user_id = p.user_id
    WHERE p.bill_id = _bill_id;
END
$$;
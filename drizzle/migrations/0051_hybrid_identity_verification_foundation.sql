-- Hybrid KYC foundation. Additive only: no payout gate is changed and no
-- existing user name is promoted to verified identity.
CREATE TABLE public.identity_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Verification evidence is removed with its owning account. Do not block
  -- account deletion because an identity-verification event exists.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (length(trim(provider)) BETWEEN 2 AND 80),
  provider_reference text NOT NULL CHECK (length(trim(provider_reference)) BETWEEN 3 AND 200),
  provider_event_id text NOT NULL CHECK (length(trim(provider_event_id)) BETWEEN 3 AND 200),
  status text NOT NULL CHECK (status IN ('pending','verified','rejected','expired')),
  legal_name text,
  legal_name_normalized text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id),
  CHECK (
    (status = 'verified' AND legal_name IS NOT NULL AND length(trim(legal_name)) BETWEEN 2 AND 160
      AND legal_name_normalized IS NOT NULL AND length(trim(legal_name_normalized)) BETWEEN 2 AND 160
      AND verified_at IS NOT NULL)
    OR
    (status <> 'verified' AND legal_name IS NULL AND legal_name_normalized IS NULL AND verified_at IS NULL)
  )
);
CREATE INDEX identity_verification_user_latest ON public.identity_verification_events(user_id, created_at DESC);
CREATE INDEX identity_verification_user_verified ON public.identity_verification_events(user_id, verified_at DESC) WHERE status = 'verified';
ALTER TABLE public.identity_verification_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.identity_verification_events TO authenticated;
GRANT SELECT, INSERT ON public.identity_verification_events TO service_role;
CREATE POLICY identity_verification_owner_read ON public.identity_verification_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.identity_verification_event_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Identity verification events cannot be updated'; END $$;
-- Events cannot be edited. Account deletion may cascade-delete its associated
-- verification evidence under the platform's approved retention/deletion policy.
CREATE TRIGGER identity_verification_events_no_update BEFORE UPDATE ON public.identity_verification_events FOR EACH ROW EXECUTE FUNCTION public.identity_verification_event_immutable();
COMMENT ON TABLE public.identity_verification_events IS 'Append-only trusted KYC provider outcomes while the account exists; deleted with its auth.users owner. Never populate from editable user_settings.display_name.';

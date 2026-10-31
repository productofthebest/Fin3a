CREATE TABLE public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signin','signup','link')),
  user_id uuid,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  ip text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_otps_phone_created_idx ON public.phone_otps (phone, created_at DESC);
CREATE INDEX phone_otps_ip_created_idx ON public.phone_otps (ip, created_at DESC);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.phone_identities (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.phone_identities TO authenticated;
GRANT ALL ON public.phone_identities TO service_role;
ALTER TABLE public.phone_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phone identity" ON public.phone_identities FOR SELECT TO authenticated USING (auth.uid() = user_id);
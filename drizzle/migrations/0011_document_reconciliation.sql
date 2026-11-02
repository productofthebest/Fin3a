ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reconciliation jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS page_count integer CHECK (page_count IS NULL OR page_count > 0);
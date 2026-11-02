ALTER TABLE public.transaction_drafts ADD COLUMN IF NOT EXISTS duplicate_confidence text;
ALTER TABLE public.transaction_drafts ADD COLUMN IF NOT EXISTS duplicate_reason text;
ALTER TABLE public.transaction_drafts ADD COLUMN IF NOT EXISTS confirmed_separate boolean NOT NULL DEFAULT false;
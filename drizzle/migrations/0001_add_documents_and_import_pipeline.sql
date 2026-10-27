CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'uploaded',
  fingerprint text NOT NULL,
  error_message text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transaction_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  txn_date date,
  description text,
  merchant text,
  amount numeric,
  currency text,
  type text NOT NULL DEFAULT 'expense',
  reference text,
  payment_method text,
  category_hint text,
  confidence text NOT NULL DEFAULT 'medium',
  duplicate_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN reference text,
  ADD COLUMN payment_method text,
  ADD COLUMN currency text;

COMMENT ON COLUMN public.transactions.source IS 'manual = entered by the user; document = imported from an uploaded document after review';

CREATE INDEX documents_user_idx ON public.documents(user_id, created_at DESC);
CREATE INDEX documents_user_fingerprint_idx ON public.documents(user_id, fingerprint);
CREATE INDEX drafts_user_status_idx ON public.transaction_drafts(user_id, status);
CREATE INDEX drafts_document_idx ON public.transaction_drafts(document_id);
CREATE INDEX transactions_source_document_idx ON public.transactions(source_document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_drafts TO authenticated;
GRANT ALL ON public.transaction_drafts TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents"
  ON public.documents FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own transaction drafts"
  ON public.transaction_drafts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.import_document_drafts(p_document_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_count integer;
BEGIN
  SELECT user_id INTO v_user FROM public.documents WHERE id = p_document_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  WITH inserted AS (
    INSERT INTO public.transactions
      (user_id, type, amount, category_id, description, merchant, occurred_at, status, source, source_document_id, reference, payment_method)
    SELECT
      d.user_id,
      CASE WHEN d.type IN ('income','expense') THEN d.type ELSE 'expense' END,
      d.amount,
      NULL,
      d.description,
      d.merchant,
      COALESCE(d.txn_date, CURRENT_DATE),
      'completed',
      'document',
      d.document_id,
      d.reference,
      d.payment_method
    FROM public.transaction_drafts d
    WHERE d.document_id = p_document_id
      AND d.status = 'pending'
      AND d.amount IS NOT NULL
      AND d.amount > 0
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM inserted;

  UPDATE public.transaction_drafts
  SET status = 'confirmed'
  WHERE document_id = p_document_id AND status = 'pending';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_document_drafts(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.import_document_drafts(uuid) TO service_role;
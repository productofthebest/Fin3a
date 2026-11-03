CREATE OR REPLACE FUNCTION public.import_document_drafts(p_document_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid:=auth.uid(); d record; r record; n integer:=0; v_id uuid; v_key text; v_cat uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 SELECT * INTO d FROM public.documents WHERE id=p_document_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE='42501'; END IF;
 IF d.status='processing' THEN RAISE EXCEPTION 'Wait for document scanning to finish'; END IF;
 FOR r IN SELECT * FROM public.transaction_drafts WHERE document_id=p_document_id AND user_id=v_user AND status='pending' ORDER BY id FOR UPDATE LOOP
  IF r.imported_transaction_id IS NOT NULL THEN CONTINUE; END IF;
  IF NOT r.review_confirmed OR r.txn_date IS NULL OR r.txn_date>(now() AT TIME ZONE 'UTC')::date OR r.amount IS NULL OR r.amount<=0 OR r.amount::text IN ('NaN','Infinity','-Infinity') OR r.currency IS NULL OR r.currency !~ '^[A-Z]{3}$' OR r.type NOT IN ('income','expense') THEN CONTINUE; END IF;
  IF r.duplicate_of IS NOT NULL THEN CONTINUE; END IF;
  v_key:=md5(concat_ws('|',upper(r.currency),r.type,r.txn_date::text,trim(to_char(r.amount,'FM999999999999999999999999999990.999999')),lower(coalesce(nullif(trim(r.reference),''),nullif(trim(r.merchant),''),nullif(trim(r.description),''),''))));
  IF r.confirmed_separate THEN
   v_key:=v_key||'#draft:'||r.id::text;
  ELSE
   SELECT t.id INTO v_id FROM public.transactions t WHERE t.user_id=v_user AND t.currency=r.currency AND t.type=r.type AND t.occurred_at=r.txn_date AND t.amount=r.amount AND (
    t.import_identity=v_key OR (nullif(trim(r.reference),'') IS NOT NULL AND lower(trim(t.reference))=lower(trim(r.reference))) OR
    (nullif(trim(r.reference),'') IS NULL AND nullif(trim(r.merchant),'') IS NOT NULL AND lower(trim(t.merchant))=lower(trim(r.merchant)))
   ) ORDER BY t.id LIMIT 1;
   IF v_id IS NOT NULL THEN UPDATE public.transaction_drafts SET duplicate_of=v_id,review_confirmed=false WHERE id=r.id; CONTINUE; END IF;
  END IF;
  v_cat:=NULL;
  SELECT c.id INTO v_cat FROM public.categories c WHERE c.user_id=v_user AND c.kind=r.type AND lower(trim(c.name))=lower(trim(r.category_hint)) ORDER BY c.id LIMIT 1;
  INSERT INTO public.transactions(user_id,type,amount,category_id,description,merchant,occurred_at,status,source,source_document_id,reference,payment_method,currency,classification,import_identity)
  VALUES(v_user,r.type,r.amount,v_cat,r.description,r.merchant,r.txn_date,'completed','document',p_document_id,r.reference,r.payment_method,r.currency,r.classification,v_key)
  ON CONFLICT(user_id,import_identity) WHERE import_identity IS NOT NULL DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN UPDATE public.transaction_drafts SET status='confirmed',imported_transaction_id=v_id WHERE id=r.id; n:=n+1; END IF;
 END LOOP;
 UPDATE public.documents SET status=CASE WHEN EXISTS(SELECT 1 FROM public.transaction_drafts WHERE document_id=p_document_id AND user_id=v_user AND status='pending') THEN 'extracted' ELSE 'imported' END WHERE id=p_document_id AND user_id=v_user;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.import_document_drafts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_document_drafts(uuid) TO authenticated;
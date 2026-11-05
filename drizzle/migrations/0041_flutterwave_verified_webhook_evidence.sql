ALTER TABLE public.ngn_topup_requests ADD COLUMN provider_state text CHECK (provider_state IN ('pending','failed','successful','refunded','partial_refund')), ADD COLUMN review_state text NOT NULL DEFAULT 'none' CHECK (review_state IN ('none','required')), ADD COLUMN review_reason text, ADD COLUMN verified_currency text, ADD COLUMN verified_amount numeric(20,2), ADD COLUMN verified_charged_amount numeric(20,2), ADD COLUMN verified_app_fee numeric(20,2), ADD COLUMN verified_merchant_fee numeric(20,2), ADD COLUMN provider_created_at timestamptz, ADD COLUMN provider_verified_at timestamptz;
CREATE TABLE public.flw_webhook_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE, request_id uuid REFERENCES public.ngn_topup_requests(id), event_kind text NOT NULL CHECK(event_kind IN ('charge','refund')), provider_tx_id text NOT NULL, provider_refund_id text, provider_status text NOT NULL, amount numeric(20,2), currency text, outcome text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.flw_webhook_events TO authenticated; GRANT ALL ON public.flw_webhook_events TO service_role; ALTER TABLE public.flw_webhook_events ENABLE ROW LEVEL SECURITY; CREATE POLICY flw_events_admin_read ON public.flw_webhook_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TRIGGER immutable_flw_events BEFORE UPDATE OR DELETE ON public.flw_webhook_events FOR EACH ROW EXECUTE FUNCTION public.reject_financial_history_mutation();
CREATE TABLE public.flw_topup_refunds (provider_refund_id text PRIMARY KEY, request_id uuid NOT NULL REFERENCES public.ngn_topup_requests(id), provider_tx_id text NOT NULL, amount numeric(20,2) NOT NULL CHECK(amount > 0), provider_status text NOT NULL, refund_state text NOT NULL CHECK(refund_state IN ('pending','failed','settled','unknown')), review_state text NOT NULL DEFAULT 'required' CHECK(review_state='required'), provider_created_at timestamptz, verified_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.flw_topup_refunds TO authenticated; GRANT ALL ON public.flw_topup_refunds TO service_role; ALTER TABLE public.flw_topup_refunds ENABLE ROW LEVEL SECURITY; CREATE POLICY flw_refunds_admin_read ON public.flw_topup_refunds FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
COMMENT ON TABLE public.flw_topup_refunds IS 'Verified provider refund evidence only. Admin review required; never debits wallet or changes original ledger/fee/revenue.';
CREATE OR REPLACE FUNCTION public.credit_ngn_topup(_tx_ref text,_provider_tx_id text,_amount_paid numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ngn_topup_requests; net numeric(20,2); lid uuid; sid uuid;
BEGIN
 IF _provider_tx_id IS NULL OR _provider_tx_id !~ '^[1-9][0-9]{0,19}$' THEN RAISE EXCEPTION 'Invalid provider identity'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('flw-charge:'||_provider_tx_id,0));
 SELECT * INTO r FROM public.ngn_topup_requests WHERE tx_ref=_tx_ref FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;
 IF r.status='credited' THEN
  IF r.provider_tx_id IS DISTINCT FROM _provider_tx_id OR r.amount_paid IS DISTINCT FROM _amount_paid THEN UPDATE public.ngn_topup_requests SET review_state='required',review_reason='credited_identity_mismatch' WHERE id=r.id; RETURN jsonb_build_object('status','review'); END IF;
  RETURN jsonb_build_object('status','credited','credited',r.credited_amount);
 END IF;
 IF r.status<>'awaiting' OR r.review_state='required' THEN RETURN jsonb_build_object('status','review'); END IF;
 IF _amount_paid IS NULL OR _amount_paid<>r.requested_amount OR _amount_paid<>round(_amount_paid,2) OR NOT EXISTS(SELECT 1 FROM public.accounts WHERE id=r.account_id AND user_id=r.user_id AND currency='NGN') OR EXISTS(SELECT 1 FROM public.ngn_topup_requests WHERE provider_tx_id=_provider_tx_id AND id<>r.id) OR EXISTS(SELECT 1 FROM public.account_ledger WHERE provider='flutterwave' AND provider_ref=_provider_tx_id) THEN
  UPDATE public.ngn_topup_requests SET review_state='required',review_reason='amount_or_identity_mismatch',updated_at=now() WHERE id=r.id; RETURN jsonb_build_object('status','review');
 END IF;
 net := r.requested_amount-r.fin3a_fee;
 IF net<=0 THEN UPDATE public.ngn_topup_requests SET review_state='required',review_reason='nonpositive_net' WHERE id=r.id; RETURN jsonb_build_object('status','review'); END IF;
 INSERT INTO public.account_ledger(user_id,account_id,kind,status,amount,currency,reference,provider,provider_ref) VALUES(r.user_id,r.account_id,'deposit','completed',net,'NGN','NGN bank top-up','flutterwave',_provider_tx_id) RETURNING id INTO lid;
 INSERT INTO public.payment_fee_snapshots(user_id,account_id,ledger_id,service,currency,original_amount,quoted_payout,rate_state,fee_version_id,fee_rate_bps,fin3a_fee,provider_charge,network_charge,final_amount,provider,provider_reference,idempotency_key) VALUES(r.user_id,r.account_id,lid,'ngn_deposit','NGN',r.requested_amount,r.requested_amount,'confirmed',r.fee_version_id,0,r.fin3a_fee,0,0,net,'flutterwave',_provider_tx_id,'ngn_topup:'||r.tx_ref) RETURNING id INTO sid;
 IF r.fin3a_fee>0 THEN INSERT INTO public.revenue_events(snapshot_id,event_kind,fin3a_fee,provider_event_reference,verified_at,occurred_at) VALUES(sid,'earned',r.fin3a_fee,'flutterwave:'||_provider_tx_id,now(),coalesce(r.provider_created_at,now())); END IF;
 UPDATE public.ngn_topup_requests SET status='credited',provider_tx_id=_provider_tx_id,amount_paid=_amount_paid,credited_amount=net,ledger_id=lid,updated_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('status','credited','credited',net);
END $$;
REVOKE ALL ON FUNCTION public.credit_ngn_topup(text,text,numeric) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.credit_ngn_topup(text,text,numeric) TO service_role;
CREATE FUNCTION public.apply_flw_topup_evidence(_tx_ref text,_provider_tx_id text,_notice_tx_id text,_currency text,_amount numeric,_status text,_charged_amount numeric,_app_fee numeric,_merchant_fee numeric,_provider_date timestamptz,_reference_matches boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ngn_topup_requests; k text; result jsonb; outcome text; state text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('flw-charge:'||_provider_tx_id,0));
 SELECT * INTO r FROM public.ngn_topup_requests WHERE tx_ref=_tx_ref FOR UPDATE;
 k := 'charge:'||_provider_tx_id||':'||md5(concat_ws('|',_tx_ref,_notice_tx_id,_currency,_amount,_status,_reference_matches));
 IF EXISTS(SELECT 1 FROM public.flw_webhook_events WHERE event_key=k) THEN RETURN jsonb_build_object('status','duplicate'); END IF;
 state := CASE WHEN _status='successful' THEN 'successful' WHEN _status IN ('failed','cancelled') THEN 'failed' ELSE 'pending' END;
 IF r.id IS NULL THEN outcome:='unknown';
 ELSIF NOT coalesce(_reference_matches,false) OR _provider_tx_id IS DISTINCT FROM _notice_tx_id OR _currency IS DISTINCT FROM 'NGN' OR _amount IS DISTINCT FROM r.requested_amount OR _amount<>round(_amount,2) OR (r.provider_tx_id IS NOT NULL AND r.provider_tx_id<>_provider_tx_id) THEN
  outcome:='review'; UPDATE public.ngn_topup_requests SET review_state='required',review_reason='verified_payment_mismatch',updated_at=now() WHERE id=r.id;
 ELSE
  UPDATE public.ngn_topup_requests SET provider_state=CASE WHEN provider_state IN ('refunded','partial_refund') THEN provider_state WHEN status='credited' THEN coalesce(provider_state,'successful') ELSE state END,verified_currency=_currency,verified_amount=_amount,verified_charged_amount=_charged_amount,verified_app_fee=_app_fee,verified_merchant_fee=_merchant_fee,provider_created_at=_provider_date,provider_verified_at=now() WHERE id=r.id;
  IF _status='successful' THEN result:=public.credit_ngn_topup(_tx_ref,_provider_tx_id,_amount); outcome:=result->>'status'; ELSE outcome:=state; END IF;
 END IF;
 INSERT INTO public.flw_webhook_events(event_key,request_id,event_kind,provider_tx_id,provider_status,amount,currency,outcome) VALUES(k,r.id,'charge',_provider_tx_id,_status,_amount,_currency,outcome);
 RETURN coalesce(result,jsonb_build_object('status',outcome));
END $$;
REVOKE ALL ON FUNCTION public.apply_flw_topup_evidence(text,text,text,text,numeric,text,numeric,numeric,numeric,timestamptz,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_flw_topup_evidence(text,text,text,text,numeric,text,numeric,numeric,numeric,timestamptz,boolean) TO service_role;
CREATE FUNCTION public.record_flw_topup_refund(_refund_id text,_tx_ref text,_provider_tx_id text,_amount numeric,_refund_status text,_refund_state text,_provider_date timestamptz,_charge_amount numeric,_charge_currency text,_charge_status text,_matches boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ngn_topup_requests; k text; outcome text; total numeric; existing public.flw_topup_refunds;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('flw-refund:'||_refund_id,0));
 SELECT * INTO r FROM public.ngn_topup_requests WHERE tx_ref=_tx_ref FOR UPDATE;
 k:='refund:'||_refund_id||':'||md5(concat_ws('|',_provider_tx_id,_amount,_refund_status,_refund_state,_matches));
 IF EXISTS(SELECT 1 FROM public.flw_webhook_events WHERE event_key=k) THEN RETURN jsonb_build_object('status','duplicate'); END IF;
 SELECT * INTO existing FROM public.flw_topup_refunds WHERE provider_refund_id=_refund_id;
 IF r.id IS NULL THEN outcome:='unknown';
 ELSIF NOT coalesce(_matches,false) OR _charge_status<>'successful' OR _charge_currency<>'NGN' OR _charge_amount IS DISTINCT FROM r.requested_amount OR r.status<>'credited' OR r.provider_tx_id IS DISTINCT FROM _provider_tx_id OR _amount IS NULL OR _amount<=0 OR _amount>r.amount_paid OR _amount<>round(_amount,2) OR (existing.request_id IS NOT NULL AND (existing.request_id<>r.id OR existing.amount<>_amount OR existing.provider_tx_id<>_provider_tx_id)) THEN
  outcome:='review_mismatch'; UPDATE public.ngn_topup_requests SET review_state='required',review_reason='verified_refund_mismatch' WHERE id=r.id;
 ELSE
  SELECT coalesce(sum(amount),0) INTO total FROM public.flw_topup_refunds WHERE request_id=r.id AND refund_state='settled' AND provider_refund_id<>_refund_id;
  IF _refund_state='settled' AND total+_amount>r.amount_paid THEN outcome:='review_mismatch'; ELSE
   INSERT INTO public.flw_topup_refunds(provider_refund_id,request_id,provider_tx_id,amount,provider_status,refund_state,provider_created_at) VALUES(_refund_id,r.id,_provider_tx_id,_amount,_refund_status,_refund_state,_provider_date) ON CONFLICT(provider_refund_id) DO UPDATE SET provider_status=CASE WHEN flw_topup_refunds.refund_state='settled' THEN flw_topup_refunds.provider_status ELSE EXCLUDED.provider_status END,refund_state=CASE WHEN flw_topup_refunds.refund_state='settled' THEN 'settled' ELSE EXCLUDED.refund_state END,verified_at=now();
   SELECT coalesce(sum(amount),0) INTO total FROM public.flw_topup_refunds WHERE request_id=r.id AND refund_state='settled';
   UPDATE public.ngn_topup_requests SET provider_state=CASE WHEN total>=r.amount_paid THEN 'refunded' WHEN total>0 THEN 'partial_refund' ELSE coalesce(provider_state,'successful') END WHERE id=r.id;
   outcome:='review';
  END IF;
  UPDATE public.ngn_topup_requests SET review_state='required',review_reason='refund_admin_review',updated_at=now() WHERE id=r.id;
 END IF;
 INSERT INTO public.flw_webhook_events(event_key,request_id,event_kind,provider_tx_id,provider_refund_id,provider_status,amount,currency,outcome) VALUES(k,r.id,'refund',_provider_tx_id,_refund_id,_refund_status,_amount,_charge_currency,outcome);
 RETURN jsonb_build_object('status',outcome);
END $$;
REVOKE ALL ON FUNCTION public.record_flw_topup_refund(text,text,text,numeric,text,text,timestamptz,numeric,text,text,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.record_flw_topup_refund(text,text,text,numeric,text,text,timestamptz,numeric,text,text,boolean) TO service_role;
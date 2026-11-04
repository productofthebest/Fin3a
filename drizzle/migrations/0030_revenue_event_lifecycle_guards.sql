CREATE FUNCTION public.validate_revenue_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q public.payment_fee_snapshots; parent public.revenue_events; earned public.revenue_events; refund_fee numeric; refund_commission numeric; refund_charge numeric; refund_network numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('revenue:' || NEW.snapshot_id::text,0));
 SELECT * INTO q FROM public.payment_fee_snapshots WHERE id=NEW.snapshot_id;
 IF q.service IN ('crypto_deposit','bill_payment') AND NEW.fin3a_fee <> 0 THEN RAISE EXCEPTION 'Free service cannot earn Fin3a fees'; END IF;
 IF NEW.event_kind IN ('earned','pending') AND NEW.fin3a_fee <> q.fin3a_fee THEN RAISE EXCEPTION 'Fee does not match immutable quote'; END IF;
 IF NEW.event_kind='earned' THEN
  IF q.rate_state <> 'confirmed' THEN RAISE EXCEPTION 'Confirmed provider quote required'; END IF;
  IF EXISTS(SELECT 1 FROM public.revenue_events WHERE snapshot_id=NEW.snapshot_id AND event_kind='failed') THEN RAISE EXCEPTION 'Failed transaction cannot earn revenue'; END IF;
  IF NEW.provider_charge<>q.provider_charge OR NEW.network_charge<>q.network_charge THEN RAISE EXCEPTION 'Charges do not match quote'; END IF;
 END IF;
 IF NEW.event_kind='failed' AND EXISTS(SELECT 1 FROM public.revenue_events WHERE snapshot_id=NEW.snapshot_id AND event_kind='earned') THEN RAISE EXCEPTION 'Earned transaction needs a reversal'; END IF;
 IF NEW.related_event_id IS NOT NULL THEN
  SELECT * INTO parent FROM public.revenue_events WHERE id=NEW.related_event_id;
  IF parent.id IS NULL OR parent.snapshot_id<>NEW.snapshot_id OR parent.event_kind<>'earned' THEN RAISE EXCEPTION 'Adjustment must reference the same earned transaction'; END IF;
 END IF;
 SELECT * INTO earned FROM public.revenue_events WHERE snapshot_id=NEW.snapshot_id AND event_kind='earned';
 IF NEW.event_kind='settled' THEN
  IF earned.id IS NULL OR NEW.fin3a_fee<>earned.fin3a_fee OR NEW.provider_commission<>earned.provider_commission OR NEW.provider_charge<>earned.provider_charge OR NEW.network_charge<>earned.network_charge THEN RAISE EXCEPTION 'Settlement must match earned transaction'; END IF;
 END IF;
 IF NEW.event_kind IN ('refund','reversal') THEN
  SELECT coalesce(sum(fin3a_fee),0),coalesce(sum(provider_commission),0),coalesce(sum(provider_charge),0),coalesce(sum(network_charge),0) INTO refund_fee,refund_commission,refund_charge,refund_network FROM public.revenue_events WHERE snapshot_id=NEW.snapshot_id AND event_kind IN ('refund','reversal');
  IF refund_fee+NEW.fin3a_fee>parent.fin3a_fee OR refund_commission+NEW.provider_commission>parent.provider_commission OR refund_charge+NEW.provider_charge>parent.provider_charge OR refund_network+NEW.network_charge>parent.network_charge THEN RAISE EXCEPTION 'Reversal exceeds earned amounts'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_revenue_lifecycle BEFORE INSERT ON public.revenue_events FOR EACH ROW EXECUTE FUNCTION public.validate_revenue_lifecycle();
CREATE OR REPLACE FUNCTION public.validate_fee_snapshot_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND user_id=NEW.user_id AND currency=NEW.currency) THEN RAISE EXCEPTION 'Account mismatch'; END IF;
 IF NEW.ledger_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.account_ledger WHERE id=NEW.ledger_id AND user_id=NEW.user_id AND account_id=NEW.account_id AND currency=NEW.currency) THEN RAISE EXCEPTION 'Ledger mismatch'; END IF;
 IF NEW.service='crypto_deposit' AND (NEW.receiving_currency IS NULL OR NEW.receiving_currency<>NEW.currency) THEN RAISE EXCEPTION 'Deposit receiving currency required'; END IF;
 RETURN NEW; END $$;
CREATE FUNCTION public.admin_internal_payment_usage(_from timestamptz,_to timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF _from IS NULL OR _to IS NULL OR _from>=_to THEN RAISE EXCEPTION 'Invalid period'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('service',service,'currency',currency,'count',count,'volume',volume::text)),'[]'::jsonb) FROM (
 SELECT CASE WHEN EXISTS (SELECT 1 FROM public.qr_payment_requests q WHERE q.transfer_id=t.id) THEN 'QR payments' WHEN EXISTS (SELECT 1 FROM public.split_bill_participants p WHERE p.transfer_id=t.id) THEN 'Bill Split' WHEN t.idempotency_key LIKE 'share-bill:%' THEN 'Share Payment' ELSE 'Internal transfers' END service, currency,count(*) count,sum(amount) volume FROM public.internal_transfers t WHERE status='completed' AND created_at>=_from AND created_at<_to GROUP BY 1,2
 ) s);
END $$;
REVOKE ALL ON FUNCTION public.admin_internal_payment_usage(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_internal_payment_usage(timestamptz,timestamptz) TO authenticated;
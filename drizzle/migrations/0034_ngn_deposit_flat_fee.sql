ALTER TABLE public.fee_versions DROP CONSTRAINT fee_versions_service_check;
ALTER TABLE public.fee_versions ADD CONSTRAINT fee_versions_service_check CHECK (service IN ('crypto_deposit','crypto_sell','crypto_withdrawal','crypto_swap','ngn_withdrawal','ngn_deposit'));
ALTER TABLE public.fee_versions DROP CONSTRAINT fee_versions_check;
ALTER TABLE public.fee_versions ADD CONSTRAINT fee_versions_check CHECK ((service IN ('ngn_withdrawal','ngn_deposit') AND rate_bps = 0 AND high_rate_bps = 0) OR (service NOT IN ('ngn_withdrawal','ngn_deposit') AND flat_ngn = 0));
ALTER TABLE public.payment_fee_snapshots DROP CONSTRAINT payment_fee_snapshots_service_check;
ALTER TABLE public.payment_fee_snapshots ADD CONSTRAINT payment_fee_snapshots_service_check CHECK (service IN ('crypto_deposit','crypto_sell','crypto_withdrawal','crypto_swap','ngn_withdrawal','ngn_deposit','bill_payment'));
ALTER TABLE public.payment_fee_snapshots ADD CONSTRAINT payment_fee_snapshots_ngn_deposit CHECK (service <> 'ngn_deposit' OR (currency = 'NGN' AND fee_rate_bps = 0));
CREATE OR REPLACE FUNCTION public.current_fee_schedule() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_agg(jsonb_build_object('service', d.service, 'id', v.id, 'rate_bps', coalesce(v.rate_bps,d.rate_bps), 'high_rate_bps',coalesce(v.high_rate_bps,d.high_rate_bps), 'threshold_usd',5000, 'flat_ngn',coalesce(v.flat_ngn,d.flat_ngn),'created_at',v.created_at))
 FROM (VALUES ('crypto_deposit',100,50,0::numeric),('crypto_withdrawal',100,50,0::numeric),('crypto_swap',10,10,0::numeric),('ngn_withdrawal',0,0,50::numeric),('ngn_deposit',0,0,50::numeric)) d(service,rate_bps,high_rate_bps,flat_ngn)
 LEFT JOIN LATERAL (SELECT * FROM public.fee_versions f WHERE f.service = d.service ORDER BY created_at DESC,id DESC LIMIT 1) v ON true;
$$;
ALTER TABLE public.fee_versions DROP CONSTRAINT fee_versions_service_check;
ALTER TABLE public.fee_versions ADD CONSTRAINT fee_versions_service_check CHECK (service IN ('crypto_deposit','crypto_sell','crypto_withdrawal','crypto_swap','ngn_withdrawal'));
ALTER TABLE public.payment_fee_snapshots DROP CONSTRAINT payment_fee_snapshots_check1;
ALTER TABLE public.payment_fee_snapshots ADD CONSTRAINT payment_fee_snapshots_bill_free CHECK (service <> 'bill_payment' OR (fin3a_fee = 0 AND fee_rate_bps = 0));
ALTER TABLE public.payment_fee_snapshots ADD CONSTRAINT payment_fee_snapshots_deposit_valued CHECK (service <> 'crypto_deposit' OR fin3a_fee = 0 OR usd_value IS NOT NULL);
CREATE OR REPLACE FUNCTION public.current_fee_schedule() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_agg(jsonb_build_object('service', d.service, 'id', v.id, 'rate_bps', coalesce(v.rate_bps,d.rate_bps), 'high_rate_bps',coalesce(v.high_rate_bps,d.high_rate_bps), 'threshold_usd',5000, 'flat_ngn',coalesce(v.flat_ngn,d.flat_ngn),'created_at',v.created_at))
 FROM (VALUES ('crypto_deposit',100,50,0::numeric),('crypto_withdrawal',100,50,0::numeric),('crypto_swap',10,10,0::numeric),('ngn_withdrawal',0,0,50::numeric)) d(service,rate_bps,high_rate_bps,flat_ngn)
 LEFT JOIN LATERAL (SELECT * FROM public.fee_versions f WHERE f.service = d.service ORDER BY created_at DESC,id DESC LIMIT 1) v ON true;
$$;
CREATE OR REPLACE FUNCTION public.admin_change_fee_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.service = 'crypto_sell' THEN RAISE EXCEPTION 'Crypto selling is retired; deposits convert directly'; END IF; RETURN NEW; END $$;
CREATE TRIGGER retired_crypto_sell_fee BEFORE INSERT ON public.fee_versions FOR EACH ROW EXECUTE FUNCTION public.admin_change_fee_guard();
COMMENT ON CONSTRAINT fee_versions_service_check ON public.fee_versions IS 'crypto_sell is DEPRECATED: retired Nov 2026, deposits convert directly to NGN/USD with a crypto_deposit conversion fee';
CREATE TABLE public.fee_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service text NOT NULL CHECK (service IN ('crypto_sell','crypto_withdrawal','crypto_swap','ngn_withdrawal')),
 rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000), high_rate_bps integer NOT NULL CHECK (high_rate_bps BETWEEN 0 AND 10000), threshold_usd numeric(20,2) NOT NULL DEFAULT 5000 CHECK (threshold_usd = 5000), flat_ngn numeric(20,2) NOT NULL DEFAULT 0 CHECK (flat_ngn >= 0 AND flat_ngn <= 1000000),
 changed_by uuid NOT NULL, previous_id uuid REFERENCES public.fee_versions(id), change_key uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((service = 'ngn_withdrawal' AND rate_bps = 0 AND high_rate_bps = 0) OR (service <> 'ngn_withdrawal' AND flat_ngn = 0)), CHECK (service <> 'crypto_swap' OR rate_bps = high_rate_bps)
);
GRANT SELECT ON public.fee_versions TO authenticated;
GRANT ALL ON public.fee_versions TO service_role;
ALTER TABLE public.fee_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_versions_admin_read ON public.fee_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX fee_versions_current ON public.fee_versions(service, created_at DESC, id);
CREATE FUNCTION public.reject_financial_history_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Financial history is append-only'; END $$;
CREATE TRIGGER immutable_fee_versions BEFORE UPDATE OR DELETE ON public.fee_versions FOR EACH ROW EXECUTE FUNCTION public.reject_financial_history_mutation();
CREATE FUNCTION public.current_fee_schedule() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_agg(jsonb_build_object('service', d.service, 'id', v.id, 'rate_bps', coalesce(v.rate_bps,d.rate_bps), 'high_rate_bps',coalesce(v.high_rate_bps,d.high_rate_bps), 'threshold_usd',5000, 'flat_ngn',coalesce(v.flat_ngn,d.flat_ngn),'created_at',v.created_at))
 FROM (VALUES ('crypto_sell',100,50,0::numeric),('crypto_withdrawal',100,50,0::numeric),('crypto_swap',10,10,0::numeric),('ngn_withdrawal',0,0,50::numeric)) d(service,rate_bps,high_rate_bps,flat_ngn)
 LEFT JOIN LATERAL (SELECT * FROM public.fee_versions f WHERE f.service = d.service ORDER BY created_at DESC,id DESC LIMIT 1) v ON true;
$$;
REVOKE ALL ON FUNCTION public.current_fee_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_fee_schedule() TO authenticated, service_role;
CREATE FUNCTION public.admin_change_fee(_service text,_rate_bps integer,_high_rate_bps integer,_flat_ngn numeric,_expected_id uuid,_change_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fin3a-fee:' || _service,0));
 SELECT id INTO new_id FROM public.fee_versions WHERE change_key = _change_key AND changed_by = auth.uid() AND service = _service;
 IF new_id IS NOT NULL THEN RETURN new_id; END IF;
 SELECT id INTO old_id FROM public.fee_versions WHERE service = _service ORDER BY created_at DESC,id DESC LIMIT 1;
 IF old_id IS DISTINCT FROM _expected_id THEN RAISE EXCEPTION 'Fee changed. Refresh before saving'; END IF;
 INSERT INTO public.fee_versions(service,rate_bps,high_rate_bps,flat_ngn,changed_by,previous_id,change_key) VALUES (_service,_rate_bps,_high_rate_bps,_flat_ngn,auth.uid(),old_id,_change_key) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_change_fee(text,integer,integer,numeric,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_change_fee(text,integer,integer,numeric,uuid,uuid) TO authenticated;
CREATE TABLE public.payment_fee_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, account_id uuid NOT NULL REFERENCES public.accounts(id), ledger_id uuid REFERENCES public.account_ledger(id),
 service text NOT NULL CHECK (service IN ('crypto_deposit','crypto_sell','crypto_withdrawal','crypto_swap','ngn_withdrawal','bill_payment')),
 asset text, network text, currency text NOT NULL CHECK (currency IN ('NGN','USD')), receiving_currency text CHECK (receiving_currency IN ('NGN','USD')), original_amount numeric(30,12) NOT NULL CHECK(original_amount > 0), quoted_payout numeric(20,2) NOT NULL CHECK(quoted_payout > 0), usd_value numeric(20,2) CHECK(usd_value > 0), provider_rate numeric(30,12) CHECK(provider_rate > 0), rate_state text NOT NULL CHECK(rate_state IN ('indicative','confirmed')), quote_expires_at timestamptz,
 fee_version_id uuid REFERENCES public.fee_versions(id), fee_rate_bps integer NOT NULL CHECK(fee_rate_bps BETWEEN 0 AND 10000), fin3a_fee numeric(20,2) NOT NULL CHECK(fin3a_fee >= 0), provider_charge numeric(20,2) NOT NULL CHECK(provider_charge >= 0), network_charge numeric(20,2) NOT NULL CHECK(network_charge >= 0), final_amount numeric(20,2) NOT NULL CHECK(final_amount > 0), commission_included boolean NOT NULL DEFAULT false,
 provider text NOT NULL, provider_reference text NOT NULL, blockchain_hash text, idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_reference),
 CHECK(final_amount = quoted_payout - fin3a_fee - provider_charge - network_charge),
 CHECK(service NOT IN ('crypto_deposit','bill_payment') OR (fin3a_fee = 0 AND fee_rate_bps = 0)),
 CHECK(service NOT IN ('crypto_sell','crypto_withdrawal','crypto_swap') OR (asset IN ('USDT','USDC') AND asset IS NOT NULL AND usd_value IS NOT NULL)),
 CHECK(service <> 'crypto_deposit' OR receiving_currency = currency), CHECK(service <> 'ngn_withdrawal' OR (currency = 'NGN' AND fee_rate_bps = 0))
);
GRANT SELECT ON public.payment_fee_snapshots TO authenticated;
GRANT ALL ON public.payment_fee_snapshots TO service_role;
ALTER TABLE public.payment_fee_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_snapshot_owner_read ON public.payment_fee_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY fee_snapshot_admin_read ON public.payment_fee_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER immutable_payment_quotes BEFORE UPDATE OR DELETE ON public.payment_fee_snapshots FOR EACH ROW EXECUTE FUNCTION public.reject_financial_history_mutation();
CREATE FUNCTION public.validate_fee_snapshot_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND user_id=NEW.user_id AND currency=NEW.currency) THEN RAISE EXCEPTION 'Account mismatch'; END IF;
 IF NEW.ledger_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.account_ledger WHERE id=NEW.ledger_id AND user_id=NEW.user_id AND account_id=NEW.account_id AND currency=NEW.currency) THEN RAISE EXCEPTION 'Ledger mismatch'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER validate_payment_quote BEFORE INSERT ON public.payment_fee_snapshots FOR EACH ROW EXECUTE FUNCTION public.validate_fee_snapshot_owner();
CREATE TABLE public.revenue_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), snapshot_id uuid NOT NULL REFERENCES public.payment_fee_snapshots(id),
 event_kind text NOT NULL CHECK(event_kind IN ('pending','failed','earned','settled','refund','reversal','commission_estimate','commission_adjustment')),
 fin3a_fee numeric(20,2) NOT NULL DEFAULT 0 CHECK(fin3a_fee >= 0), provider_commission numeric(20,2) NOT NULL DEFAULT 0 CHECK(provider_commission >= 0), provider_charge numeric(20,2) NOT NULL DEFAULT 0 CHECK(provider_charge >= 0), network_charge numeric(20,2) NOT NULL DEFAULT 0 CHECK(network_charge >= 0),
 provider_event_reference text NOT NULL UNIQUE, related_event_id uuid REFERENCES public.revenue_events(id), verified_at timestamptz, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(event_kind NOT IN ('earned','settled','refund','reversal','commission_adjustment') OR verified_at IS NOT NULL),
 CHECK(event_kind NOT IN ('refund','reversal','commission_adjustment') OR related_event_id IS NOT NULL),
 CHECK(event_kind <> 'failed' OR (fin3a_fee = 0 AND provider_commission = 0 AND provider_charge = 0 AND network_charge = 0))
);
GRANT SELECT ON public.revenue_events TO authenticated;
GRANT ALL ON public.revenue_events TO service_role;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY revenue_admin_read ON public.revenue_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER immutable_revenue_events BEFORE UPDATE OR DELETE ON public.revenue_events FOR EACH ROW EXECUTE FUNCTION public.reject_financial_history_mutation();
CREATE INDEX revenue_events_period ON public.revenue_events(occurred_at,id);
CREATE UNIQUE INDEX single_payment_lifecycle_event ON public.revenue_events(snapshot_id,event_kind) WHERE event_kind IN ('pending','failed','earned','settled');
COMMENT ON TABLE public.payment_fee_snapshots IS 'Immutable verified-provider quote and fee foundation; provider writing and automatic ledger crediting remain disabled pending funded sandbox integration.';
COMMENT ON TABLE public.revenue_events IS 'Append-only revenue evidence, not wallet funds; trusted provider writers must verify lifecycle, cumulative reversal bounds and reconciliation before activation.';
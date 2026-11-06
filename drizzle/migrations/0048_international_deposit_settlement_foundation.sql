-- International card/local-rail deposits are separate from the existing NGN virtual-account flow.
CREATE TABLE public.international_deposit_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  tx_ref text NOT NULL UNIQUE CHECK (tx_ref ~ '^F3I-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  requested_amount numeric(20,2) NOT NULL CHECK (requested_amount > 0 AND requested_amount = round(requested_amount,2)),
  status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','credited','review','expired')),
  provider_tx_id text UNIQUE,
  ledger_id uuid REFERENCES public.account_ledger(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
ALTER TABLE public.international_deposit_intents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.international_deposit_intents TO authenticated;
GRANT ALL ON public.international_deposit_intents TO service_role;
CREATE POLICY international_deposit_owner_read ON public.international_deposit_intents
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY international_deposit_admin_read ON public.international_deposit_intents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX international_deposit_user_created ON public.international_deposit_intents(user_id,created_at DESC);

CREATE TABLE public.flw_international_deposit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  intent_id uuid REFERENCES public.international_deposit_intents(id),
  provider_tx_id text NOT NULL,
  tx_ref text NOT NULL,
  provider_status text NOT NULL,
  amount numeric(20,2),
  currency text,
  outcome text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flw_international_deposit_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.flw_international_deposit_events TO authenticated;
GRANT ALL ON public.flw_international_deposit_events TO service_role;
CREATE POLICY flw_international_events_admin_read ON public.flw_international_deposit_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER immutable_flw_international_events BEFORE UPDATE OR DELETE
  ON public.flw_international_deposit_events FOR EACH ROW
  EXECUTE FUNCTION public.reject_financial_history_mutation();

-- This RPC is only executable by service_role after server-side provider verification.
-- It locks the intent and writes the ledger credit in the same database transaction.
CREATE FUNCTION public.apply_flw_international_deposit(
  _tx_ref text, _provider_tx_id text, _currency text, _amount numeric,
  _provider_status text, _reference_matches boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.international_deposit_intents; lid uuid; k text; outcome text;
BEGIN
  IF _provider_tx_id IS NULL OR _provider_tx_id !~ '^[1-9][0-9]{0,19}$'
     OR _currency IS NULL OR _currency !~ '^[A-Z]{3}$'
     OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount,2) THEN
    RAISE EXCEPTION 'Invalid verified payment evidence';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('flw-international:' || _provider_tx_id,0));
  SELECT * INTO r FROM public.international_deposit_intents WHERE tx_ref=_tx_ref FOR UPDATE;
  k := 'international-charge:' || _provider_tx_id;
  IF EXISTS (SELECT 1 FROM public.flw_international_deposit_events WHERE event_key=k) THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;
  IF r.id IS NULL THEN
    outcome := 'unknown';
  ELSIF r.status='credited' THEN
    IF r.provider_tx_id IS DISTINCT FROM _provider_tx_id THEN
      UPDATE public.international_deposit_intents SET status='review',updated_at=now() WHERE id=r.id;
      outcome := 'review';
    ELSE
      outcome := 'credited';
    END IF;
  ELSIF r.status <> 'awaiting' OR r.expires_at <= now()
     OR _provider_status <> 'successful'
     OR NOT coalesce(_reference_matches,false)
     OR _currency IS DISTINCT FROM r.currency
     OR _amount IS DISTINCT FROM r.requested_amount
     OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id=r.account_id AND a.user_id=r.user_id AND a.currency=r.currency)
     OR EXISTS (SELECT 1 FROM public.account_ledger l WHERE l.provider='flutterwave' AND l.provider_ref=_provider_tx_id)
     OR EXISTS (SELECT 1 FROM public.international_deposit_intents i WHERE i.provider_tx_id=_provider_tx_id AND i.id<>r.id) THEN
    UPDATE public.international_deposit_intents SET status='review',provider_tx_id=coalesce(provider_tx_id,_provider_tx_id),updated_at=now() WHERE id=r.id;
    outcome := 'review';
  ELSE
    INSERT INTO public.account_ledger(user_id,account_id,kind,status,amount,currency,reference,provider,provider_ref)
    VALUES(r.user_id,r.account_id,'deposit','completed',r.requested_amount,r.currency,
      'International wallet deposit','flutterwave',_provider_tx_id)
    RETURNING id INTO lid;
    UPDATE public.international_deposit_intents
      SET status='credited',provider_tx_id=_provider_tx_id,ledger_id=lid,updated_at=now()
      WHERE id=r.id;
    outcome := 'credited';
  END IF;
  INSERT INTO public.flw_international_deposit_events(event_key,intent_id,provider_tx_id,tx_ref,provider_status,amount,currency,outcome)
  VALUES(k,r.id,_provider_tx_id,_tx_ref,_provider_status,_amount,_currency,outcome);
  RETURN jsonb_build_object('status',outcome);
END $$;
REVOKE ALL ON FUNCTION public.apply_flw_international_deposit(text,text,text,numeric,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_flw_international_deposit(text,text,text,numeric,text,boolean) TO service_role;

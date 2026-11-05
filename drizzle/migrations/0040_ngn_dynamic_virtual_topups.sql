CREATE TABLE public.ngn_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  tx_ref text NOT NULL UNIQUE,
  requested_amount numeric(20,2) NOT NULL CHECK (requested_amount >= 100 AND requested_amount <= 5000000),
  fin3a_fee numeric(20,2) NOT NULL CHECK (fin3a_fee >= 0),
  fee_version_id uuid REFERENCES public.fee_versions(id),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','credited','rejected')),
  provider_tx_id text UNIQUE,
  amount_paid numeric(20,2),
  credited_amount numeric(20,2),
  ledger_id uuid REFERENCES public.account_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ngn_topup_requests TO authenticated;
GRANT ALL ON public.ngn_topup_requests TO service_role;
ALTER TABLE public.ngn_topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ngn_topup_owner_read ON public.ngn_topup_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ngn_topup_admin_read ON public.ngn_topup_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ngn_topup_user ON public.ngn_topup_requests(user_id, created_at DESC);

-- Called only by the server after re-verifying the payment with Flutterwave.
CREATE FUNCTION public.credit_ngn_topup(_tx_ref text, _provider_tx_id text, _amount_paid numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ngn_topup_requests; net numeric(20,2); lid uuid; sid uuid;
BEGIN
  SELECT * INTO r FROM public.ngn_topup_requests WHERE tx_ref = _tx_ref FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown'); END IF;
  IF r.status <> 'awaiting' THEN RETURN jsonb_build_object('status', r.status); END IF;
  IF _amount_paid IS NULL OR _amount_paid <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  net := round(_amount_paid, 2) - r.fin3a_fee;
  IF net <= 0 THEN
    UPDATE public.ngn_topup_requests SET status='rejected', provider_tx_id=_provider_tx_id, amount_paid=_amount_paid, updated_at=now() WHERE id=r.id;
    RETURN jsonb_build_object('status','rejected');
  END IF;
  INSERT INTO public.account_ledger(user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (r.user_id, r.account_id, 'deposit', 'completed', net, 'NGN', 'NGN bank top-up', 'flutterwave', _provider_tx_id)
  RETURNING id INTO lid;
  INSERT INTO public.payment_fee_snapshots(user_id, account_id, ledger_id, service, currency, original_amount, quoted_payout, rate_state, fee_version_id, fee_rate_bps, fin3a_fee, provider_charge, network_charge, final_amount, provider, provider_reference, idempotency_key)
  VALUES (r.user_id, r.account_id, lid, 'ngn_deposit', 'NGN', round(_amount_paid,2), round(_amount_paid,2), 'confirmed', r.fee_version_id, 0, r.fin3a_fee, 0, 0, net, 'flutterwave', _provider_tx_id, 'ngn_topup:' || r.tx_ref)
  RETURNING id INTO sid;
  IF r.fin3a_fee > 0 THEN
    INSERT INTO public.revenue_events(snapshot_id, event_kind, fin3a_fee, provider_event_reference, verified_at, occurred_at)
    VALUES (sid, 'earned', r.fin3a_fee, 'flutterwave:' || _provider_tx_id, now(), now());
  END IF;
  UPDATE public.ngn_topup_requests SET status='credited', provider_tx_id=_provider_tx_id, amount_paid=_amount_paid, credited_amount=net, ledger_id=lid, updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('status','credited','credited',net);
END $$;
REVOKE ALL ON FUNCTION public.credit_ngn_topup(text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_ngn_topup(text,text,numeric) TO service_role;
-- Unique shareable Fin3a account ID per user
ALTER TABLE public.user_settings ADD COLUMN fin3a_id TEXT;
UPDATE public.user_settings
SET fin3a_id = 'FIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE fin3a_id IS NULL;
ALTER TABLE public.user_settings
ALTER COLUMN fin3a_id SET DEFAULT 'FIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
CREATE UNIQUE INDEX user_settings_fin3a_id_idx ON public.user_settings (fin3a_id);

-- Internal user-to-user transfers (audit record; money movement via paired ledger entries)
CREATE TABLE public.internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('NGN','USD')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  reference TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX internal_transfers_idempotency_idx ON public.internal_transfers (idempotency_key) WHERE status = 'completed';
CREATE INDEX internal_transfers_users_idx ON public.internal_transfers (from_user_id, to_user_id, created_at DESC);
GRANT SELECT ON public.internal_transfers TO authenticated;
GRANT ALL ON public.internal_transfers TO service_role;
ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own transfers" ON public.internal_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Split bills (tables first, policies after both exist)
CREATE TABLE public.split_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NGN','USD')),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.split_bills TO authenticated;
GRANT ALL ON public.split_bills TO service_role;
ALTER TABLE public.split_bills ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.split_bill_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  is_creator BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  transfer_id UUID REFERENCES public.internal_transfers(id),
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, user_id)
);
CREATE INDEX split_participants_user_idx ON public.split_bill_participants (user_id, status);
GRANT SELECT, INSERT ON public.split_bill_participants TO authenticated;
GRANT ALL ON public.split_bill_participants TO service_role;
ALTER TABLE public.split_bill_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators and participants read bills" ON public.split_bills
  FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR EXISTS (
    SELECT 1 FROM public.split_bill_participants p WHERE p.bill_id = id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Creators insert bills" ON public.split_bills
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators update bills" ON public.split_bills
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Participants and creators read shares" ON public.split_bill_participants
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.split_bills b WHERE b.id = bill_id AND b.creator_id = auth.uid()
  ));
CREATE POLICY "Creators add participants" ON public.split_bill_participants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.split_bills b WHERE b.id = bill_id AND b.creator_id = auth.uid()
  ));

-- Atomic internal transfer helper (callable only by other security definer functions)
CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  _from_user uuid, _to_user uuid, _currency text, _amount numeric,
  _idempotency_key text, _reference text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from_account uuid;
  _to_account uuid;
  _available numeric;
  _transfer_id uuid;
BEGIN
  IF _from_user IS NULL OR _to_user IS NULL OR _from_user = _to_user THEN
    RAISE EXCEPTION 'Invalid transfer parties';
  END IF;
  IF _currency NOT IN ('NGN','USD') THEN
    RAISE EXCEPTION 'Unsupported currency';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT id INTO _transfer_id FROM public.internal_transfers
  WHERE idempotency_key = _idempotency_key AND status = 'completed';
  IF FOUND THEN
    RETURN _transfer_id;
  END IF;

  INSERT INTO public.accounts (user_id, currency) VALUES (_to_user, _currency)
  ON CONFLICT (user_id, currency) DO NOTHING RETURNING id INTO _to_account;
  IF _to_account IS NULL THEN
    SELECT id INTO _to_account FROM public.accounts WHERE user_id = _to_user AND currency = _currency;
  END IF;

  SELECT id INTO _from_account FROM public.accounts
  WHERE user_id = _from_user AND currency = _currency
  FOR UPDATE;
  IF _from_account IS NULL THEN
    RAISE EXCEPTION 'Sender account not found';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind IN ('deposit','transfer_in') THEN amount ELSE -amount END), 0)
  INTO _available
  FROM public.account_ledger
  WHERE account_id = _from_account AND status = 'completed';

  IF _available < _amount THEN
    INSERT INTO public.internal_transfers (from_user_id, to_user_id, currency, amount, status, reference, idempotency_key)
    VALUES (_from_user, _to_user, _currency, _amount, 'failed', _reference, _idempotency_key || ':failed:' || gen_random_uuid()::text);
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.internal_transfers (from_user_id, to_user_id, currency, amount, status, reference, idempotency_key)
  VALUES (_from_user, _to_user, _currency, _amount, 'completed', _reference, _idempotency_key)
  RETURNING id INTO _transfer_id;

  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_from_user, _from_account, 'transfer_out', 'completed', _amount, _currency, _reference, 'internal', _transfer_id::text || ':out');
  INSERT INTO public.account_ledger (user_id, account_id, kind, status, amount, currency, reference, provider, provider_ref)
  VALUES (_to_user, _to_account, 'transfer_in', 'completed', _amount, _currency, _reference, 'internal', _transfer_id::text || ':in');

  RETURN _transfer_id;
END
$$;
REVOKE EXECUTE ON FUNCTION public.execute_internal_transfer(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;

-- Direct send to another Fin3a user
CREATE OR REPLACE FUNCTION public.transfer_internal(
  _to_user uuid, _currency text, _amount numeric, _idempotency_key text, _reference text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.consume_ai_quota('internal_transfer', 30, 3600) THEN
    RAISE EXCEPTION 'Too many transfers; try again later';
  END IF;
  RETURN public.execute_internal_transfer(auth.uid(), _to_user, _currency, _amount, _idempotency_key, _reference);
END
$$;

-- Pay your share of a split bill from your Fin3a balance
CREATE OR REPLACE FUNCTION public.pay_split_share(_participant_id uuid, _idempotency_key text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p record;
  _bill record;
  _transfer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO _p FROM public.split_bill_participants WHERE id = _participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;
  IF _p.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not your payment request';
  END IF;
  IF _p.status = 'paid' THEN
    RETURN _p.transfer_id;
  END IF;
  SELECT * INTO _bill FROM public.split_bills WHERE id = _p.bill_id;
  IF _bill.status <> 'open' THEN
    RAISE EXCEPTION 'This bill is no longer open';
  END IF;
  _transfer_id := public.execute_internal_transfer(auth.uid(), _bill.creator_id, _bill.currency, _p.amount, _idempotency_key, 'Split bill: ' || _bill.title);
  UPDATE public.split_bill_participants
  SET status = 'paid', paid_at = now(), transfer_id = _transfer_id
  WHERE id = _participant_id;
  UPDATE public.split_bills
  SET status = 'completed', updated_at = now()
  WHERE id = _bill.id
    AND NOT EXISTS (
      SELECT 1 FROM public.split_bill_participants
      WHERE bill_id = _bill.id AND status = 'pending' AND is_creator = false
    );
  RETURN _transfer_id;
END
$$;

-- Creator sends a payment reminder (in-app record; max one per hour per participant)
CREATE OR REPLACE FUNCTION public.send_split_reminder(_participant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT p.*, b.creator_id AS bill_creator INTO _p
  FROM public.split_bill_participants p
  JOIN public.split_bills b ON b.id = p.bill_id
  WHERE p.id = _participant_id;
  IF NOT FOUND OR _p.bill_creator <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _p.status <> 'pending' THEN
    RAISE EXCEPTION 'Already paid';
  END IF;
  IF _p.last_reminder_at IS NOT NULL AND _p.last_reminder_at > now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Reminder already sent recently';
  END IF;
  UPDATE public.split_bill_participants
  SET reminder_count = reminder_count + 1, last_reminder_at = now()
  WHERE id = _participant_id;
END
$$;

-- Rate-limited recipient lookup by Fin3a ID, email or phone; returns no contact details
CREATE OR REPLACE FUNCTION public.lookup_recipient(_identifier text)
RETURNS TABLE(user_id uuid, display_name text, fin3a_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id text;
  _digits text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.consume_ai_quota('recipient_lookup', 20, 3600) THEN
    RAISE EXCEPTION 'Too many lookups; try again later';
  END IF;
  _id := btrim(_identifier);
  IF _id ILIKE 'FIN-%' THEN
    RETURN QUERY
      SELECT s.user_id, s.display_name, s.fin3a_id
      FROM public.user_settings s
      WHERE s.fin3a_id = upper(_id) AND s.user_id <> auth.uid();
  ELSIF position('@' IN _id) > 0 THEN
    RETURN QUERY
      SELECT u.id, s.display_name, s.fin3a_id
      FROM auth.users u
      LEFT JOIN public.user_settings s ON s.user_id = u.id
      WHERE lower(u.email) = lower(_id) AND u.id <> auth.uid();
  ELSE
    _digits := regexp_replace(_id, '[^0-9]', '', 'g');
    IF _digits LIKE '0%' AND length(_digits) = 11 THEN
      _digits := '234' || substr(_digits, 2);
    END IF;
    RETURN QUERY
      SELECT p.user_id, s.display_name, s.fin3a_id
      FROM public.phone_identities p
      LEFT JOIN public.user_settings s ON s.user_id = p.user_id
      WHERE (regexp_replace(p.phone, '[^0-9]', '', 'g') = _digits
        OR regexp_replace(p.phone, '[^0-9]', '', 'g') = '234' || _digits)
        AND p.user_id <> auth.uid();
  END IF;
END
$$;

-- Public share profile for the pay page (name and Fin3a ID only)
CREATE OR REPLACE FUNCTION public.get_public_share_profile(_fin3a_id text)
RETURNS TABLE(display_name text, fin3a_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.display_name, s.fin3a_id
  FROM public.user_settings s
  WHERE s.fin3a_id = upper(btrim(_fin3a_id))
$$;

-- Read-only admin monitoring for sharing and split bills
CREATE OR REPLACE FUNCTION public.admin_split_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN jsonb_build_object(
    'bills_created', (SELECT count(*) FROM public.split_bills),
    'bills_open', (SELECT count(*) FROM public.split_bills WHERE status = 'open'),
    'requested', (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency', currency, 'total', total)), '[]'::jsonb)
      FROM (SELECT currency, sum(total_amount) AS total FROM public.split_bills GROUP BY currency) r),
    'collected', (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency', currency, 'total', total)), '[]'::jsonb)
      FROM (SELECT b.currency, sum(p.amount) AS total
            FROM public.split_bill_participants p
            JOIN public.split_bills b ON b.id = p.bill_id
            WHERE p.status = 'paid' GROUP BY b.currency) r),
    'participants_pending', (SELECT count(*) FROM public.split_bill_participants WHERE status = 'pending' AND is_creator = false),
    'participants_paid', (SELECT count(*) FROM public.split_bill_participants WHERE status = 'paid' AND is_creator = false),
    'transfers_completed', (SELECT count(*) FROM public.internal_transfers WHERE status = 'completed'),
    'transfers_failed', (SELECT count(*) FROM public.internal_transfers WHERE status = 'failed'),
    'suspicious', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', from_user_id, 'failed_count', c)), '[]'::jsonb)
      FROM (SELECT from_user_id, count(*) AS c FROM public.internal_transfers
            WHERE status = 'failed' AND created_at > now() - interval '24 hours'
            GROUP BY from_user_id HAVING count(*) >= 3) s)
  );
END
$$;
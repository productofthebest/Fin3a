CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('NGN','USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.account_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','transfer_in','transfer_out')),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed','reversed')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  reference TEXT,
  provider TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_ledger TO authenticated;
GRANT ALL ON public.account_ledger TO service_role;
ALTER TABLE public.account_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own ledger" ON public.account_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.crypto_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  min_deposit NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (symbol, network)
);
GRANT SELECT ON public.crypto_assets TO authenticated;
GRANT ALL ON public.crypto_assets TO service_role;
ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read supported assets" ON public.crypto_assets
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.crypto_assets (symbol, name, network, min_deposit) VALUES
  ('USDT', 'Tether', 'TRC20', 1),
  ('USDT', 'Tether', 'ERC20', 10),
  ('USDC', 'USD Coin', 'ERC20', 10),
  ('BTC', 'Bitcoin', 'Bitcoin', 0.0001),
  ('ETH', 'Ethereum', 'ERC20', 0.01);

CREATE TABLE public.crypto_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.crypto_assets(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crypto_addresses TO authenticated;
GRANT ALL ON public.crypto_addresses TO service_role;
ALTER TABLE public.crypto_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own crypto addresses" ON public.crypto_addresses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX account_ledger_user_account_idx ON public.account_ledger (user_id, account_id, created_at DESC);
CREATE INDEX crypto_addresses_user_idx ON public.crypto_addresses (user_id);
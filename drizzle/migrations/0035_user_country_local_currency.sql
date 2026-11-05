ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'NG';
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_country_check CHECK (country ~ '^[A-Z]{2}$');
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_currency_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$');
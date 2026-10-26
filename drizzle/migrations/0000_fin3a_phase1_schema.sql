-- Fin3a Phase 1: settings, categories, transactions, recurring bills

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  currency text not null default 'USD',
  onboarding_completed boolean not null default false,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  icon text not null default '💠',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  description text,
  merchant text,
  occurred_at date not null default current_date,
  status text not null default 'completed' check (status in ('pending','cleared','completed')),
  source text not null default 'manual' check (source in ('manual','receipt','statement','import')),
  recurring_bill_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_due_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- Grants (Data API does not grant default privileges on public)
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.recurring_bills to authenticated;
grant all on public.user_settings, public.categories, public.transactions, public.recurring_bills to service_role;

-- Row level security: strict user-level scoping
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_bills enable row level security;

create policy "Users read own settings" on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy "Users insert own settings" on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own settings" on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users read own categories" on public.categories for select to authenticated using (user_id = auth.uid());
create policy "Users insert own categories" on public.categories for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own categories" on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own categories" on public.categories for delete to authenticated using (user_id = auth.uid());

create policy "Users read own transactions" on public.transactions for select to authenticated using (user_id = auth.uid());
create policy "Users insert own transactions" on public.transactions for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own transactions" on public.transactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own transactions" on public.transactions for delete to authenticated using (user_id = auth.uid());

create policy "Users read own bills" on public.recurring_bills for select to authenticated using (user_id = auth.uid());
create policy "Users insert own bills" on public.recurring_bills for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own bills" on public.recurring_bills for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own bills" on public.recurring_bills for delete to authenticated using (user_id = auth.uid());

-- Indexes for dashboard aggregates and history queries
create index idx_transactions_user_date on public.transactions (user_id, occurred_at desc);
create index idx_transactions_user_type on public.transactions (user_id, type);
create index idx_categories_user on public.categories (user_id);
create index idx_bills_user on public.recurring_bills (user_id, next_due_date);
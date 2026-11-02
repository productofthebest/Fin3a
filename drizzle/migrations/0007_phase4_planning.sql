CREATE TABLE public.confirmed_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 amount numeric NOT NULL CHECK(amount >= 0), as_of date NOT NULL, coverage_confirmed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,currency,as_of)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confirmed_balances TO authenticated;
GRANT ALL ON public.confirmed_balances TO service_role;
ALTER TABLE public.confirmed_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_balances ON public.confirmed_balances FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.financial_commitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
 amount numeric NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), due_date date NOT NULL,
 matched_transaction_id uuid, included_in_history boolean NOT NULL DEFAULT false, settled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_commitments TO authenticated;
GRANT ALL ON public.financial_commitments TO service_role;
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_commitments ON public.financial_commitments FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.saved_scenarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), balance_id uuid NOT NULL,
 income_change numeric NOT NULL DEFAULT 0, spending_change numeric NOT NULL DEFAULT 0, purchase numeric NOT NULL DEFAULT 0 CHECK(purchase>=0),
 savings_contribution numeric NOT NULL DEFAULT 0 CHECK(savings_contribution>=0), budget numeric CHECK(budget>=0), months integer NOT NULL DEFAULT 6 CHECK(months BETWEEN 1 AND 60),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_scenarios TO authenticated;
GRANT ALL ON public.saved_scenarios TO service_role;
ALTER TABLE public.saved_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_scenarios ON public.saved_scenarios FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.financial_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 target_amount numeric NOT NULL CHECK(target_amount>0), target_date date NOT NULL, start_date date NOT NULL,
 frequency text NOT NULL CHECK(frequency IN ('weekly','monthly','quarterly','yearly')), contribution_amount numeric NOT NULL DEFAULT 0 CHECK(contribution_amount>=0),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(target_date>=start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_goals ON public.financial_goals FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.goal_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
 amount numeric NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), occurred_at date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_progress TO authenticated;
GRANT ALL ON public.goal_progress TO service_role;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_progress ON public.goal_progress FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.financial_goals g WHERE g.id=goal_id AND g.user_id=auth.uid() AND g.currency=goal_progress.currency));

-- Relationship ownership is enforced even for direct Data API writes.
CREATE FUNCTION public.validate_planning_ownership() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='saved_scenarios' THEN
  IF NOT EXISTS(SELECT 1 FROM public.confirmed_balances b WHERE b.id=NEW.balance_id AND b.user_id=NEW.user_id AND b.currency=NEW.currency) THEN RAISE EXCEPTION 'Invalid balance ownership'; END IF;
 ELSIF TG_TABLE_NAME='financial_commitments' THEN
  IF NEW.matched_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.transactions t WHERE t.id=NEW.matched_transaction_id AND t.user_id=NEW.user_id AND t.currency=NEW.currency AND t.type='expense' AND t.status='completed') THEN RAISE EXCEPTION 'Invalid transaction ownership'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_scenario_owner BEFORE INSERT OR UPDATE ON public.saved_scenarios FOR EACH ROW EXECUTE FUNCTION public.validate_planning_ownership();
CREATE TRIGGER validate_commitment_owner BEFORE INSERT OR UPDATE ON public.financial_commitments FOR EACH ROW EXECUTE FUNCTION public.validate_planning_ownership();
CREATE INDEX confirmed_balances_owner_date ON public.confirmed_balances(user_id,currency,as_of DESC);
CREATE INDEX financial_commitments_owner_date ON public.financial_commitments(user_id,currency,due_date);
CREATE INDEX financial_goals_owner ON public.financial_goals(user_id);
CREATE INDEX goal_progress_owner_goal ON public.goal_progress(user_id,goal_id);
CREATE INDEX saved_scenarios_owner ON public.saved_scenarios(user_id);
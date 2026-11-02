CREATE FUNCTION public.validate_planning_dates() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE today date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF TG_TABLE_NAME='confirmed_balances' THEN
  IF NEW.as_of>today OR NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid balance date or amount'; END IF;
 ELSIF TG_TABLE_NAME='goal_progress' THEN
  IF NEW.occurred_at>today OR NEW.amount::text IN ('NaN','Infinity','-Infinity') OR NOT EXISTS(SELECT 1 FROM public.financial_goals g WHERE g.id=NEW.goal_id AND g.user_id=NEW.user_id AND g.currency=NEW.currency AND g.start_date<=NEW.occurred_at) THEN RAISE EXCEPTION 'Invalid contribution date, currency or owner'; END IF;
 ELSIF TG_TABLE_NAME='saved_scenarios' THEN
  IF NEW.purchase::text IN ('NaN','Infinity','-Infinity') OR NEW.savings_contribution::text IN ('NaN','Infinity','-Infinity') OR NEW.income_change::text IN ('NaN','Infinity','-Infinity') OR NEW.spending_change::text IN ('NaN','Infinity','-Infinity') OR NEW.budget::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid scenario amount'; END IF;
 ELSIF TG_TABLE_NAME='financial_goals' THEN
  IF NEW.target_amount::text IN ('NaN','Infinity','-Infinity') OR NEW.contribution_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid goal amount'; END IF;
 ELSIF TG_TABLE_NAME='financial_commitments' THEN
  IF NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid commitment amount'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_balance_dates BEFORE INSERT OR UPDATE ON public.confirmed_balances FOR EACH ROW EXECUTE FUNCTION public.validate_planning_dates();
CREATE TRIGGER validate_progress_dates BEFORE INSERT OR UPDATE ON public.goal_progress FOR EACH ROW EXECUTE FUNCTION public.validate_planning_dates();
CREATE TRIGGER validate_scenario_amounts BEFORE INSERT OR UPDATE ON public.saved_scenarios FOR EACH ROW EXECUTE FUNCTION public.validate_planning_dates();
CREATE TRIGGER validate_goal_amounts BEFORE INSERT OR UPDATE ON public.financial_goals FOR EACH ROW EXECUTE FUNCTION public.validate_planning_dates();
CREATE TRIGGER validate_commitment_amounts BEFORE INSERT OR UPDATE ON public.financial_commitments FOR EACH ROW EXECUTE FUNCTION public.validate_planning_dates();

CREATE FUNCTION public.lock_document_draft_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE doc_id uuid; owner_id uuid;
BEGIN
 IF TG_OP='DELETE' THEN doc_id:=OLD.document_id; owner_id:=OLD.user_id; ELSE doc_id:=NEW.document_id;owner_id:=NEW.user_id; END IF;
 -- Do not lock the parent from a row trigger: import locks parent then child,
 -- while PostgreSQL already locks the child before invoking this trigger.
 -- A reverse parent lock here would deadlock concurrent edits/imports.
 PERFORM 1 FROM public.documents WHERE id=doc_id AND user_id=owner_id;
 IF NOT FOUND THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Invalid document owner';
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='confirmed' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.imported_transaction_id IS DISTINCT FROM OLD.imported_transaction_id) THEN RAISE EXCEPTION 'Imported draft identity is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lock_document_draft BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_drafts FOR EACH ROW EXECUTE FUNCTION public.lock_document_draft_mutation();
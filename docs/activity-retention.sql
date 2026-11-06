-- PREPARED ONLY. Apply through the managed migration tool after owner approval.
-- No existing financial rows are updated or deleted by these statements.
CREATE OR REPLACE FUNCTION public.guard_activity_retention()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.source IS DISTINCT FROM 'document' OR OLD.import_identity IS NULL THEN
      RAISE EXCEPTION 'History cannot be deleted; only imported-document records may be removed';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.import_identity IS DISTINCT FROM OLD.import_identity
     OR (NEW.source_document_id IS DISTINCT FROM OLD.source_document_id AND NEW.source_document_id IS NOT NULL) THEN
    RAISE EXCEPTION 'History provenance cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_activity_retention BEFORE UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_activity_retention();
CREATE POLICY imported_history_delete_only ON public.transactions AS RESTRICTIVE
FOR DELETE TO authenticated USING (user_id = auth.uid() AND source = 'document' AND import_identity IS NOT NULL);

-- Database workflows may update statuses, but cannot erase payment histories.
CREATE OR REPLACE FUNCTION public.reject_activity_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN RAISE EXCEPTION 'Payment history cannot be deleted'; END $$;
CREATE TRIGGER retain_wallet_history BEFORE DELETE ON public.account_ledger FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_transfer_history BEFORE DELETE ON public.internal_transfers FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_swap_history BEFORE DELETE ON public.currency_swaps FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_topup_history BEFORE DELETE ON public.ngn_topup_requests FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_withdrawal_history BEFORE DELETE ON public.ngn_withdrawals FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_bill_payment_history BEFORE DELETE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_split_history BEFORE DELETE ON public.split_bills FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_split_participant_history BEFORE DELETE ON public.split_bill_participants FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();
CREATE TRIGGER retain_payment_request_history BEFORE DELETE ON public.qr_payment_requests FOR EACH ROW EXECUTE FUNCTION public.reject_activity_delete();

-- Owners can read refunds for their own deposits; existing administrator access is preserved.
CREATE POLICY refund_owner_history_read ON public.flw_topup_refunds FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ngn_topup_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
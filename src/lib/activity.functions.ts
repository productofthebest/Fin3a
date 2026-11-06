import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { collectPages } from "./pagination";
import { activityPage, buildActivity } from "./activity-history";

export const getActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ page: z.number().int().min(1).max(100000), currency: z.string().regex(/^[A-Z]{3}$/).optional(), type: z.string().max(40).optional(), status: z.string().max(40).optional(), categoryId: z.string().max(40).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), search: z.string().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: db, userId: uid } = context;
    const [records, ledger, transfers, topups, withdrawals, payments, memberships, createdBills, requests, swaps, quotes] = await Promise.all([
      collectPages((a,b) => db.from("transactions").select("*,categories(name,icon)").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("account_ledger").select("*").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("internal_transfers").select("*").or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`).order("id").range(a,b)),
      collectPages((a,b) => db.from("ngn_topup_requests").select("*").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("ngn_withdrawals").select("*").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("bill_payments").select("*").eq("user_id",uid).order("id").range(a,b)),
      // Explicit memberships prevent administrator policy additions from widening personal history.
      collectPages((a,b) => db.from("split_bill_participants").select("*").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("split_bills").select("*").eq("creator_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("qr_payment_requests").select("*").or(`owner_user_id.eq.${uid},paid_by.eq.${uid}`).order("id").range(a,b)),
      collectPages((a,b) => db.from("currency_swaps").select("*").eq("user_id",uid).order("id").range(a,b)),
      collectPages((a,b) => db.from("payment_fee_snapshots").select("*").eq("user_id",uid).order("id").range(a,b)),
    ]);
    const participantBillIds = memberships.map(p => p.bill_id);
    const participantBills = participantBillIds.length ? await collectPages((a,b) => db.from("split_bills").select("*").in("id",participantBillIds).order("id").range(a,b)) : [];
    const allBills = [...new Map([...createdBills,...participantBills].map(b => [b.id,b])).values()];
    const allShares = allBills.length ? await collectPages((a,b) => db.from("split_bill_participants").select("*").in("bill_id",allBills.map(b => b.id)).order("id").range(a,b)) : [];
    const refunds = topups.length ? await collectPages((a,b) => db.from("flw_topup_refunds").select("*").in("request_id",topups.map(t => t.id)).order("provider_refund_id").range(a,b)) : [];
    return activityPage(buildActivity({ records, ledger, transfers, topups, withdrawals, payments, splits: allBills, shares: allShares, requests, swaps, quotes, refunds },uid),data);
  });
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAlerts, type Fin3aAlert } from "./fin3a-alerts";
import { ownedFinancialRecords } from "./financial-records.server";

// Reads only the signed-in user's Fin3a records (RLS applies) and evaluates alert rules.
export const getAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fin3aAlert[]> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const [bills, mine, created, drafts, failed, records] = await Promise.all([
      supabase.from("recurring_bills").select("id,name,amount,next_due_date,active").eq("user_id", userId).eq("active", true),
      supabase.from("split_bill_participants").select("id,amount,status,is_creator,split_bills(title,currency,deadline,status)").eq("user_id", userId).eq("is_creator", false).neq("status", "paid"),
      supabase.from("split_bills").select("id,title,currency,status,split_bill_participants(amount,status,is_creator)").eq("creator_id", userId).eq("status", "open"),
      supabase.from("transaction_drafts").select("document_id,documents(filename)").eq("user_id", userId).eq("status", "pending"),
      supabase.from("documents").select("id,filename").eq("user_id", userId).eq("status", "failed"),
      ownedFinancialRecords(supabase, userId),
    ]);
    for (const r of [bills, mine, created, drafts, failed]) if (r.error) throw new Error("Could not load alerts");

    const draftMap = new Map<string, { document_id: string; filename: string; count: number }>();
    for (const d of drafts.data ?? []) {
      const cur = draftMap.get(d.document_id) ?? { document_id: d.document_id, filename: (d.documents as { filename?: string } | null)?.filename ?? "document", count: 0 };
      cur.count++; draftMap.set(d.document_id, cur);
    }
    return buildAlerts({
      today,
      bills: bills.data ?? [],
      splitOwedByMe: (mine.data ?? []).filter(p => (p.split_bills as { status?: string } | null)?.status === "open").map(p => {
        const b = p.split_bills as { title: string; currency: string; deadline: string | null };
        return { id: p.id, title: b.title, amount: Number(p.amount), currency: b.currency, deadline: b.deadline };
      }),
      splitOwedToMe: (created.data ?? []).map(b => {
        const unpaid = (b.split_bill_participants ?? []).filter(p => !p.is_creator && p.status !== "paid");
        return { id: b.id, title: b.title, currency: b.currency, unpaidCount: unpaid.length, unpaidTotal: unpaid.reduce((s, p) => s + Number(p.amount), 0) };
      }),
      pendingDrafts: [...draftMap.values()],
      failedDocuments: failed.data ?? [],
      expenses: (records as { id: string; type: string; amount: number; currency: string | null; occurred_at: string; description: string | null; status: string; classification: string; flag: string | null }[])
        .filter(r => r.type === "expense").map(r => ({ ...r, amount: Number(r.amount) })),
    });
  });

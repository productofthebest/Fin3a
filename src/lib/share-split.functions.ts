import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  SPLIT_CURRENCIES,
  equalSplit,
  fromCents,
  toCents,
  validateCustomSplit,
  type SplitCurrency,
} from "./split-bill";

export interface ResolvedParticipant {
  user_id: string;
  display_name: string | null;
  fin3a_id: string | null;
}

export const getShareProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_settings")
      .select("display_name, fin3a_id, currency")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let fin3aId = data?.fin3a_id ?? null;
    if (!fin3aId) {
      // Older settings rows without an ID: assign one now (unique index retries are safe).
      for (let attempt = 0; attempt < 3 && !fin3aId; attempt++) {
        const candidate = `FIN-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
        const { data: updated, error: upErr } = await supabase
          .from("user_settings")
          .update({ fin3a_id: candidate })
          .eq("user_id", userId)
          .is("fin3a_id", null)
          .select("fin3a_id")
          .maybeSingle();
        if (!upErr && updated) fin3aId = updated.fin3a_id;
      }
    }
    return { displayName: data?.display_name ?? null, fin3aId, currency: data?.currency ?? "NGN" };
  });

export const lookupRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { identifier: string }) => {
    if (!input.identifier || input.identifier.trim().length < 3) throw new Error("Enter a Fin3a ID, email or phone number");
    return { identifier: input.identifier.trim() };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("lookup_recipient", { _identifier: data.identifier });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { found: false as const };
    return { found: true as const, participant: row as ResolvedParticipant };
  });

interface CreateSplitInput {
  title: string;
  note?: string;
  totalAmount: number;
  currency: SplitCurrency;
  deadline?: string | null;
  mode: "equal" | "custom";
  includeSelf: boolean;
  participants: { userId: string; customAmount?: number }[];
}

export const createSplitBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateSplitInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const title = data.title?.trim();
    if (!title || title.length > 120) throw new Error("Enter a bill title (up to 120 characters)");
    if (!SPLIT_CURRENCIES.includes(data.currency)) throw new Error("Unsupported currency");
    if (!Number.isFinite(data.totalAmount) || data.totalAmount <= 0) throw new Error("Enter a valid total amount");
    const uniqueIds = [...new Set(data.participants.map((p) => p.userId))].filter((id) => id !== userId);
    if (uniqueIds.length === 0) throw new Error("Add at least one other participant");
    if (uniqueIds.length > 20) throw new Error("A bill can have at most 20 participants");

    const totalCents = toCents(data.totalAmount);
    const shares: { userId: string; amountCents: number; isCreator: boolean }[] = [];
    if (data.mode === "equal") {
      const count = uniqueIds.length + (data.includeSelf ? 1 : 0);
      const cents = equalSplit(totalCents, count);
      uniqueIds.forEach((id, i) => shares.push({ userId: id, amountCents: cents[i]!, isCreator: false }));
      if (data.includeSelf) shares.push({ userId, amountCents: cents[count - 1]!, isCreator: true });
    } else {
      for (const p of data.participants) {
        if (p.userId === userId) continue;
        const cents = toCents(p.customAmount ?? 0);
        shares.push({ userId: p.userId, amountCents: cents, isCreator: false });
      }
      if (data.includeSelf) {
        const self = data.participants.find((p) => p.userId === userId);
        shares.push({ userId, amountCents: toCents(self?.customAmount ?? 0), isCreator: true });
      }
      const error = validateCustomSplit(totalCents, shares.map((s) => s.amountCents));
      if (error) throw new Error(error);
    }

    const { data: bill, error: billErr } = await supabase
      .from("split_bills")
      .insert({
        creator_id: userId,
        title,
        note: data.note?.trim() || null,
        total_amount: data.totalAmount,
        currency: data.currency,
        deadline: data.deadline || null,
      })
      .select("id")
      .single();
    if (billErr) throw new Error(billErr.message);

    const { error: partErr } = await supabase.from("split_bill_participants").insert(
      shares.map((s) => ({
        bill_id: bill.id,
        user_id: s.userId,
        amount: fromCents(s.amountCents),
        is_creator: s.isCreator,
        status: s.isCreator ? ("paid" as const) : ("pending" as const),
        paid_at: s.isCreator ? new Date().toISOString() : null,
      })),
    );
    if (partErr) throw new Error(partErr.message);
    return { billId: bill.id };
  });

export const getSplitBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: created, error: cErr }, { data: memberships, error: mErr }, { data: transfers, error: tErr }] =
      await Promise.all([
        supabase.from("split_bills").select("*").eq("creator_id", userId).order("created_at", { ascending: false }),
        supabase.from("split_bill_participants").select("*, split_bills(*)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("internal_transfers").select("*").or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(100),
      ]);
    if (cErr) throw new Error(cErr.message);
    if (mErr) throw new Error(mErr.message);
    if (tErr) throw new Error(tErr.message);

    const billIds = [
      ...new Set([
        ...(created ?? []).map((b) => b.id),
        ...(memberships ?? []).map((m) => m.bill_id),
      ]),
    ];
    const participantsByBill: Record<string, Database["public"]["Tables"]["split_bill_participants"]["Row"][]> = {};
    const directoryByBill: Record<string, ResolvedParticipant[]> = {};
    for (const billId of billIds) {
      const [{ data: parts, error: pErr }, { data: dir, error: dErr }] = await Promise.all([
        supabase.from("split_bill_participants").select("*").eq("bill_id", billId),
        supabase.rpc("split_participant_directory", { _bill_id: billId }),
      ]);
      if (pErr) throw new Error(pErr.message);
      if (dErr) throw new Error(dErr.message);
      participantsByBill[billId] = parts ?? [];
      directoryByBill[billId] = (dir ?? []) as ResolvedParticipant[];
    }

    return {
      me: userId,
      created: created ?? [],
      memberships: memberships ?? [],
      transfers: transfers ?? [],
      participantsByBill,
      directoryByBill,
    };
  });

export const paySplitShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("pay_split_share", {
      _participant_id: data.participantId,
      _idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    const outcome = result as { id: string; status: string; reason?: string };
    if (outcome.status !== "completed") throw new Error(outcome.reason ?? "Payment failed");
    return { transferId: outcome.id };
  });

export const sendSplitReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { participantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("send_split_reminder", { _participant_id: data.participantId });
    if (error) throw new Error(error.message);
    return { sent: true };
  });

export const sendTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { toUserId: string; currency: SplitCurrency; amount: number; reference?: string }) => input)
  .handler(async ({ data, context }) => {
    if (!SPLIT_CURRENCIES.includes(data.currency)) throw new Error("Unsupported currency");
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Enter a valid amount");
    const { data: result, error } = await context.supabase.rpc("transfer_internal", {
      _to_user: data.toUserId,
      _currency: data.currency,
      _amount: data.amount,
      _idempotency_key: crypto.randomUUID(),
      ...(data.reference?.trim() ? { _reference: data.reference.trim() } : {}),
    });
    if (error) throw new Error(error.message);
    const outcome = result as { id: string; status: string; reason?: string };
    if (outcome.status !== "completed") throw new Error(outcome.reason ?? "Payment failed");
    return { transferId: outcome.id };
  });

// Public pay page: name and Fin3a ID only, via the publishable key (no session).
export const getPublicShareProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { fin3aId: string }) => input)
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: rows, error } = await supabasePublic.rpc("get_public_share_profile", { _fin3a_id: data.fin3aId });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

// @ts-nocheck -- Document scanner is paused mid-build; strict typing is restored when that step resumes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FinDocument, TransactionDraft, TxType } from "./fin3a";

const DOC_SELECT = "*";

// ---------------------------------------------------------------------------
// Types & small helpers
// ---------------------------------------------------------------------------

export interface DocumentWithCounts extends FinDocument {
  draft_count: number;
  pending_count: number;
}

const DRAFT_FIELDS = [
  "txn_date",
  "description",
  "merchant",
  "amount",
  "currency",
  "type",
  "reference",
  "payment_method",
] as const;

type DraftField = (typeof DRAFT_FIELDS)[number];

const draftUpdateInput = z.object({
  id: z.string().uuid(),
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  merchant: z.string().trim().max(120).nullable().optional(),
  amount: z.number().positive().max(1_000_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  type: z.enum(["income", "expense"]).optional(),
  reference: z.string().trim().max(120).nullable().optional(),
  payment_method: z.string().trim().max(80).nullable().optional(),
});

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Normalize a money string like "₦1,234.50" or "(500.00)" into a positive/negative number. */
function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  // Prefer the last separator as the decimal point when both appear.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Best-effort date normalization to YYYY-MM-DD; null when not parseable. */
function parseDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number") {
    // Excel serial date (days since 1899-12-30).
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

// ---------------------------------------------------------------------------
// Spreadsheet / CSV parsing (deterministic — no AI involved)
// ---------------------------------------------------------------------------

interface ParsedRow {
  txn_date: string | null;
  description: string | null;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  type: TxType | null;
  reference: string | null;
  payment_method: string | null;
  confidence: "high" | "medium" | "low";
}

async function parseSpreadsheet(buffer: ArrayBuffer, currencyFallback: string): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  let rows: unknown[][];
  try {
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
  } catch {
    throw new Error("Could not read the spreadsheet. Make sure it is a valid CSV or Excel file.");
  }
  if (rows.length === 0) return [];

  // Find the header row: the first row that names a date-ish and an amount-ish column.
  const headerNames = (cell: unknown) => cleanText(cell, 40)?.toLowerCase() ?? "";
  let headerIdx = -1;
  let cols: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i] ?? [];
    const map: Record<string, number> = {};
    cells.forEach((cell, idx) => {
      const name = headerNames(cell);
      if (!name) return;
      if (!("date" in map) && /date|posted|txn|transaction.?date/.test(name)) map.date = idx;
      else if (!("amount" in map) && /^amount|amount.?ngn|value|total/.test(name)) map.amount = idx;
      else if (!("debit" in map) && /debit|withdrawal|paid.?out|money.?out/.test(name)) map.debit = idx;
      else if (!("credit" in map) && /credit|deposit|paid.?in|money.?in/.test(name)) map.credit = idx;
      else if (!("description" in map) && /description|details|narration|particulars|memo|item|remark/.test(name))
        map.description = idx;
      else if (!("merchant" in map) && /merchant|payee|payer|counterparty|beneficiary/.test(name)) map.merchant = idx;
      else if (!("reference" in map) && /reference|ref.?no|receipt.?no|transaction.?id|cheque/.test(name))
        map.reference = idx;
      else if (!("type" in map) && /type|dr.?cr|direction|category/.test(name)) map.type = idx;
      else if (!("currency" in map) && /currency|ccy/.test(name)) map.currency = idx;
    });
    const hasAmount = map.amount !== undefined || map.debit !== undefined || map.credit !== undefined;
    if (map.date !== undefined && hasAmount) {
      headerIdx = i;
      cols = map;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error(
      "We couldn't find date and amount columns in this file. Add a header row with at least a date and an amount column, or upload a photo/PDF of the document instead.",
    );
  }

  const signed = cols.amount !== undefined;
  const out: ParsedRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const cells = row ?? [];
    const get = (idx?: number) => (idx === undefined ? null : (cells[idx] ?? null));
    const date = parseDate(get(cols.date));
    let amount: number | null = null;
    let type: TxType | null = null;
    let confidence: ParsedRow["confidence"] = "high";

    const debit = parseAmount(get(cols.debit));
    const credit = parseAmount(get(cols.credit));
    if (cols.debit !== undefined && debit !== null && debit !== 0) {
      amount = Math.abs(debit);
      type = "expense";
    } else if (cols.credit !== undefined && credit !== null && credit !== 0) {
      amount = Math.abs(credit);
      type = "income";
    } else if (signed) {
      const raw = parseAmount(get(cols.amount));
      if (raw !== null && raw !== 0) {
        amount = Math.abs(raw);
        if (raw < 0) type = "expense";
        else {
          const typeCell = cleanText(get(cols.type), 20)?.toLowerCase();
          if (typeCell && /credit|income|deposit|in\b/.test(typeCell)) type = "income";
          else if (typeCell && /debit|expense|withdraw|out\b/.test(typeCell)) type = "expense";
          else {
            // In a signed column (negatives = money out), positives are money in.
            const signedColumn = rows.some((r) => (parseAmount(r?.[cols.amount]) ?? 0) < 0);
            type = signedColumn ? "income" : "expense";
            if (!signedColumn) confidence = "low";
          }
        }
      }
    }
    if (amount === null || amount <= 0) continue;
    const typeCell = cleanText(get(cols.type), 20)?.toLowerCase();
    if (type === null && typeCell) {
      if (/credit|income|deposit/.test(typeCell)) type = "income";
      else if (/debit|expense|withdrawal|payment/.test(typeCell)) type = "expense";
    }

    out.push({
      txn_date: date,
      description: cleanText(get(cols.description), 300),
      merchant: cleanText(get(cols.merchant), 120) ?? cleanText(get(cols.description), 120),
      amount,
      currency: normalizeCurrency(get(cols.currency)) ?? currencyFallback,
      type: type ?? "expense",
      reference: cleanText(get(cols.reference), 120),
      payment_method: null,
      confidence,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// AI vision extraction (images and PDFs)
// ---------------------------------------------------------------------------

const AI_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function resolveMediaKind(mimeType: string, filename: string): "image" | "pdf" | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = (mimeType || AI_MIME_BY_EXT[ext] || "").toLowerCase();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) {
    return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) ? "image" : null;
  }
  if (AI_MIME_BY_EXT[ext]?.startsWith("image/")) return "image";
  return null;
}

const EXTRACT_INSTRUCTIONS = `You extract transactions from photos and scans of financial documents: bank statements, receipts, POS slips, bills, teller receipts, cheque images and invoices.

Rules:
- Return one entry per transaction line printed on the document. Do NOT invent entries and do NOT compute totals, balances or running sums — only transcribe what is printed.
- amount is the number printed for that line, in the document's own currency, without currency symbols or thousands separators.
- txn_date is the transaction date printed on the line, formatted YYYY-MM-DD when legible; otherwise null.
- type is "income" for money received (credits, deposits, payments received, refunds received) and "expense" for money paid out (purchases, bills, withdrawals, fees).
- merchant is the counterparty name printed on the line; description is the line's printed description or narration.
- category_hint is a short spending-category guess in English (e.g. "Groceries", "Transport", "Rent", "Utilities", "Airtime") only when the description clearly suggests one; otherwise null.
- confidence reflects how legible the line was: "high" for clearly printed values, "medium" when slightly uncertain, "low" when you had to guess.
- Ignore balance columns, page headers, footers and summaries.
- If the document contains no transaction lines, return an empty list.`;

async function extractWithAi(
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string,
): Promise<ParsedRow[]> {
  const { extractDocumentWithOpenAI } = await import("./document-openai.server");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMime = mimeType.toLowerCase();
  const resolvedMime = normalizedMime.startsWith("image/") || normalizedMime === "application/pdf"
    ? normalizedMime
    : AI_MIME_BY_EXT[ext] ?? normalizedMime;
  const output = await extractDocumentWithOpenAI({
    apiKey: process.env["OPENAI_API_KEY"],
    buffer,
    mimeType: resolvedMime,
    filename,
    instructions: EXTRACT_INSTRUCTIONS,
  });

  return (output.transactions ?? [])
    .filter((t) => typeof t.amount === "number" && Number.isFinite(t.amount) && t.amount > 0)
    .map((t) => ({
      txn_date: parseDate(t.txn_date),
      description: cleanText(t.description, 300),
      merchant: cleanText(t.merchant, 120),
      amount: Number(t.amount),
      currency: normalizeCurrency(t.currency),
      type: t.type === "income" ? ("income" as const) : ("expense" as const),
      reference: cleanText(t.reference, 120),
      payment_method: cleanText(t.payment_method, 80),
      confidence: t.confidence === "high" || t.confidence === "medium" ? t.confidence : "low",
    }));
}

// ---------------------------------------------------------------------------
// Duplicate detection (drafts vs existing transactions)
// ---------------------------------------------------------------------------

function msBetweenDays(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime());
}

async function flagDraftDuplicates(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  drafts: { id: string; txn_date: string | null; amount: number | null; merchant: string | null; reference: string | null }[],
): Promise<void> {
  const pending = drafts.filter((d) => d.txn_date && d.amount !== null);
  if (pending.length === 0) return;
  const dates = [...new Set(pending.map((d) => d.txn_date as string))].sort();
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("id, amount, occurred_at, merchant, reference")
    .eq("user_id", userId)
    .gte("occurred_at", dates[0])
    .lte("occurred_at", dates[dates.length - 1]);
  if (error || !txs || txs.length === 0) return;

  for (const draft of pending) {
    const match = txs.find(
      (tx) =>
        Math.abs(Number(tx.amount) - Number(draft.amount)) < 0.01 &&
        msBetweenDays(tx.occurred_at.slice(0, 10), draft.txn_date as string) <= 3 * 86_400_000 &&
        ((draft.reference && tx.reference && draft.reference.toLowerCase() === tx.reference.toLowerCase()) ||
          (draft.merchant && tx.merchant && draft.merchant.toLowerCase() === tx.merchant.toLowerCase())),
    );
    if (match) {
      await supabase.from("transaction_drafts").update({ duplicate_of: match.id }).eq("id", draft.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentWithCounts[]> => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("*, transaction_drafts(status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((doc) => {
      const drafts = (doc.transaction_drafts ?? []) as { status: string }[];
      return {
        ...doc,
        transaction_drafts: undefined,
        draft_count: drafts.length,
        pending_count: drafts.filter((d) => d.status === "pending").length,
      } as DocumentWithCounts;
    });
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().trim().min(1).max(255),
        mime_type: z.string().trim().max(120),
        size_bytes: z.number().int().positive(),
        storage_path: z.string().trim().min(1).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const fingerprint = await sha256Hex(`${data.filename}:${data.size_bytes}`);
    const docType = guessDocType(data.filename);
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        filename: data.filename,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        storage_path: data.storage_path,
        doc_type: docType,
        fingerprint,
        status: "uploaded",
      })
      .select(DOC_SELECT)
      .single();
    if (error) throw new Error(error.message);

    let duplicateOf: FinDocument | null = null;
    const { data: existing } = await context.supabase
      .from("documents")
      .select(DOC_SELECT)
      .eq("user_id", context.userId)
      .eq("fingerprint", fingerprint)
      .neq("id", row.id)
      .limit(1);
    if (existing && existing.length > 0) duplicateOf = existing[0] as FinDocument;

    return { document: row as FinDocument, duplicateOf };
  });

function guessDocType(filename: string): string {
  const s = filename.toLowerCase();
  if (/statement/.test(s)) return "statement";
  if (/receipt|teller/.test(s)) return "receipt";
  if (/pos|slip/.test(s)) return "pos_slip";
  if (/bill|utility|invoice/.test(s)) return "bill";
  if (/cheque|check/.test(s)) return "cheque";
  return "other";
}

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select(DOC_SELECT)
      .eq("id", data.documentId)
      .eq("user_id", userId)
      .single();
    if (docError || !doc) throw new Error(docError?.message ?? "Document not found");
    const document = doc as FinDocument;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("currency")
      .eq("user_id", userId)
      .maybeSingle();
    const currencyFallback = settings?.currency ?? "USD";

    await supabase.from("documents").update({ status: "processing", error_message: null }).eq("id", document.id);

    try {
      const { data: file, error: downloadError } = await supabase.storage
        .from("documents")
        .download(document.storage_path);
      if (downloadError || !file) throw new Error(downloadError?.message ?? "Could not open the uploaded file");

      const buffer = await file.arrayBuffer();
      const ext = document.filename.split(".").pop()?.toLowerCase() ?? "";
      const mime = document.mime_type.toLowerCase();
      const isSpreadsheet =
        mime.includes("csv") ||
        mime.includes("spreadsheetml") ||
        mime.includes("ms-excel") ||
        ext === "csv" ||
        ext === "xlsx" ||
        ext === "xls";

      let parsed: ParsedRow[];
      if (isSpreadsheet) {
        parsed = await parseSpreadsheet(buffer, currencyFallback);
      } else {
        const kind = resolveMediaKind(document.mime_type, document.filename);
        if (!kind) {
          throw new Error("Unsupported file type. Upload a CSV, Excel file, PDF or photo (PNG/JPG/WebP).");
        }
        parsed = await extractWithAi(buffer, kind === "pdf" ? "application/pdf" : document.mime_type, document.filename);
      }

      // Re-extracting replaces previous pending drafts.
      await supabase
        .from("transaction_drafts")
        .delete()
        .eq("document_id", document.id)
        .eq("status", "pending");

      if (parsed.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("transaction_drafts")
          .insert(
            parsed.map((row) => ({
              user_id: userId,
              document_id: document.id,
              txn_date: row.txn_date,
              description: row.description,
              merchant: row.merchant,
              amount: row.amount,
              currency: row.currency,
              type: row.type,
              reference: row.reference,
              payment_method: row.payment_method,
              category_hint: null,
              confidence: row.confidence,
              status: "pending",
            })),
          )
          .select("id, txn_date, amount, merchant, reference");
        if (insertError) throw new Error(insertError.message);
        await flagDraftDuplicates(supabase, userId, (inserted ?? []) as never);
      }

      const total = parsed.reduce((sum, row) => sum + row.amount, 0);
      const summary =
        parsed.length === 0
          ? "No transaction lines found in this document."
          : `${parsed.length} transaction${parsed.length === 1 ? "" : "s"} found`;
      const { error: updateError } = await supabase
        .from("documents")
        .update({ status: "extracted", summary, error_message: null })
        .eq("id", document.id);
      if (updateError) throw new Error(updateError.message);

      return { draftCount: parsed.length, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", document.id);
      throw new Error(message);
    }
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TransactionDraft[]> => {
    const { data: rows, error } = await context.supabase
      .from("transaction_drafts")
      .select("*")
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TransactionDraft[];
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => draftUpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Partial<Record<DraftField, unknown>> = {};
    for (const field of DRAFT_FIELDS) {
      if (rest[field] !== undefined) patch[field] = rest[field];
    }
    const { data: row, error } = await context.supabase
      .from("transaction_drafts")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TransactionDraft;
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transaction_drafts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc("import_document_drafts", {
      p_document_id: data.documentId,
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("documents").update({ status: "imported" }).eq("id", data.documentId);
    return { imported: count ?? 0 };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .eq("user_id", context.userId)
      .single();
    if (doc) {
      await context.supabase.storage.from("documents").remove([doc.storage_path]);
    }
    const { error } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.documentId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

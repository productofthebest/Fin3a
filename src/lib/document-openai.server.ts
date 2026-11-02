import { z } from "zod";
import { DOCUMENT_TYPES } from "./document-rules";

const transactionSchema = z.object({
  txn_date: z.string().nullable(),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  type: z.enum(["income", "expense"]),
  reference: z.string().nullable(),
  payment_method: z.string().nullable(),
  category_hint: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});
const summarySchema = z.object({
  opening_balance: z.number().nullable(), closing_balance: z.number().nullable(),
  total_credits: z.number().nullable(), total_debits: z.number().nullable(), currency: z.string().nullable(),
});
const extractionSchema = z.object({ document_type: z.enum(DOCUMENT_TYPES).optional(), statement_summary: summarySchema.nullable().optional(), transactions: z.array(transactionSchema) });

function providerError(status: number, code?: string): string {
  if (status === 401) return "OpenAI rejected the saved API key. Please check the key in project secrets.";
  if (status === 402 || code === "insufficient_quota") return "Your OpenAI account has insufficient API quota. Check OpenAI billing and usage limits, then rescan.";
  if (status === 403) return "Your OpenAI project does not have permission to use the scanner model. Check the key's permissions.";
  if (status === 429) return "OpenAI is temporarily rate-limiting scans. Wait a little and rescan.";
  if (status === 413 || code === "context_length_exceeded") return "This document is too large for one scan. Upload a shorter PDF or a CSV/Excel export.";
  if (status === 400) return "OpenAI could not process this file. Try a supported image or an unlocked, shorter PDF.";
  return "OpenAI document scanning is unavailable right now. Please try again later.";
}

/** Called only from the authenticated scanner handler; no credentials or documents are logged. */
export async function extractDocumentWithOpenAI(input: {
  apiKey: string | undefined;
  buffer: ArrayBuffer;
  mimeType: string;
  filename: string;
  instructions: string;
}) {
  if (!input.apiKey) throw new Error("Document scanning requires OPENAI_API_KEY in project secrets.");
  const bytes = new Uint8Array(input.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const dataUrl = `data:${input.mimeType};base64,${btoa(binary)}`;
  const media = input.mimeType.startsWith("image/")
    ? { type: "input_image", image_url: dataUrl, detail: "high" }
    : { type: "input_file", filename: input.filename, file_data: dataUrl };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(150_000),
      body: JSON.stringify({
        model: "gpt-5-mini",
        store: false,
        instructions: input.instructions,
        input: [{ role: "user", content: [media, { type: "input_text", text: "Extract every printed transaction line from this document." }] }],
        reasoning: { effort: "low" },
        max_output_tokens: 16_000,
        text: { format: {
          type: "json_schema", name: "document_transactions", strict: true,
          schema: {
            type: "object", additionalProperties: false, required: ["document_type", "statement_summary", "transactions"],
            properties: { statement_summary: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false,
              description: "Only figures PRINTED on these pages; null for any not printed. Never calculate.",
              required: ["opening_balance", "closing_balance", "total_credits", "total_debits", "currency"],
              properties: { opening_balance: { type: ["number", "null"] }, closing_balance: { type: ["number", "null"] },
                total_credits: { type: ["number", "null"] }, total_debits: { type: ["number", "null"] }, currency: { type: ["string", "null"] } } }] }, document_type: { type: "string", enum: DOCUMENT_TYPES, description: "Identify the actual document type from visible content, not its filename" }, transactions: { type: "array", items: {
              type: "object", additionalProperties: false,
              required: Object.keys(transactionSchema.shape),
              properties: {
                txn_date: { type: ["string", "null"] }, description: { type: ["string", "null"] },
                merchant: { type: ["string", "null"] }, amount: { type: ["number", "null"] },
                currency: { type: ["string", "null"] }, type: { type: "string", enum: ["income", "expense"] },
                reference: { type: ["string", "null"] }, payment_method: { type: ["string", "null"] },
                category_hint: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
            } } },
          },
        } },
      }),
    });
  } catch {
    throw new Error("OpenAI could not finish the scan in time or could not be reached. Try again or upload a shorter document.");
  }
  const body = await response.json().catch(() => null) as {
    error?: { code?: string }; status?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  } | null;
  if (!response.ok || body?.error) throw new Error(providerError(response.status, body?.error?.code));
  if (body?.status === "incomplete") {
    throw new Error("OpenAI could not finish the whole document. No partial scan was saved. Upload a shorter PDF or a CSV/Excel export.");
  }
  const text = body?.output?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text").map((part) => part.text ?? "").join("");
  if (!text) throw new Error("OpenAI returned no readable transactions. Try a clearer photo or an unlocked PDF.");
  try {
    return extractionSchema.parse(JSON.parse(text));
  } catch {
    throw new Error("OpenAI returned an invalid scan. No transactions were saved. Please rescan the document.");
  }
}
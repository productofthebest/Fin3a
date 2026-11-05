import { z } from "zod";

export const WEBHOOK_VERSION = "fin3a-flw-v3-2";
export const MAX_WEBHOOK_BYTES = 32_768;
const id = z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d{0,19}$/)]).transform(String);
const ref = z.string().regex(/^F3T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const chargeNotice = z.object({ event: z.literal("charge.completed"), data: z.object({ id, tx_ref: ref }) });
// Official V3 refund custom-url callback is unwrapped, not an invented refund.completed event.
export const refundNotice = z.object({ id, TransactionId: id, AmountRefunded: z.number().finite().positive(), status: z.string().min(1).max(80) });
export type Notice = { kind: "charge"; id: string; txRef: string } | { kind: "refund"; id: string; transactionId: string };
export function parseNotice(body: unknown): Notice | null {
  const charge = chargeNotice.safeParse(body);
  if (charge.success) return { kind: "charge", id: charge.data.data.id, txRef: charge.data.data.tx_ref };
  const refund = refundNotice.safeParse(body);
  if (refund.success) return { kind: "refund", id: refund.data.id, transactionId: refund.data.TransactionId };
  if (body && typeof body === "object" && "event" in body && body.event !== "charge.completed") return null;
  throw new Error("INVALID_BODY");
}
export function validV3Hash(got: string | null, expected: string | undefined): boolean {
  if (!got || !expected) return false;
  const a = new TextEncoder().encode(got), b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
export async function readWebhookBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("INVALID_BODY");
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_WEBHOOK_BYTES) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) { if (error instanceof Error && error.message === "BODY_TOO_LARGE") throw error; throw new Error("INVALID_BODY"); }
}
export function refundState(status: string): "settled" | "pending" | "failed" | "unknown" {
  if (["completed-bank-transfer", "completed-momo", "completed-mpgs", "completed-offline", "completed-preauth"].includes(status)) return "settled";
  if (["completed", "processing", "pending-momo", "pending-bank-transfer", "pending-mpgs"].includes(status)) return "pending";
  if (status === "failed") return "failed";
  return "unknown";
}
export async function handleWebhook(request: Request, expected: string | undefined, process: (notice: Notice) => Promise<unknown>): Promise<Response> {
  if (!validV3Hash(request.headers.get("verif-hash"), expected)) return new Response("Unauthorized", { status: 401 });
  let notice: Notice | null;
  try { notice = parseNotice(await readWebhookBody(request)); }
  catch (e) { return new Response("Invalid request", { status: e instanceof Error && e.message === "BODY_TOO_LARGE" ? 413 : 400 }); }
  if (!notice) return new Response("ok");
  try { await process(notice); return new Response("ok"); }
  catch { return new Response("retry", { status: 503 }); }
}
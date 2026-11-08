/**
 * Server-only Flutterwave FX adapter.
 * No client-facing trade action is exposed. Production execution must first
 * reserve funds idempotently, persist quote/trade references, then settle or
 * reverse the ledger from verified provider events. Keep FLW_FX_ENABLED unset
 * until that lifecycle is implemented and reviewed.
 */
import { z } from "zod";
import { supportsFlutterwaveFxPair } from "./flutterwave-capabilities";

const BASE = "https://api.flutterwave.com/v3";
const providerId = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^[1-9]\d{0,19}$/),
]).transform(String);

const quoteSchema = z.object({
  id: providerId,
  status: z.enum(["NEW", "PROCESSING", "READY", "EXPIRED", "FAILED"]),
  base_currency: z.string().length(3),
  target_currency: z.string().length(3),
  quantity: z.number().finite().positive().optional(),
  approved_quantity: z.number().finite().positive().optional(),
  total_value: z.number().finite().positive().optional(),
  best_available_rate: z.number().finite().positive().optional(),
  expiry: z.string().datetime({ offset: true }).optional(),
}).passthrough();

const tradeSchema = z.object({
  id: providerId,
  status: z.enum(["NEW", "PENDING", "SETTLED", "FAILED"]),
  quantity: z.number().finite().positive().optional(),
  approved_quantity: z.number().finite().positive().optional(),
  price: z.number().finite().positive().optional(),
  base_currency: z.string().length(3).optional(),
  target_currency: z.string().length(3).optional(),
}).passthrough();

export type FlutterwaveFxQuote = z.infer<typeof quoteSchema>;
export type FlutterwaveFxTrade = z.infer<typeof tradeSchema>;
export type FxConfig = {
  FLW_SECRET_KEY?: string;
  FLW_FX_ENABLED?: string;
  FLW_FX_MERCHANT_ENABLED?: string;
};

export function flutterwaveFxEnabled(config: FxConfig): boolean {
  return config.FLW_FX_ENABLED === "true"
    && config.FLW_FX_MERCHANT_ENABLED === "true"
    && Boolean(config.FLW_SECRET_KEY);
}

export function assertSupportedFxPair(baseCurrency: string, targetCurrency: string): void {
  if (!supportsFlutterwaveFxPair(baseCurrency, targetCurrency)) {
    throw new Error("UNSUPPORTED_FX_PAIR");
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const key = process.env["FLW_SECRET_KEY"];
  if (!flutterwaveFxEnabled(process.env)) throw new Error("FX_NOT_ENABLED");
  if (!key) throw new Error("FX_NOT_CONFIGURED");
  const response = await fetch(BASE + path, {
    ...init,
    signal: AbortSignal.timeout(12_000),
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || !("status" in body)
    || body.status !== "success" || !("data" in body)) {
    throw new Error("FLW_FX_PROVIDER_ERROR");
  }
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) throw new Error("FLW_FX_PROVIDER_ERROR");
  return parsed.data;
}

/** Provider remains authoritative for minimum trade size and liquidity. */
export async function requestFlutterwaveFxQuote(input: {
  baseCurrency: string;
  targetCurrency: string;
  quantity: number;
  reference: string;
}): Promise<FlutterwaveFxQuote> {
  const baseCurrency = input.baseCurrency.trim().toUpperCase();
  const targetCurrency = input.targetCurrency.trim().toUpperCase();
  assertSupportedFxPair(baseCurrency, targetCurrency);
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("INVALID_FX_QUANTITY");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.reference)) throw new Error("INVALID_FX_REFERENCE");
  return request("/rfq", quoteSchema, {
    method: "POST",
    body: JSON.stringify({
      base_currency: baseCurrency,
      target_currency: targetCurrency,
      quantity: input.quantity,
      reference: input.reference,
    }),
  });
}

export async function getFlutterwaveFxQuote(quoteId: string): Promise<FlutterwaveFxQuote> {
  if (!/^[1-9]\d{0,19}$/.test(quoteId)) throw new Error("INVALID_FX_QUOTE_ID");
  return request("/rfq/" + encodeURIComponent(quoteId), quoteSchema);
}

/** Internal primitive only; requires an idempotent wallet reservation and reconciliation record. */
export async function executeFlutterwaveFxTrade(input: {
  quoteId: string;
  narration: string;
}): Promise<FlutterwaveFxTrade> {
  if (!/^[1-9]\d{0,19}$/.test(input.quoteId)) throw new Error("INVALID_FX_QUOTE_ID");
  const narration = input.narration.trim();
  if (!narration || narration.length > 120) throw new Error("INVALID_FX_NARRATION");
  return request("/trade", tradeSchema, {
    method: "POST",
    body: JSON.stringify({ quote_id: input.quoteId, narration }),
  });
}

export async function getFlutterwaveFxTrade(tradeId: string): Promise<FlutterwaveFxTrade> {
  if (!/^[1-9]\d{0,19}$/.test(tradeId)) throw new Error("INVALID_FX_TRADE_ID");
  return request("/trade/" + encodeURIComponent(tradeId), tradeSchema);
}

import { z } from "zod";

export const WITHDRAWALS_LOCKED = "Bank withdrawals are temporarily unavailable while secure payment setup is verified. No money will be moved.";
export const withdrawalInput = z.object({
  amount: z.number().finite().min(100).max(5_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, "Use at most two decimal places"),
  bankCode: z.string().min(2).max(12).regex(/^[A-Za-z0-9]+$/),
  bankName: z.string().trim().min(2).max(120),
  accountNumber: z.string().regex(/^\d{10}$/),
  idempotencyKey: z.string().uuid(),
});

export type WithdrawalConfig = {
  FLW_WITHDRAWALS_ENABLED?: string;
  FLW_INTERNATIONAL_WITHDRAWALS_ENABLED?: string;
  FLW_PAYOUT_ENVIRONMENT?: string;
  FLW_STATIC_EGRESS_VERIFIED?: string;
  FLW_IP_WHITELIST_VERIFIED?: string;
  FLW_PRODUCTION_VERIFIED?: string;
  FLW_PAYOUT_RELAY_URL?: string;
  FLW_PAYOUT_RELAY_TOKEN?: string;
  FLW_WEBHOOK_HASH?: string;
};

/** Configuration must point at an operator-owned HTTPS service, never a user-supplied URL. */
export function relayOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/" || (u.port && u.port !== "443")) return null;
    if (!u.hostname.includes(".") || u.hostname === "localhost" || u.hostname.endsWith(".local") || u.hostname.endsWith(".internal") || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.startsWith("[")) return null;
    return u.origin;
  } catch { return null; }
}

function payoutPrerequisitesVerified(config: WithdrawalConfig): boolean {
  return config.FLW_PAYOUT_ENVIRONMENT === "production"
    && config.FLW_STATIC_EGRESS_VERIFIED === "true"
    && config.FLW_IP_WHITELIST_VERIFIED === "true"
    && config.FLW_PRODUCTION_VERIFIED === "true"
    && Boolean(relayOrigin(config.FLW_PAYOUT_RELAY_URL) && config.FLW_PAYOUT_RELAY_TOKEN && config.FLW_WEBHOOK_HASH);
}

/** Existing NGN withdrawals retain their independent kill switch. */
export function withdrawalsEnabled(config: WithdrawalConfig): boolean {
  return config.FLW_WITHDRAWALS_ENABLED === "true" && payoutPrerequisitesVerified(config);
}

/** International withdrawals require a separate explicit gate and the same verified transport controls. */
export function internationalWithdrawalsEnabled(config: WithdrawalConfig): boolean {
  return config.FLW_INTERNATIONAL_WITHDRAWALS_ENABLED === "true" && payoutPrerequisitesVerified(config);
}

export function sameWithdrawal(a: { amount: number; bank_code: string; account_number: string }, b: z.infer<typeof withdrawalInput>): boolean {
  return Number(a.amount) === b.amount && a.bank_code === b.bankCode && a.account_number === b.accountNumber;
}
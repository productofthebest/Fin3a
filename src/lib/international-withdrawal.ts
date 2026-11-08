import { z } from "zod";
import { CURRENCY_EXPONENT, toMinorUnits } from "./international-payout-routes";

// Deliberately not environment-configurable in this release. Unlocking requires
// a separately reviewed integration of international holds into ALL spend paths.
export const INTERNATIONAL_LIVE_WITHDRAWALS_ENABLED = false;
export const INTERNATIONAL_LOCKED = "International withdrawals are not enabled. No money will be moved.";
export const internationalWithdrawalInput = z.object({
  destinationCountry: z.string().regex(/^[A-Z]{2}$/).refine(v => v !== "NG"),
  currency: z.string().regex(/^[A-Z]{3}$/).refine(v => v !== "NGN" && CURRENCY_EXPONENT[v] !== undefined),
  method: z.enum(["bank", "mobile_money"]),
  amountMinor: z.number().int().positive().safe().max(1_000_000_000_000),
  idempotencyKey: z.string().uuid(),
  beneficiary: z.record(z.string().max(40), z.string().trim().min(1).max(200)).refine(v => Object.keys(v).length <= 16),
}).strict();

export type InternationalWithdrawalInput = z.infer<typeof internationalWithdrawalInput>;
export type InternationalOutcome = "pending" | "successful" | "failed" | "reversed";
export function internationalOutcome(status: string): InternationalOutcome {
  switch (status.toUpperCase()) {
    case "SUCCESSFUL": return "successful";
    case "FAILED": return "failed";
    case "REVERSED": return "reversed";
    default: return "pending";
  }
}
export function verifiedMinorAmount(amount: number, currency: string): number {
  const minor = toMinorUnits(amount, currency);
  if (minor === null) throw new Error("TRANSFER_AMOUNT_INVALID");
  return minor;
}

export type InternationalLedgerEntry = { kind: "reservation" | "release" | "reversal"; amountMinor: number };
export function reservedMinor(entries: readonly InternationalLedgerEntry[]): number {
  return entries.reduce((sum, e) => {
    if (!Number.isSafeInteger(e.amountMinor) || e.amountMinor <= 0) throw new Error("INVALID_LEDGER_AMOUNT");
    const total = sum + (e.kind === "reservation" ? e.amountMinor : -e.amountMinor);
    if (!Number.isSafeInteger(total)) throw new Error("LEDGER_OVERFLOW");
    return total;
  }, 0);
}
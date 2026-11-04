export const FEE_SERVICES = ["crypto_deposit", "crypto_withdrawal", "crypto_swap", "ngn_withdrawal", "ngn_deposit"] as const;
export type FeeService = typeof FEE_SERVICES[number];
export interface FeeSetting { service: FeeService; id: string | null; rate_bps: number; high_rate_bps: number; threshold_usd: number; flat_ngn: number; created_at: string | null }
export const SERVICE_LABELS: Record<string, string> = { crypto_withdrawal: "USD withdrawals", crypto_swap: "Swaps", ngn_withdrawal: "NGN withdrawals", ngn_deposit: "NGN bank top-ups", crypto_deposit: "Crypto deposit conversion", bill_payment: "Bill commissions" };

/** Exact nonnegative decimal parsing; never silently round a provider quote. */
export function minorUnits(value: string, precision = 2): bigint {
  if (!Number.isInteger(precision) || precision < 0 || precision > 12 || !/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid monetary amount");
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > precision) throw new Error("Unsupported amount precision");
  return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, "0") || "0");
}
export function decimalUnits(value: bigint, precision = 2): string {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString().padStart(precision + 1, "0");
  return precision === 0 ? sign + digits : `${sign}${digits.slice(0, -precision)}.${digits.slice(-precision)}`;
}
export function calculateFee(input: { service: string; asset?: string; currency: "NGN" | "USD"; payout: string; usdValue?: string; providerCharge?: string; networkCharge?: string; commissionIncluded?: boolean }, settings: readonly FeeSetting[]) {
  const payout = minorUnits(input.payout);
  if (payout <= 0n) throw new Error("Amount must be positive");
  let bps = 0;
  let fee = 0n;
  let version: string | null = null;
  if (input.service === "crypto_sell") throw new Error("Crypto selling is retired");
  const free = ["internal_transfer", "share_payment", "bill_split", "qr_payment", "bill_payment", "currency_swap"].includes(input.service);
  if (!free) {
    const config = settings.find(s => s.service === input.service);
    if (!config) throw new Error("Fee configuration unavailable");
    version = config.id;
    if (input.service === "ngn_withdrawal" || input.service === "ngn_deposit") {
      if (input.currency !== "NGN") throw new Error("NGN bank transfer required");
      fee = minorUnits(String(config.flat_ngn));
    } else {
      if (input.service !== "crypto_deposit" && input.asset !== "USDT" && input.asset !== "USDC") throw new Error("Unsupported crypto asset");
      if (!input.usdValue || minorUnits(input.usdValue) <= 0n) throw new Error("Verified USD valuation required");
      bps = minorUnits(input.usdValue) >= minorUnits(String(config.threshold_usd)) ? config.high_rate_bps : config.rate_bps;
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error("Invalid fee rate");
      fee = (payout * BigInt(bps) + 5000n) / 10000n;
    }
  }
  if (input.commissionIncluded) fee = 0n; // trusted, verified agreement only; never a client input
  const provider = minorUnits(input.providerCharge ?? "0");
  const network = minorUnits(input.networkCharge ?? "0");
  const final = payout - fee - provider - network;
  if (final <= 0n) throw new Error("Charges leave no positive payout");
  return { feeVersionId: version, feeRateBps: bps, fin3aFee: decimalUnits(fee), providerCharge: decimalUnits(provider), networkCharge: decimalUnits(network), finalAmount: decimalUnits(final) };
}
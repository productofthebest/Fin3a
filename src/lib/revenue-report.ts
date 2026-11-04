import { decimalUnits, minorUnits } from "./transaction-fees";
export interface RevenueRow { id: string; snapshot_id: string; event_kind: string; fin3a_fee: string | number; provider_commission: string | number; provider_charge: string | number; network_charge: string | number; occurred_at: string; related_event_id: string | null }
export interface QuoteRow { id: string; service: string; currency: string; provider: string; quoted_payout: string | number; asset: string | null; network: string | null }
export function summarizeRevenue(events: readonly RevenueRow[], quotes: readonly QuoteRow[]) {
  const out = [];
  for (const currency of ["NGN", "USD"]) {
    let fees = 0n, commissions = 0n, charges = 0n, refunds = 0n, pending = 0n, settled = 0n, estimated = 0n, volume = 0n;
    const counted = new Set<string>();
    for (const event of events) {
      const quote = quotes.find(q => q.id === event.snapshot_id);
      if (!quote || quote.currency !== currency) continue;
      const fee = minorUnits(String(event.fin3a_fee)), commission = minorUnits(String(event.provider_commission));
      const cost = minorUnits(String(event.provider_charge)) + minorUnits(String(event.network_charge));
      if (event.event_kind === "earned") { fees += fee; commissions += commission; charges += cost; if (!counted.has(quote.id)) { volume += minorUnits(String(quote.quoted_payout)); counted.add(quote.id); } }
      else if (event.event_kind === "refund" || event.event_kind === "reversal") { refunds += fee + commission; charges -= cost; }
      else if (event.event_kind === "pending") pending += fee + commission;
      else if (event.event_kind === "settled") settled += fee + commission;
      else if (event.event_kind === "commission_estimate") estimated += commission;
      else if (event.event_kind === "commission_adjustment") { commissions += commission; charges += cost; }
    }
    out.push({ currency, fees: decimalUnits(fees), commissions: decimalUnits(commissions), charges: decimalUnits(charges), refunds: decimalUnits(refunds), gross: decimalUnits(fees + commissions), net: decimalUnits(fees + commissions - charges - refunds), pending: decimalUnits(pending), settled: decimalUnits(settled), estimated: decimalUnits(estimated), volume: decimalUnits(volume) });
  }
  return out;
}
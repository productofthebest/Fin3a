/** Pure financial arithmetic shared by dashboard and assistant; amounts are major units. */
export interface FinancialRecord {
  type: string;
  amount: number;
  status: string;
  classification: string;
  currency: string | null;
  occurred_at: string;
  flag?: string | null;
}

export function moneyPrecision(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** moneyPrecision(currency);
  return Math.round(value * factor) / factor;
}

export function validFinancialDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function recordExclusion(record: FinancialRecord, currency: string, today: string): string | null {
  if (!record.currency) return "unknownCurrency";
  if (record.currency !== currency) return "otherCurrency";
  if (!validFinancialDate(record.occurred_at) || !Number.isFinite(Number(record.amount)) || Number(record.amount) <= 0) return "invalid";
  if (record.occurred_at > today) return "future";
  if (record.classification !== "regular") return "nonRegular";
  if (record.flag === "duplicate" || record.flag === "ambiguous") return "needsReview";
  if (record.type !== "income" && record.type !== "expense") return "invalid";
  return null;
}

export function completedRecords<T extends FinancialRecord>(records: T[], currency: string, today: string): T[] {
  return records.filter((record) => !recordExclusion(record, currency, today) && record.status === "completed");
}

export function calculateTotals(records: FinancialRecord[], currency: string, today: string) {
  const factor = 10 ** moneyPrecision(currency);
  let income = 0, spending = 0, pendingExpenses = 0, clearedNet = 0;
  const excluded: Record<string, number> = {};
  for (const record of records) {
    const reason = recordExclusion(record, currency, today);
    if (reason) { excluded[reason] = (excluded[reason] ?? 0) + 1; continue; }
    const amount = Math.round(Number(record.amount) * factor);
    if (record.status === "pending") { if (record.type === "expense") pendingExpenses += amount; }
    else if (record.status === "cleared") clearedNet += record.type === "income" ? amount : -amount;
    else if (record.status === "completed") { if (record.type === "income") income += amount; else spending += amount; }
    else excluded["unverified"] = (excluded["unverified"] ?? 0) + 1;
  }
  return {
    income: income / factor, spending: spending / factor, recordedNet: (income - spending) / factor,
    pendingExpenses: pendingExpenses / factor, clearedNet: clearedNet / factor, excluded,
  };
}

/** Zero-activity months after the first completed record stay in the denominator. */
export function historicalAverages(months: { month: string; income: number; spending: number }[], firstRecordDate: string | null, today: string, currency: string) {
  const complete = firstRecordDate
    ? months.filter((m) => m.month > firstRecordDate.slice(0, 7) && m.month < today.slice(0, 7))
    : [];
  return {
    completeMonths: complete.map((m) => m.month),
    income: complete.length ? roundMoney(complete.reduce((sum, m) => sum + m.income, 0) / complete.length, currency) : null,
    spending: complete.length ? roundMoney(complete.reduce((sum, m) => sum + m.spending, 0) / complete.length, currency) : null,
  };
}
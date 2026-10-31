import { calculateTotals, completedRecords, historicalAverages, roundMoney, validFinancialDate, type FinancialRecord } from "./financial-calculations";

export type Period = "week" | "month" | "quarter" | "year" | "custom";
export interface AnalysisFilters { period: Period; start?: string | undefined; end?: string | undefined; comparison: "previous" | "year" }
export interface AnalysisRecord extends FinancialRecord { id: string; description: string | null; source: string; category_id: string | null; categories: { name: string; icon: string } | null }
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function addDays(date: string, days: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d); }
function priorYear(date: string) { const d = new Date(`${date}T00:00:00Z`); const month = d.getUTCMonth(); d.setUTCFullYear(d.getUTCFullYear() - 1); if (d.getUTCMonth() !== month) d.setUTCDate(0); return iso(d); }
export function analysisRange(filters: AnalysisFilters, today: string) {
  const end = filters.end ?? today;
  if (!validFinancialDate(end) || end > today) throw new Error("Choose an end date no later than today.");
  const d = new Date(`${end}T00:00:00Z`);
  let start = end;
  if (filters.period === "custom") start = filters.start ?? end;
  else if (filters.period === "week") start = addDays(end, -((d.getUTCDay() + 6) % 7));
  else if (filters.period === "month") start = `${end.slice(0, 7)}-01`;
  else if (filters.period === "quarter") start = iso(new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1)));
  else start = `${end.slice(0, 4)}-01-01`;
  if (!validFinancialDate(start) || start > end) throw new Error("Choose a valid start date before the end date.");
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days > 1827) throw new Error("Choose a date range of five years or less.");
  const comparisonEnd = filters.comparison === "year" ? priorYear(end) : addDays(start, -1);
  const comparisonStart = filters.comparison === "year" ? priorYear(start) : addDays(comparisonEnd, -(days - 1));
  return { start, end, comparisonStart, comparisonEnd, days, timezone: "UTC" };
}
export function percentChange(current: number, previous: number) { return previous === 0 ? null : Math.round((current - previous) / Math.abs(previous) * 1000) / 10; }
export function buildAnalysis(records: AnalysisRecord[], currency: string, today: string, filters: AnalysisFilters) {
  const range = analysisRange(filters, today);
  const inRange = (start: string, end: string) => records.filter(r => r.occurred_at >= start && r.occurred_at <= end);
  const currentRaw = inRange(range.start, range.end);
  const previousRaw = inRange(range.comparisonStart, range.comparisonEnd);
  const current = calculateTotals(currentRaw, currency, today);
  const previous = calculateTotals(previousRaw, currency, today);
  const eligible = completedRecords(currentRaw, currency, today);
  const comparisonRows = completedRecords(previousRaw, currency, today);
  const categoryIds = new Set([...eligible, ...comparisonRows].filter(r => r.type === "expense").map(r => r.category_id));
  const categories = [...categoryIds].map(id => {
    const rows = eligible.filter(r => r.category_id === id && r.type === "expense");
    const old = comparisonRows.filter(r => r.category_id === id && r.type === "expense");
    const sample = rows[0] ?? old[0];
    const spending = calculateTotals(rows, currency, today).spending;
    const before = calculateTotals(old, currency, today).spending;
    return { id, name: sample?.categories?.name ?? "Uncategorized", icon: sample?.categories?.icon ?? "💠", spending, previous: before, change: percentChange(spending, before) };
  }).sort((a,b) => b.spending - a.spending);
  const trend = [];
  for (let day = range.start; day <= range.end;) {
    const next = range.days <= 90 ? addDays(day, 1) : iso(new Date(Date.UTC(Number(day.slice(0,4)), Number(day.slice(5,7)), 1)));
    const rows = eligible.filter(r => r.occurred_at >= day && r.occurred_at < next);
    const totals = calculateTotals(rows, currency, today);
    trend.push({ date: day, income: totals.income, spending: totals.spending });
    day = next;
  }
  return { range, current, previous, categories, trend, transactions: eligible, comparisonCount: comparisonRows.length,
    changes: { income: percentChange(current.income, previous.income), spending: percentChange(current.spending, previous.spending) } };
}
export function forecastHistory(records: FinancialRecord[], currency: string, today: string) {
  const rows = completedRecords(records, currency, today);
  const first = rows.map(r => r.occurred_at).sort()[0] ?? null;
  const months = [];
  const now = new Date(`${today}T00:00:00Z`);
  for (let i = 12; i >= 1; i--) {
    const month = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))).slice(0,7);
    const totals = calculateTotals(rows.filter(r => r.occurred_at.startsWith(month)), currency, today);
    months.push({ month, income: totals.income, spending: totals.spending });
  }
  return historicalAverages(months, first, today, currency);
}
export function simulateForecast(input: { balance: number; income: number; spending: number; incomeChange: number; spendingChange: number; purchase: number; months: number }, currency: string) {
  if (Object.values(input).some(v => !Number.isFinite(v)) || input.balance < 0 || input.income < 0 || input.spending < 0 || input.purchase < 0 || !Number.isInteger(input.months) || input.months < 1 || input.months > 60 || input.income + input.incomeChange < 0 || input.spending + input.spendingChange < 0) throw new Error("Enter valid nonnegative amounts and a horizon of 1–60 months.");
  const baselineNet = roundMoney(input.income - input.spending, currency);
  const scenarioNet = roundMoney(input.income + input.incomeChange - input.spending - input.spendingChange, currency);
  const starting = roundMoney(input.balance - input.purchase, currency);
  const runway = (balance: number, net: number) => balance < 0 ? 0 : net < 0 ? Math.round(balance / -net * 10) / 10 : null;
  return { baselineNet, scenarioNet, baselineRunway: runway(input.balance, baselineNet), scenarioRunway: runway(starting, scenarioNet),
    points: Array.from({ length: input.months + 1 }, (_, month) => ({ month, baseline: roundMoney(input.balance + month * baselineNet, currency), scenario: roundMoney(starting + month * scenarioNet, currency) })) };
}
export function analysisCsv(result: ReturnType<typeof buildAnalysis>, currency: string) {
  const escape = (value: unknown) => { const s = String(value ?? ""); return `"${/^[=+@\-\t\r]/.test(s) ? "'" : ""}${s.replaceAll('"','""')}"`; };
  const rows: unknown[][] = [["Fin3a actual recorded financial report"], ["Currency", currency], ["Period", result.range.start, result.range.end], ["Comparison", result.range.comparisonStart, result.range.comparisonEnd], ["Timezone", "UTC"], ["Basis", "Completed regular records only; no currency conversion; not a bank balance"], ["Metric", "Actual", "Comparison actual"], ["Income", result.current.income, result.previous.income], ["Spending", result.current.spending, result.previous.spending], ["Recorded net cash flow", result.current.recordedNet, result.previous.recordedNet], ["Date", "Description", "Type", "Amount", "Currency", "Category", "Source"]];
  for (const r of result.transactions) rows.push([r.occurred_at, r.description, r.type, r.amount, currency, r.categories?.name ?? "Uncategorized", r.source]);
  return rows.map(row => row.map(escape).join(",")).join("\r\n");
}
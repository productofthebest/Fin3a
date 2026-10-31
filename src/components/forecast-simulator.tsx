import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/fin3a";
import { simulateForecast, type forecastHistory } from "@/lib/financial-analysis";

export function ForecastSimulator({ history, currency }: { history: ReturnType<typeof forecastHistory>; currency: string }) {
  const [values, setValues] = useState({ balance: "", incomeChange: "0", spendingChange: "0", purchase: "0", months: "6" });
  const [result, setResult] = useState<ReturnType<typeof simulateForecast> | null>(null);
  const [error, setError] = useState("");
  const available = history.completeMonths.length >= 3 && history.income !== null && history.spending !== null;
  function calculate() {
    setError(""); setResult(null);
    if (!available || history.income === null || history.spending === null) return;
    if (Object.values(values).some(s => !s.trim())) { setError("Complete every amount, including your confirmed available balance."); return; }
    try { setResult(simulateForecast({ balance: Number(values.balance), income: history.income, spending: history.spending, incomeChange: Number(values.incomeChange), spendingChange: Number(values.spendingChange), purchase: Number(values.purchase), months: Number(values.months) }, currency)); }
    catch (e) { setError(e instanceof Error ? e.message : "Check your amounts."); }
  }
  const fields = [
    { id: "balance", label: `Confirmed available balance (${currency})`, min: 0 },
    { id: "incomeChange", label: "Monthly income change (+ / −)", min: undefined },
    { id: "spendingChange", label: "Monthly spending change (+ / −)", min: undefined },
    { id: "purchase", label: "One-time purchase", min: 0 },
    { id: "months", label: "Months ahead", min: 1 },
  ] as const;
  const runway = (value: number | null) => value === null ? "No depletion at this estimated rate" : `${value} months`;
  return <section className="mt-10 border-t border-border pt-8">
    <h2 className="font-display text-2xl font-semibold">Forecast & what-if</h2>
    <p className="mt-2 text-sm text-muted-foreground">Estimates · {history.completeMonths.length} complete UTC months · First recorded month and current month excluded</p>
    {!available ? <p className="mt-5 border-l-2 border-primary pl-4 text-sm text-muted-foreground">At least three complete months after your first recorded month are needed. Your history currently provides {history.completeMonths.length}. No forecast has been assumed.</p> : <>
      <div className="mt-5 flex flex-wrap gap-8 text-sm"><p>Average income <strong className="ml-2 text-positive">{formatMoney(history.income ?? 0, currency)}</strong></p><p>Average spending <strong className="ml-2">{formatMoney(history.spending ?? 0, currency)}</strong></p></div>
      <p className="mt-2 text-xs text-muted-foreground">History: {history.completeMonths.join(", ")} · Zero-activity months included; recording history may be incomplete.</p>
      <form onSubmit={e => { e.preventDefault(); calculate(); }} className="mt-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(field => <div key={field.id}><Label htmlFor={field.id}>{field.label}</Label><Input className="mt-2" id={field.id} type="number" step={field.id === "months" ? "1" : "any"} min={field.min} max={field.id === "months" ? 60 : undefined} value={values[field.id]} onChange={e => { setValues(prev => ({ ...prev, [field.id]: e.target.value })); setResult(null); }} required /></div>)}</div><Button className="mt-5" type="submit">Calculate scenario</Button></form>
      {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
      {result && <div className="mt-6"><div className="grid gap-6 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Baseline · estimated monthly cash flow</p><p className="mt-1 text-xl font-semibold">{formatMoney(result.baselineNet, currency)}</p><p className="mt-2 text-sm">Runway: {runway(result.baselineRunway)}</p></div><div><p className="text-sm text-muted-foreground">Scenario · estimated monthly cash flow</p><p className="mt-1 text-xl font-semibold">{formatMoney(result.scenarioNet, currency)}</p><p className="mt-2 text-sm">Runway: {runway(result.scenarioRunway)}</p></div></div>
        <div className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={result.points}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" stroke="var(--muted-foreground)"/><Tooltip formatter={(v: number) => formatMoney(v,currency)} labelFormatter={v => `Month ${v}`} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--foreground)" }}/><Line dataKey="baseline" name="Baseline estimate" stroke="var(--muted-foreground)" dot={false}/><Line dataKey="scenario" name="Scenario estimate" stroke="var(--primary)" dot={false}/></LineChart></ResponsiveContainer></div>
        <p className="mt-3 text-xs text-muted-foreground">Balance = confirmed starting balance − one-time purchase + months × estimated net cash flow. Monthly averages stay constant. Bills are not added again; taxes, inflation and unrecorded commitments are not assumed. Negative balances indicate a shortfall, not available credit. Estimates are not guarantees.</p>
      </div>}
    </>}
  </section>;
}
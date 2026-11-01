import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simulateForecast } from "@/lib/financial-analysis";

type History = { completeMonths: string[]; income: number | null; spending: number | null };

type Result = ReturnType<typeof simulateForecast>;

function fmt(value: number | null): string {
  if (value === null) return "Runway: not applicable (no monthly shortfall)";
  if (value === 0) return "Runway: 0 months";
  return `Runway: ${Number.isInteger(value) ? value : value.toFixed(1)} months`;
}

export function ForecastSimulator({ history, currency }: { history: History; currency: string }) {
  const [balance, setBalance] = useState("");
  const [incomeChange, setIncomeChange] = useState("");
  const [spendingChange, setSpendingChange] = useState("");
  const [purchase, setPurchase] = useState("");
  const [months, setMonths] = useState("12");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = history.completeMonths.length >= 3 && history.income !== null && history.spending !== null;

  function calculate() {
    setError(null);
    setResult(null);
    const parsed = {
      balance: Number(balance),
      income: history.income ?? 0,
      spending: history.spending ?? 0,
      incomeChange: Number(incomeChange || 0),
      spendingChange: Number(spendingChange || 0),
      purchase: Number(purchase || 0),
      months: Number(months || 12),
    };
    if (balance.trim() === "") {
      setError("Enter your confirmed available balance first — forecasts are never guessed from recorded cash flow.");
      return;
    }
    try {
      setResult(simulateForecast(parsed, currency));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enter valid numbers.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">What-if forecast</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Based on your average of {history.completeMonths.length} complete month{history.completeMonths.length === 1 ? "" : "s"}
        {eligible ? ` (${currency} ${history.income} income, ${currency} ${history.spending} spending per month)` : ""}.
        Scenario inputs are temporary and never saved.
      </p>

      {!eligible ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Forecasts need at least three complete historical months of records. Keep logging income and expenses and check back.
        </p>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            calculate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="fs-balance">Confirmed available balance ({currency})</Label>
              <Input id="fs-balance" type="number" min="0" step="any" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-income-change">Monthly income change (+ / −)</Label>
              <Input id="fs-income-change" type="number" step="any" value={incomeChange} onChange={(e) => setIncomeChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-spending-change">Monthly spending change (+ / −)</Label>
              <Input id="fs-spending-change" type="number" step="any" value={spendingChange} onChange={(e) => setSpendingChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-purchase">One-time purchase</Label>
              <Input id="fs-purchase" type="number" min="0" step="any" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-months">Horizon (months)</Label>
              <Input id="fs-months" type="number" min="1" max="60" step="1" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit">Calculate scenario</Button>

          {result && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                  <p className="font-medium">Current path</p>
                  <p className="mt-1 text-muted-foreground">Net per month: {currency} {result.baselineNet}</p>
                  <p className="mt-1">{fmt(result.baselineRunway)}</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">Your scenario</p>
                  <p className="mt-1 text-muted-foreground">Net per month: {currency} {result.scenarioNet}</p>
                  <p className="mt-1">{fmt(result.scenarioRunway)}</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.points} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tickFormatter={(m: number) => `M${m}`} className="text-xs" />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${currency} ${value}`, name === "baseline" ? "Current path" : "Scenario"]}
                      labelFormatter={(m: number) => `Month ${m}`}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="scenario" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

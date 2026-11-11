import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, Wallet, Clock3, TrendingUp, TrendingDown, Tags, type LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { dashboardQuery, settingsQuery } from "@/lib/queries";
import { formatMoney, MONTH_NAMES } from "@/lib/fin3a";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordCurrencySelect } from "@/components/record-currency-select";
import { pageMeta } from "@/lib/page-meta";

const searchSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  offset: z.coerce.number().int().min(-24).max(0).optional(),
});

export const Route = createFileRoute("/_authenticated/spending")({
  head: () => pageMeta("Spending", "Your Fin3a spending, income, expenses and trends."),
  ssr: false,
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
  },
  component: DashboardPage,
});

function ChartTooltip({ currency, active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatMoney(Number(entry.value), currency)}
        </p>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, detail, className }: { label: string; value: string; icon: LucideIcon; tone: "neutral" | "warning" | "positive" | "spending"; detail: string; className?: string }) {
  const tones = {
    neutral: "bg-muted text-foreground",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    spending: "bg-primary/10 text-primary",
  };
  return (
    <Card className="h-full overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full min-h-[142px] flex-col justify-between gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</p>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="size-[19px]" strokeWidth={1.9} />
          </span>
        </div>
        <div className="min-w-0">
          <p className={`break-words font-display text-2xl font-semibold tracking-tight sm:text-[1.7rem] ${className ?? ""}`}>{value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityCategoryIcon({ name, fallback }: { name: string; fallback: string }) {
  if (name.trim().toLowerCase() === "uncategorized") {
    return <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground"><Tags className="size-[18px]" strokeWidth={1.8}/></span>;
  }
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground text-lg">{fallback}</span>;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { offset = 0, currency: selectedCurrency } = Route.useSearch();
  const { data } = useSuspenseQuery(dashboardQuery(offset, selectedCurrency));
  const currency = data.currency;

  const months = data.months.map((m) => ({
    ...m,
    name: MONTH_NAMES[Number(m.key.slice(5, 7)) - 1] ?? m.key,
  }));
  const selected = data.selectedMonth;
  const selectedName = `${MONTH_NAMES[Number(selected.key.slice(5, 7)) - 1] ?? selected.key} ${selected.key.slice(0, 4)}`;
  const net = selected.income - selected.spending;
  const activityMax = data.categoryBreakdown[0]?.total ?? 0;

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Spending</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedName}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            disabled={offset <= -24}
            onClick={() => navigate({ to: "/spending", search: { offset: offset - 1, currency } })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">{selectedName}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            disabled={offset >= 0}
            onClick={() => navigate({ to: "/spending", search: { offset: offset + 1, currency } })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4"><RecordCurrencySelect value={currency} currencies={data.currencies} onChange={currency => navigate({ to: "/spending", search: { offset, currency } })} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Recorded net cash flow" value={formatMoney(data.availableFunds, currency)} icon={Wallet} tone="neutral" detail="Lifetime completed records · Not a bank balance"/>
        <SummaryCard label="Pending expenses" value={formatMoney(data.pendingAmount, currency)} icon={Clock3} tone="warning" detail="Awaiting completion or clearance"/>
        <SummaryCard label="Income this month" value={formatMoney(selected.income, currency)} icon={TrendingUp} tone="positive" detail={selectedName} className="text-positive"/>
        <SummaryCard label="Spending this month" value={formatMoney(selected.spending, currency)} icon={TrendingDown} tone="spending" detail={selectedName}/>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Actual completed records in {currency} · Not a bank balance · UTC dates
        {Object.values(data.excludedRecords).reduce((sum, count) => sum + count, 0) > 0
          ? ` · ${Object.values(data.excludedRecords).reduce((sum, count) => sum + count, 0)} records excluded (currency, classification, date or review status)`
          : ""}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-xl">Cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={months} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
                <Bar dataKey="income" name="Income" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={16} />
                <Bar dataKey="spending" name="Spending" fill="var(--secondary)" stroke="var(--border)" radius={[6, 6, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl">Net spending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold tracking-tight">
              {formatMoney(selected.spending, currency)}
            </p>
            <p className={`mt-1 text-sm ${net >= 0 ? "text-positive" : "text-negative"}`}>
              {net >= 0 ? "Under" : "Over"} income by {formatMoney(Math.abs(net), currency)}
            </p>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={data.dailySpending}>
                  <defs>
                    <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    ticks={[1, 8, 15, 22]}
                  />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="Spent so far"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#netFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No spending recorded in this currency this month.
              </p>
            ) : (
              data.categoryBreakdown.map((c) => (
                <div key={c.name} className="flex items-start gap-3">
                  <ActivityCategoryIcon name={c.name} fallback={c.icon}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="font-medium">{formatMoney(c.total, currency)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${activityMax ? Math.max((c.total / activityMax) * 100, 3) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-xl">Upcoming bills</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recurring bills due this month. Add them from the Bills page.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.upcomingBills.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-lg leading-none">{bill.category?.icon ?? "🧾"}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {bill.next_due_date} · {bill.frequency}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{`${Number(bill.amount).toLocaleString()} · Currency unconfirmed`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

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
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { dashboardQuery, settingsQuery } from "@/lib/queries";
import { formatMoney, MONTH_NAMES } from "@/lib/fin3a";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  offset: z.coerce.number().int().min(-24).max(0).optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  validateSearch: searchSchema,
  loader: async ({ context, search }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(dashboardQuery(search.offset ?? 0));
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

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${className ?? ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { offset = 0 } = Route.useSearch();
  const { data } = useSuspenseQuery(dashboardQuery(offset));
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
            onClick={() => navigate({ to: "/dashboard", search: { offset: offset - 1 } })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">{selectedName}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            disabled={offset >= 0}
            onClick={() => navigate({ to: "/dashboard", search: { offset: offset + 1 } })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Available funds" value={formatMoney(data.availableFunds, currency)} />
        <SummaryCard label="Pending" value={formatMoney(data.pendingAmount, currency)} />
        <SummaryCard
          label="Income this month"
          value={formatMoney(selected.income, currency)}
          className="text-positive"
        />
        <SummaryCard label="Spending this month" value={formatMoney(selected.spending, currency)} />
      </div>

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
                No spending recorded this month yet. Add your first transaction from the Activity
                page.
              </p>
            ) : (
              data.categoryBreakdown.map((c) => (
                <div key={c.name} className="flex items-start gap-3">
                  <span className="text-lg leading-none">{c.icon}</span>
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
                    <span className="text-sm font-medium">{formatMoney(Number(bill.amount), currency)}</span>
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

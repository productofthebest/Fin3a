import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTransferCurrencies } from "@/hooks/use-transfer-currencies";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, Loader2, Plus, ScanLine, Users, X } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/qr-scanner";
import { parseScannedQr } from "@/lib/qr-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createSplitBill,
  getSplitBills,
  lookupRecipient,
  paySplitShare,
  sendSplitReminder,
  type ResolvedParticipant,
} from "@/lib/share-split.functions";
import { billProgress, shareDisplayStatus, type SplitCurrency } from "@/lib/split-bill";
import { pageMeta } from "@/lib/page-meta";
import { cn } from "@/lib/utils";
import { SendToContact } from "@/components/send-to-contact";

const splitQuery = () =>
  queryOptions({ queryKey: ["accounts", "split-bills"], queryFn: () => getSplitBills(), staleTime: 15_000 });

export const Route = createFileRoute("/_authenticated/accounts_/split")({
  head: () => pageMeta("Split bill", "Create shared expenses, split them with other Fin3a users and collect payments."),
  loader: ({ context }) => context.queryClient.ensureQueryData(splitQuery()),
  component: Page,
});

const fmt = (currency: string, amount: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(amount);
const sym = (currency: string) => (currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency);

interface DraftParticipant extends ResolvedParticipant {
  customAmount: string;
}

function Page() {
  const { data } = useSuspenseQuery(splitQuery());
  const queryClient = useQueryClient();
  const lookup = useServerFn(lookupRecipient);
  const createBill = useServerFn(createSplitBill);
  const payShare = useServerFn(paySplitShare);
  const remind = useServerFn(sendSplitReminder);

  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const { options: currencyOptions } = useTransferCurrencies();
  const [currency, setCurrency] = useState<SplitCurrency>("USD");
  useEffect(() => { if (!currencyOptions.includes(currency)) setCurrency(currencyOptions[0] ?? "USD"); }, [currencyOptions, currency]);
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [includeSelf, setIncludeSelf] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["accounts", "split-bills"] });

  async function addParticipantByIdentifier(value: string) {
    setBusy("lookup");
    try {
      const result = await lookup({ data: { identifier: value } });
      if (!result.found) {
        toast.error("No Fin3a wallet found for that ID, email or phone number");
        return;
      }
      if (participants.some((p) => p.user_id === result.participant.user_id)) {
        toast.error("That person is already on the bill");
        return;
      }
      setParticipants((prev) => [...prev, { ...result.participant, customAmount: "" }]);
      setIdentifier("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(null);
    }
  }

  function addParticipant() {
    void addParticipantByIdentifier(identifier);
  }

  function handleScan(text: string) {
    const parsed = parseScannedQr(text);
    if (parsed.kind === "fin3a_profile") {
      setScanning(false);
      void addParticipantByIdentifier(parsed.fin3aId);
      return;
    }
    if (parsed.kind === "fin3a_request") {
      toast.error("That QR code is a payment request, not a person — scan their personal Fin3a QR code");
      return;
    }
    toast.error("That is not a Fin3a QR code");
  }

  async function submit() {
    setBusy("create");
    try {
      await createBill({
        data: {
          title,
          ...(note ? { note } : {}),
          totalAmount: Number(totalAmount),
          currency,
          deadline: deadline || null,
          mode,
          includeSelf,
          participants: participants.map((p) => ({
            userId: p.user_id,
            ...(mode === "custom" ? { customAmount: Number(p.customAmount) } : {}),
          })),
        },
      });
      toast.success("Split bill created — payment requests sent");
      setTitle(""); setTotalAmount(""); setNote(""); setDeadline(""); setParticipants([]);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the bill");
    } finally {
      setBusy(null);
    }
  }

  async function pay(participantId: string) {
    setBusy(participantId);
    try {
      await payShare({ data: { participantId } });
      toast.success("Paid from your Fin3a balance");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendReminder(participantId: string) {
    setBusy(`remind-${participantId}`);
    try {
      await remind({ data: { participantId } });
      toast.success("Reminder recorded — they will see it on their Split Bill page");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reminder");
    } finally {
      setBusy(null);
    }
  }

  const nameFor = (billId: string, userId: string) => {
    const entry = data.directoryByBill[billId]?.find((d) => d.user_id === userId);
    return entry?.display_name || entry?.fin3a_id || "Fin3a user";
  };

  const sharedWithMe = data.memberships.filter((m) => !m.is_creator && m.split_bills);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
        <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Split Bill</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Share an expense with other Fin3a users and collect their shares from their Fin3a balance.
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Create a split bill</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="sb-title">Bill title</Label>
            <Input id="sb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Yellow Chilli" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="sb-total">Total amount</Label>
            <Input id="sb-total" type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="100000" />
          </div>
          <div>
            <Label htmlFor="sb-currency">Currency</Label>
            <select
              id="sb-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as SplitCurrency)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {currencyOptions.map((c) => <option key={c} value={c}>{sym(c)}</option>)}
            </select>
            </div>
          <div>
            <Label htmlFor="sb-deadline">Payment deadline (optional)</Label>
            <Input id="sb-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} min={today} />
          </div>
          <div>
            <Label>Split mode</Label>
            <div className="mt-1 flex gap-2">
              {(["equal", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm capitalize",
                    mode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {m === "equal" ? "Equal split" : "Custom amounts"}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sb-note">Note (optional)</Label>
            <Textarea id="sb-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} />
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <Label htmlFor="sb-identifier">Add participants by Fin3a ID, email or phone number</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="sb-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="FIN-XXXXXXXX, name@email.com or 0801…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addParticipant(); } }}
            />
            <Button type="button" variant="outline" onClick={() => void addParticipant()} disabled={busy === "lookup" || identifier.trim().length < 3}>
              {busy === "lookup" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
            </Button>
            <Button type="button" variant="outline" onClick={() => setScanning(true)} aria-label="Scan a Fin3a QR code to add a participant">
              <ScanLine className="size-4" /> Scan
            </Button>
          </div>
          <SendToContact disabled={busy !== null} recipients={participants} onSelect={value => void addParticipantByIdentifier(value)} />
          {participants.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {participants.map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {p.display_name ?? "Fin3a user"} <span className="font-mono text-xs text-muted-foreground">{p.fin3a_id ?? ""}</span>
                  </span>
                  {mode === "custom" ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.customAmount}
                      onChange={(e) => setParticipants((prev) => prev.map((x) => (x.user_id === p.user_id ? { ...x, customAmount: e.target.value } : x)))}
                      placeholder="Amount"
                      className="w-28"
                      aria-label={`Amount for ${p.display_name ?? p.fin3a_id ?? "participant"}`}
                    />
                  ) : null}
                  <button type="button" aria-label="Remove participant" onClick={() => setParticipants((prev) => prev.filter((x) => x.user_id !== p.user_id))}>
                    <X className="size-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSelf} onChange={(e) => setIncludeSelf(e.target.checked)} className="size-4 accent-primary" />
            Include me as a participant
          </label>
          {mode === "equal" && participants.length > 0 && Number(totalAmount) > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Each of the {participants.length + (includeSelf ? 1 : 0)} participants pays{" "}
              {fmt(currency, Number(totalAmount) / (participants.length + (includeSelf ? 1 : 0)))} (rounding adjusted so shares equal the total).
            </p>
          ) : null}
        </div>

        <Button className="mt-4" onClick={() => void submit()} disabled={busy === "create" || !title.trim() || !(Number(totalAmount) > 0) || participants.length === 0}>
          {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : null} Create split bill
        </Button>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Bills I created</h2>
        {data.created.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">You have not created any split bills yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {data.created.map((bill) => {
              const shares = data.participantsByBill[bill.id] ?? [];
              const progress = billProgress(shares as { amount: number; status: "pending" | "paid"; is_creator: boolean }[]);
              return (
                <div key={bill.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{bill.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(bill.currency, bill.total_amount)} · {bill.status}
                        {bill.deadline ? ` · due ${bill.deadline}` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Collected <span className="font-medium text-foreground">{fmt(bill.currency, progress.collected)}</span>
                      {" · "}Outstanding <span className="font-medium text-foreground">{fmt(bill.currency, progress.outstanding)}</span>
                    </p>
                  </div>
                  <ul className="mt-3 divide-y divide-border">
                    {shares.map((share) => {
                      const status = shareDisplayStatus(share.status as "pending" | "paid", bill.deadline, today);
                      return (
                        <li key={share.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            {share.is_creator ? "You" : nameFor(bill.id, share.user_id)}
                            {share.reminder_count > 0 && share.status === "pending" ? (
                              <span className="ml-2 text-xs text-muted-foreground">reminded {share.reminder_count}×</span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{fmt(bill.currency, share.amount)}</span>
                            <span className={cn(
                              "rounded-md px-2 py-0.5 text-xs",
                              status === "paid" && "bg-primary/10 text-primary",
                              status === "pending" && "bg-secondary text-muted-foreground",
                              status === "overdue" && "bg-destructive/10 text-destructive",
                            )}>
                              {share.is_creator ? "creator" : status}
                            </span>
                            {!share.is_creator && share.status === "pending" ? (
                              <Button variant="ghost" size="sm" disabled={busy === `remind-${share.id}`} onClick={() => void sendReminder(share.id)}>
                                <Bell className="size-3.5" /> Remind
                              </Button>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Bills shared with me</h2>
        {sharedWithMe.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No one has shared a bill with you yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sharedWithMe.map((m) => {
              const bill = m.split_bills!;
              const status = shareDisplayStatus(m.status as "pending" | "paid", bill.deadline, today);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{bill.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Your share: {fmt(bill.currency, m.amount)}
                      {bill.deadline ? ` · due ${bill.deadline}` : ""}
                      {m.last_reminder_at && m.status === "pending" ? " · reminder sent" : ""}
                    </p>
                  </div>
                  {m.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"><Check className="size-3" /> Paid</span>
                  ) : (
                    <Button size="sm" disabled={busy === m.id || bill.status !== "open"} onClick={() => void pay(m.id)}>
                      {busy === m.id ? <Loader2 className="size-4 animate-spin" /> : null}
                      Pay {fmt(bill.currency, m.amount)}
                    </Button>
                  )}
                  {status === "overdue" && m.status === "pending" ? (
                    <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">Overdue</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {scanning ? (
        <QrScanner
          title="Scan to add a participant"
          onScan={handleScan}
          onClose={() => setScanning(false)}
        />
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Payment history</h2>
        {data.transfers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments between Fin3a wallets yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
            {data.transfers.map((t) => {
              const incoming = t.to_user_id === data.me;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{t.reference ?? (incoming ? "Received payment" : "Sent payment")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()} · {t.status}
                    </p>
                  </div>
                  <span className={cn("shrink-0 font-medium", incoming && "text-primary")}>
                    {incoming ? "+" : "−"}{fmt(t.currency, t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
    </div>
  );
}

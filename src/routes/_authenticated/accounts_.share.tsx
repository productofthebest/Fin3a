import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useTransferCurrencies } from "@/hooks/use-transfer-currencies";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { Check, Copy, Loader2, MessageCircle, MessageSquare, Plus, ScanLine, Share2, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrScanner } from "@/components/qr-scanner";
import { parseScannedQr } from "@/lib/qr-payments";
import { getShareProfile, lookupRecipient, shareMoneyByPercent, type ResolvedParticipant } from "@/lib/share-split.functions";
import { fromCents, percentSplit, toCents, type SplitCurrency } from "@/lib/split-bill";
import { pageMeta } from "@/lib/page-meta";
import { SendToContact } from "@/components/send-to-contact";

const shareQuery = () =>
  queryOptions({ queryKey: ["accounts", "share-profile"], queryFn: () => getShareProfile(), staleTime: 60_000 });

export const Route = createFileRoute("/_authenticated/accounts_/share")({
  head: () => pageMeta("Share payment", "Send money to several Fin3a users at once, split by percentage."),
  loader: ({ context }) => context.queryClient.ensureQueryData(shareQuery()),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(shareQuery());
  const [copied, setCopied] = useState<string | null>(null);
  const payLink = data.fin3aId ? `${window.location.origin}/pay/${data.fin3aId}` : null;
  const shareText = data.fin3aId
    ? `Pay me on Fin3a — ${data.displayName ?? "Fin3a user"} (${data.fin3aId}). ${payLink}`
    : null;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — long-press to copy manually");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
        <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Share Payment</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Send money from your Fin3a balance to several Fin3a users at once, split by percentage.
      </p>

      <ShareMoney />

      <h2 className="mt-10 font-display text-xl font-semibold">Receive money</h2>

      <section className="mt-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Wallet name</p>
            <p className="mt-1 font-display text-xl font-semibold">{data.displayName ?? "Fin3a user"}</p>
            <p className="mt-4 text-xs text-muted-foreground">Your unique Fin3a wallet ID</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-primary">{data.fin3aId ?? "Unavailable"}</p>
            {payLink ? (
              <>
                <p className="mt-4 text-xs text-muted-foreground">Payment link</p>
                <p className="mt-1 break-all rounded-md bg-secondary p-2 font-mono text-xs">{payLink}</p>
              </>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!data.fin3aId} onClick={() => copy("Wallet ID", data.fin3aId!)}>
                {copied === "Wallet ID" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy ID
              </Button>
              <Button variant="outline" size="sm" disabled={!payLink} onClick={() => copy("Payment link", payLink!)}>
                {copied === "Payment link" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link
              </Button>
              <Button variant="outline" size="sm" disabled={!shareText} onClick={() => copy("Wallet details", shareText!)}>
                {copied === "Wallet details" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy details
              </Button>
            </div>
          </div>
          {payLink ? (
            <div className="mx-auto rounded-xl border border-border bg-white p-4">
              <QRCode value={payLink} size={140} />
              <p className="mt-2 text-center text-xs text-muted-foreground">Scan to pay</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Share through your apps</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" disabled={!shareText}>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText ?? "")}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!shareText}>
            <a href={`sms:?&body=${encodeURIComponent(shareText ?? "")}`}>
              <MessageSquare className="size-4" /> SMS
            </a>
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!shareText}
              onClick={() => void navigator.share({ title: "Pay me on Fin3a", text: shareText!, ...(payLink ? { url: payLink } : {}) }).catch(() => {})}
            >
              <Share2 className="size-4" /> More apps
            </Button>
          ) : null}
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Only your name, Fin3a ID and payment link are shared. Your balance, transactions, phone number and sign-in
          details are never visible to people you share with. Incoming payments appear in your account activity.
        </p>
      </div>
    </main>
    </div>
  );
}

const fmt = (currency: string, amount: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(amount);
const sym = (currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;

function ShareMoney() {
  const lookup = useServerFn(lookupRecipient);
  const send = useServerFn(shareMoneyByPercent);
  const [total, setTotal] = useState("");
  const { options: currencyOptions } = useTransferCurrencies();
  const [currency, setCurrency] = useState<SplitCurrency>("USD");
  useEffect(() => { setCurrency(currencyOptions[0] ?? "USD"); }, [currencyOptions.join("|")]);
  const [note, setNote] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [people, setPeople] = useState<(ResolvedParticipant & { percent: string })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function add(value: string) {
    setBusy("lookup");
    try {
      const r = await lookup({ data: { identifier: value } });
      if (!r.found) return void toast.error("No Fin3a wallet found for that ID, email or phone number");
      if (people.some((p) => p.user_id === r.participant.user_id)) return void toast.error("That person is already added");
      setPeople((prev) => {
        const next = [...prev, { ...r.participant, percent: "" }];
        const even = Math.floor(10000 / next.length) / 100;
        return next.map((p, i) => ({ ...p, percent: String(i === 0 ? +(100 - even * (next.length - 1)).toFixed(2) : even) }));
      });
      setIdentifier("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(null);
    }
  }

  function handleScan(text: string) {
    const parsed = parseScannedQr(text);
    if (parsed.kind === "fin3a_profile") { setScanning(false); void add(parsed.fin3aId); return; }
    if (parsed.kind === "fin3a_request") return void toast.error("That is a payment request — scan the person's personal Fin3a QR code");
    toast.error("That is not a Fin3a QR code");
  }

  const totalNum = Number(total);
  const percentSum = people.reduce((a, p) => a + (Number(p.percent) || 0), 0);
  const split = totalNum > 0 && people.length ? percentSplit(toCents(totalNum), people.map((p) => Number(p.percent))) : null;
  const splitError = typeof split === "string" ? split : null;

  async function submit() {
    setBusy("send");
    try {
      const { results } = await send({
        data: { currency, totalAmount: totalNum, ...(note ? { reference: note } : {}), recipients: people.map((p) => ({ userId: p.user_id, percent: Number(p.percent) })) },
      });
      const ok = results.filter((r) => r.status === "completed");
      const failed = results.filter((r) => r.status !== "completed");
      if (ok.length) toast.success(`Sent to ${ok.length} ${ok.length === 1 ? "person" : "people"}`);
      if (failed.length) toast.error(`${failed.length} not sent: ${failed[0]!.reason ?? "payment failed"}`);
      if (!failed.length) { setPeople([]); setTotal(""); setNote(""); }
      else setPeople((prev) => prev.filter((p) => failed.some((f) => f.userId === p.user_id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Send to multiple people</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="sh-total">Total amount</Label>
          <Input id="sh-total" type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="100000" />
        </div>
        <div>
          <Label htmlFor="sh-currency">Currency</Label>
          <select id="sh-currency" value={currency} onChange={(e) => setCurrency(e.target.value as SplitCurrency)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {currencyOptions.map((c) => <option key={c} value={c}>{sym(c)}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="sh-note">Note (optional)</Label>
          <Input id="sh-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. Family support" />
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <Label htmlFor="sh-identifier">Add people by Fin3a ID, email or phone number</Label>
        <div className="mt-1 flex gap-2">
          <Input id="sh-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="FIN-XXXXXXXX, name@email.com or 0801…"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(identifier); } }} />
          <Button type="button" variant="outline" onClick={() => void add(identifier)} disabled={busy === "lookup" || identifier.trim().length < 3}>
            {busy === "lookup" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
          </Button>
          <Button type="button" variant="outline" onClick={() => setScanning(true)} aria-label="Scan a Fin3a QR code to add a person">
            <ScanLine className="size-4" /> Scan
          </Button>
        </div>
        <SendToContact disabled={busy !== null} recipients={people} onSelect={value => void add(value)} />
        {people.length ? (
          <ul className="mt-3 space-y-2">
            {people.map((p, i) => (
              <li key={p.user_id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {p.display_name ?? "Fin3a user"} <span className="font-mono text-xs text-muted-foreground">{p.fin3a_id ?? ""}</span>
                </span>
                {Array.isArray(split) ? <span className="text-xs text-muted-foreground">{fmt(currency, fromCents(split[i]!))}</span> : null}
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" max="100" step="0.01" value={p.percent} className="w-20"
                    aria-label={`Percentage for ${p.display_name ?? p.fin3a_id ?? "person"}`}
                    onChange={(e) => setPeople((prev) => prev.map((x) => (x.user_id === p.user_id ? { ...x, percent: e.target.value } : x)))} />
                  <span className="text-muted-foreground">%</span>
                </div>
                <button type="button" aria-label="Remove person" onClick={() => setPeople((prev) => prev.filter((x) => x.user_id !== p.user_id))}>
                  <X className="size-4 text-muted-foreground hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {people.length ? (
          <p className={`mt-2 text-xs ${splitError ? "text-destructive" : "text-muted-foreground"}`}>
            Total: {+percentSum.toFixed(2)}%{splitError ? ` — ${splitError}` : ""}
          </p>
        ) : null}
      </div>

      <Button className="mt-4" onClick={() => void submit()} disabled={busy === "send" || !Array.isArray(split)}>
        {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : null} Send {totalNum > 0 ? fmt(currency, totalNum) : ""}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">Money moves only between Fin3a balances. Each person's transfer is checked against your balance separately.</p>

      {scanning ? <QrScanner title="Scan to add a person" onScan={handleScan} onClose={() => setScanning(false)} /> : null}
    </section>
  );
}

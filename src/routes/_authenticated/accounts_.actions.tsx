import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { ShieldCheck, QrCode, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { parseCryptoQr, type CryptoQr } from "@/lib/crypto-qr";
import { CryptoQrReview } from "@/components/crypto-qr-review";

const Scanner = lazy(() => import("@/components/qr-scanner").then(m => ({ default: m.QrScanner })));
const overview = queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
export const Route = createFileRoute("/_authenticated/accounts_/actions")({
  head: () => pageMeta("Account details & payments", "Securely review your Fin3a balances, crypto deposit availability and NGN bank or USDC/USDT withdrawals."),
  loader: ({ context }) => context.queryClient.ensureQueryData(overview),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(overview);
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [asset, setAsset] = useState<"USDC" | "USDT">("USDC");
  const [scanning, setScanning] = useState(false);
  const [review, setReview] = useState<CryptoQr | null>(null);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState("");
  function scan(text: string) {
    setScanning(false);
    const result = parseCryptoQr(text);
    setReview(result);
    setPayload("");
    setError(result ? "" : "This is not a supported crypto address format, or its checksum is invalid.");
  }
  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Accounts</Link></Button>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">Your account</h1>
      <dl className="my-6 divide-y divide-border text-sm">{data.accounts.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3"><dt>{a.currency === "NGN" ? "₦" : a.currency === "USD" ? "$" : a.currency} available balance</dt><dd className="break-all font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: a.currency, currencyDisplay: "narrowSymbol" }).format(a.balance.available)}</dd></div>)}</dl>
      <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Account action">{(["deposit", "withdraw"] as const).map(v => <Button key={v} variant={mode === v ? "default" : "outline"} aria-pressed={mode === v} onClick={() => setMode(v)}>{v === "deposit" ? "Deposit" : "Withdraw"}</Button>)}</div>
      <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Balance currency">{(["NGN", "USD"] as const).map(v => <Button key={v} variant={currency === v ? "default" : "outline"} aria-pressed={currency === v} onClick={() => setCurrency(v)}>{v === "NGN" ? "₦" : "$"}</Button>)}</div>
      <h2 className="mb-3 font-display text-xl font-semibold">{mode === "deposit" ? currency === "NGN" ? "NGN top-up" : "Crypto deposit" : currency === "NGN" ? "Bank withdrawal" : "USD withdrawal"}</h2>
      {mode === "withdraw" && currency === "USD" && <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Withdrawal stablecoin">{(["USDC", "USDT"] as const).map(v => <Button key={v} variant={asset === v ? "default" : "outline"} aria-pressed={asset === v} onClick={() => setAsset(v)}>{v}</Button>)}</div>}
      <div role="status" className="space-y-3 text-sm text-muted-foreground">
        <p>{mode === "deposit" ? currency === "NGN" ? "Bank transfer instructions are not available yet. No bank account number has been issued." : "Crypto deposits convert directly to the receiving balance selected for that individual deposit. Coins, networks, rates and receiving currencies must be confirmed by the payment provider." : currency === "NGN" ? "Bank withdrawals are not available yet. Bank details will be entered here, not in AI chat, once payments are verified." : `${asset} withdrawals are not available yet. Network support, the rate and all charges must be verified before you confirm.`}</p>
        <p>{currency === "NGN" ? "NGN bank top-up / withdrawal fee: ₦50, deducted from the credited amount / payout." : mode === "deposit" ? "Crypto conversion fee: 1% below $5,000; 0.5% at or above $5,000, for all supported crypto." : "USD withdrawal fee: 1% below $5,000; 0.5% at or above $5,000."}</p>
        <p>Rate and third-party / network charges: unavailable. No funds will move without a verified quote and confirmation.</p>
      </div>
      <Button className="mt-5 w-full" disabled>{mode === "deposit" ? "Deposit unavailable" : "Withdrawal unavailable"}</Button>
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="font-display text-lg font-semibold">Review a crypto QR</h2>
        <Button className="mt-3" variant="outline" onClick={() => setScanning(true)}><QrCode className="size-4" />Scan crypto QR</Button>
        <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); scan(payload); }}>
          <Label htmlFor="crypto-payload">Crypto address or payment URI</Label>
          <Input id="crypto-payload" value={payload} maxLength={2048} autoComplete="off" spellCheck={false} onChange={e => setPayload(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!payload.trim()}>Review address</Button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Never enter passwords, verification codes, private keys or recovery phrases. An external QR is not a Fin3a deposit address.</p>
      </section>
    </main>
    <CryptoQrReview value={review} onClose={() => setReview(null)} />
    {scanning && <Suspense fallback={<Loader2 className="size-5 animate-spin" />}><Scanner title="Scan crypto address" onScan={scan} onClose={() => setScanning(false)} /></Suspense>}
  </div>;
}
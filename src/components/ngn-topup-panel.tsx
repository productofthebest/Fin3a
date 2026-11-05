import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkNgnTopup, createNgnTopup, getLatestTopup, type TopupView } from "@/lib/ngn-topup.functions";

const naira = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" }).format(n);

export function NgnTopupPanel() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [topup, setTopup] = useState<TopupView | null>(null);
  const [busy, setBusy] = useState(false);
  const active = topup && topup.status === "awaiting" && new Date(topup.expiresAt).getTime() > Date.now();

  useEffect(() => { void getLatestTopup().then(t => { if (t && t.status === "awaiting" && new Date(t.expiresAt).getTime() > Date.now()) setTopup(t); }).catch(() => {}); }, []);

  async function create() {
    setBusy(true);
    try { setTopup(await createNgnTopup({ data: { amount: Number(amount) } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Top-up could not be started."); }
    finally { setBusy(false); }
  }
  async function check() {
    if (!topup) return;
    setBusy(true);
    try {
      const r = await checkNgnTopup({ data: { txRef: topup.txRef } });
      if (r.status === "credited") { toast.success("Payment received. Your NGN wallet has been credited."); setTopup(null); setAmount(""); await qc.invalidateQueries({ queryKey: ["accounts"] }); }
      else if (r.status === "rejected") { toast.error("Payment was too small to credit after the fee. Contact support."); setTopup(null); }
      else toast("Payment not received yet. Bank transfers can take a few minutes.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not check payment."); }
    finally { setBusy(false); }
  }

  if (active && topup) return <div className="space-y-4 text-sm">
    <p className="text-muted-foreground">Transfer exactly <strong className="text-foreground">{naira(topup.amount)}</strong> from your bank app to this one-time account:</p>
    <dl className="divide-y divide-border rounded-lg border border-border bg-card">
      <div className="flex justify-between gap-2 p-3"><dt className="text-muted-foreground">Bank</dt><dd className="font-semibold">{topup.bankName}</dd></div>
      <div className="flex items-center justify-between gap-2 p-3"><dt className="text-muted-foreground">Account number</dt><dd className="flex items-center gap-2 font-semibold tracking-wider">{topup.accountNumber}<Button size="icon" variant="ghost" aria-label="Copy account number" onClick={() => { void navigator.clipboard?.writeText(topup.accountNumber); toast.success("Copied"); }}><Copy className="size-4" /></Button></dd></div>
      <div className="flex justify-between gap-2 p-3"><dt className="text-muted-foreground">You receive</dt><dd className="font-semibold">{naira(topup.amount - topup.fee)}</dd></div>
      <div className="flex justify-between gap-2 p-3"><dt className="text-muted-foreground">Expires</dt><dd>{new Date(topup.expiresAt).toLocaleString()}</dd></div>
    </dl>
    <p className="text-xs text-muted-foreground">This account works for this top-up only. Your wallet is credited only after the bank payment is confirmed.</p>
    <Button className="w-full" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "I've sent the money"}</Button>
    <Button className="w-full" variant="outline" disabled={busy} onClick={() => setTopup(null)}>Start a new top-up</Button>
  </div>;

  const n = Number(amount);
  return <div className="space-y-3 text-sm">
    <Label htmlFor="topup-amount">Amount to send (₦)</Label>
    <Input id="topup-amount" type="number" min="100" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Minimum ₦100" />
    <p className="text-muted-foreground">Fee: ₦50, deducted from the credited amount.{n > 50 ? ` You receive ${naira(n - 50)}.` : ""}</p>
    <Button className="w-full" disabled={busy || !(n >= 100)} onClick={() => void create()}>{busy ? "Creating account…" : "Get bank account number"}</Button>
  </div>;
}

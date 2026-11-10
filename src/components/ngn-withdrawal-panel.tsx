import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNigerianBanks, verifyBankAccount } from "@/lib/bank-transfer.functions";
import { checkNgnWithdrawal, createNgnWithdrawal, getRecentWithdrawals } from "@/lib/ngn-withdrawal.functions";
import { useQuery } from "@tanstack/react-query";

const ngn = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" }).format(n);
const FEE = 50;

export function NgnWithdrawalPanel({ available }: { available: number }) {
  const qc = useQueryClient();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const bankCode = banks.find(b => b.name.toLowerCase() === bankName.trim().toLowerCase())?.code;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 100 && value <= 5000000 && value > FEE && value <= available;

  const { data: recent } = useQuery({ queryKey: ["ngn-withdrawals"], queryFn: () => getRecentWithdrawals(), staleTime: 15_000 });

  async function loadBanks() {
    if (banks.length) return;
    const r = await getNigerianBanks();
    if (r.error) toast.error(r.error); else setBanks(r.banks);
  }
  async function checkAccount() {
    if (!bankCode) return;
    setBusy(true);
    try {
      const r = await verifyBankAccount({ data: { accountNumber, bankCode } });
      if (r.found) setAccountName(r.accountName); else toast.error(r.error);
    } catch { toast.error("We couldn't confirm this account. Please try again."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!bankCode || !accountName || !valid || busy) return;
    setBusy(true);
    try {
      const r = await createNgnWithdrawal({ data: { amount: value, bankCode, bankName: bankName.trim(), accountNumber, idempotencyKey: crypto.randomUUID() } });
      const ref = "reference" in r && typeof r.reference === "string" ? r.reference : null;
      if (!r.ok || !ref) { toast.error(r.error); setConfirming(false); return; }
      setReference(ref);
      setConfirming(false);
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["ngn-withdrawals"] });
      toast.success("Withdrawal started. We'll confirm when your bank receives it.");
    } catch { toast.error("Withdrawal could not be started. No money was moved."); setConfirming(false); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!reference || busy) return;
    setBusy(true);
    try {
      const r = await checkNgnWithdrawal({ data: { reference } });
      setFinalStatus(r.status);
      if (r.status !== "pending") {
        await qc.invalidateQueries({ queryKey: ["accounts"] });
        await qc.invalidateQueries({ queryKey: ["ngn-withdrawals"] });
      }
    } catch { toast.error("Status check failed. Please try again."); }
    finally { setBusy(false); }
  }

  if (reference) {
    const status = finalStatus ?? "pending";
    return <div className="space-y-4" role="status">
      <p className="text-sm font-medium">{status === "successful" ? "Withdrawal completed. Your bank has received the money." : status === "failed" ? "The payout failed. Your wallet was not charged." : "Withdrawal in progress. Most bank payouts complete within minutes."}</p>
      {status === "pending" && <Button variant="outline" className="w-full" disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Check status"}</Button>}
      {status !== "pending" && <Button variant="outline" className="w-full" onClick={() => { setReference(null); setFinalStatus(null); setAmount(""); setAccountName(null); setAccountNumber(""); setBankName(""); }}>New withdrawal</Button>}
      <RecentWithdrawals rows={recent ?? []} />
    </div>;
  }

  if (confirming) {
    return <div className="space-y-4">
      <dl className="space-y-3 text-sm">
        <div><dt className="text-muted-foreground">Bank</dt><dd className="break-words">{bankName}</dd></div>
        <div><dt className="text-muted-foreground">Account</dt><dd className="break-words">{accountName} · {accountNumber}</dd></div>
        <div><dt className="text-muted-foreground">Amount</dt><dd>{ngn(value)}</dd></div>
        <div><dt className="text-muted-foreground">Fin3a fee</dt><dd>{ngn(FEE)}</dd></div>
        <div><dt className="text-muted-foreground">Your bank receives</dt><dd className="font-semibold">{ngn(value - FEE)}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Withdrawals are limited to your own verified bank account. Fin3a's verified legal-name matching is not yet available, so submission is disabled.</p>
      <Button className="w-full" disabled>Withdrawal unavailable pending identity verification</Button>
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
    </div>;
  }

  return <div className="space-y-4">
    <div>
      <Label htmlFor="wd-bank">Bank</Label>
      <Input id="wd-bank" list="wd-ng-banks" value={bankName} onChange={e => { setBankName(e.target.value); setAccountName(null); }} onFocus={() => void loadBanks()} maxLength={80} placeholder={banks.length ? "Search your bank" : "Loading banks…"} />
      <datalist id="wd-ng-banks">{banks.map(b => <option key={b.code} value={b.name} />)}</datalist>
    </div>
    <div>
      <Label htmlFor="wd-account">Account number</Label>
      <Input id="wd-account" inputMode="numeric" value={accountNumber} onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setAccountName(null); }} placeholder="10 digits" />
    </div>
    <Button variant="outline" disabled={busy || !bankCode || accountNumber.length !== 10} onClick={() => void checkAccount()}>{busy ? "Checking…" : "Confirm account name"}</Button>
    {accountName && <p role="status" className="break-words text-sm font-medium">{accountName}</p>}
    <div>
      <Label htmlFor="wd-amount">Amount (₦)</Label>
      <Input id="wd-amount" type="number" min="100" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
    </div>
    <p className="text-xs text-muted-foreground">Fee: ₦50, deducted from the payout. Your bank receives {ngn(valid ? value - FEE : 0)}. The account name is confirmed before any money moves.</p>
    <p className="text-xs text-muted-foreground">Withdrawals are only for a bank account belonging to you. Third-party beneficiary accounts are not allowed. Submission remains unavailable until Fin3a can compare the bank account holder with your verified identity.</p>
    <Button className="w-full" disabled>Withdrawal unavailable pending identity verification</Button>
    <RecentWithdrawals rows={recent ?? []} />
  </div>;
}

function RecentWithdrawals({ rows }: { rows: { reference: string; amount: number; bankName: string; status: string; createdAt: string }[] }) {
  if (!rows.length) return null;
  return <section className="mt-6 border-t border-border pt-4" aria-labelledby="recent-wd-heading">
    <h3 id="recent-wd-heading" className="mb-2 text-sm font-semibold">Recent withdrawals</h3>
    <ul className="divide-y divide-border text-sm">
      {rows.map(w => <li key={w.reference} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span className="min-w-0 flex-1 truncate">{w.bankName}</span>
        <span className="tabular-nums">{ngn(w.amount)}</span>
        <span className={`text-xs ${w.status === "successful" ? "text-primary" : w.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{w.status}</span>
      </li>)}
    </ul>
  </section>;
}

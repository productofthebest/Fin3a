import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lookupRecipient, sendTransfer, type ResolvedParticipant } from "@/lib/share-split.functions";
import { canTransfer } from "@/lib/account-transfer";
import { getNigerianBanks, verifyBankAccount } from "@/lib/bank-transfer.functions";
import { createNgnWithdrawal } from "@/lib/ngn-withdrawal.functions";
import { SendToContact } from "@/components/send-to-contact";
import { getBankPayoutCapability } from "@/lib/flutterwave-capabilities";

export function AccountTransferDialog({ open, onOpenChange, balances, country }: { open: boolean; onOpenChange: (open: boolean) => void; balances: { currency: string; balance: { available: number } }[]; country: string }) {
  const qc = useQueryClient();
  const options = [...new Set(balances.map(a => a.currency))];
  const local = balances.find(a => a.currency !== "NGN" && a.currency !== "USD")?.currency;
  const [selectedCurrency, setCurrency] = useState<string>(options[0] ?? "USD");
  const currency = options.includes(selectedCurrency) ? selectedCurrency : (options[0] ?? "USD");
  const currencyTransferEnabled = currency === "NGN" || currency === "USD";
  const [identifier, setIdentifier] = useState("");
  const [recipient, setRecipient] = useState<ResolvedParticipant | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedMode, setMode] = useState<"fin3a" | "bank" | "international" | null>(null);
  const mode = selectedMode;
  const countryCode = country.trim().toUpperCase();
  const payout = getBankPayoutCapability(countryCode);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [accountName, setAccountName] = useState<string | null>(null);
  const bankCode = banks.find(b => b.name.toLowerCase() === bankName.trim().toLowerCase())?.code;
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
  const available = balances.find(a => a.currency === currency)?.balance.available ?? 0;
  const money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(n);
  const valid = currencyTransferEnabled && canTransfer(Number(amount), available, recipient ? 1 : 0);
  const bankValue = Number(amount);
  const bankValid = Number.isFinite(bankValue) && bankValue >= 100 && bankValue <= 5000000 && bankValue > 50 && bankValue <= available && Boolean(accountName);

  async function bankTransfer() {
    if (!bankCode || !accountName || !bankValid || busy) return;
    setBusy(true);
    try {
      const r = await createNgnWithdrawal({ data: { amount: bankValue, bankCode, bankName: bankName.trim(), accountNumber, idempotencyKey: crypto.randomUUID() } });
      if (!r.ok) { toast.error(r.error); setConfirming(false); return; }
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Bank transfer started. We'll confirm when the bank receives it.");
      setAmount(""); setAccountName(null); setAccountNumber(""); setBankName(""); setConfirming(false); onOpenChange(false);
    } catch { toast.error("Transfer could not be started. No money was moved."); setConfirming(false); }
    finally { setBusy(false); }
  }

  async function findRecipient(value = identifier) {
    setRecipient(null);
    setBusy(true);
    try {
      const result = await lookupRecipient({ data: { identifier: value } });
      if (!result.found) { toast.error("No Fin3a user found."); return; }
      setRecipient(result.participant);
    } catch { toast.error("Could not find this Fin3a user. Please try again."); }
    finally { setBusy(false); }
  }

  async function transfer() {
    if (!recipient || !valid || busy) return;
    setBusy(true);
    try {
      await sendTransfer({ data: { toUserId: recipient.user_id, currency: currency as "NGN" | "USD", amount: Number(amount) } });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transfer completed.");
      setAmount(""); setRecipient(null); setIdentifier(""); setConfirming(false); onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Transfer could not be completed."); setConfirming(false); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) { setConfirming(false); onOpenChange(value); } }}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>{confirming ? "Confirm transfer" : "Transfer"}</DialogTitle><DialogDescription>{mode === "bank" ? "Send from your NGN wallet to a Nigerian bank account." : mode === "international" ? "Choose a supported payout route for your country." : "Send to another Fin3a user."}</DialogDescription></DialogHeader>
      {!confirming && <div className="grid grid-cols-2 gap-3" role="group" aria-label="Transfer destination">
        <button type="button" aria-pressed={mode === "fin3a"} onClick={() => setMode("fin3a")} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "fin3a" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">F</span><span className="text-xs text-muted-foreground">{mode === "fin3a" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">Fin3a user</span><span className="mt-1 block text-xs text-muted-foreground">Send to another Fin3a account</span>
        </button>
        {countryCode === "NG" && <button type="button" aria-pressed={mode === "bank"} onClick={() => { setMode("bank"); setCurrency("NGN"); }} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "bank" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">₦</span><span className="text-xs text-muted-foreground">{mode === "bank" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">NGN Banks</span><span className="mt-1 block text-xs text-muted-foreground">Pay out to Nigerian bank accounts</span>
        </button>}
        {countryCode !== "NG" && payout && <button type="button" aria-pressed={mode === "international"} onClick={() => setMode("international")} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "international" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">{payout.currency}</span><span className="text-xs text-muted-foreground">{mode === "international" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">{payout.name} payout</span><span className="mt-1 block text-xs text-muted-foreground">Local bank transfer in {payout.currency}</span>
        </button>}
      </div>}
      {mode === "international" && !confirming ? <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="International payout options">
        <h3 className="font-semibold">{payout?.name} · {payout?.currency}</h3>
        <button type="button" className="flex w-full items-center justify-between rounded-xl border border-primary bg-primary/5 p-4 text-left" aria-pressed="true">
          <span><span className="block text-sm font-semibold">Bank account payout</span><span className="mt-1 block text-xs text-muted-foreground">Local bank transfer in {payout?.currency}</span></span><span className="text-xs text-muted-foreground">Selected</span>
        </button>
        <p className="text-xs text-muted-foreground">This destination is not available for transfers yet, so a transfer cannot be submitted from this option.</p>
      </section> : mode === "bank" && !confirming ? <>
        <p className="text-sm text-muted-foreground">Available: {new Intl.NumberFormat("en", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" }).format(balances.find(a => a.currency === "NGN")?.balance.available ?? 0)}</p>
        <Label htmlFor="bank-name">Bank</Label>
        <Input id="bank-name" list="ng-banks" value={bankName} onChange={e => { setBankName(e.target.value); setAccountName(null); }} onFocus={() => void loadBanks()} maxLength={80} placeholder={banks.length ? "Search your bank" : "Loading banks…"} />
        <datalist id="ng-banks">{banks.map(b => <option key={b.code} value={b.name} />)}</datalist>
        <Label htmlFor="bank-account">Account number</Label>
        <Input id="bank-account" inputMode="numeric" value={accountNumber} onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setAccountName(null); }} placeholder="10 digits" />
        <Button variant="outline" disabled={busy || !bankCode || accountNumber.length !== 10} onClick={() => void checkAccount()}>{busy ? "Checking…" : "Confirm account name"}</Button>
        {accountName && <p role="status" className="break-words text-sm font-medium">{accountName}</p>}
        <Label htmlFor="bank-amount">Amount (₦)</Label>
        <Input id="bank-amount" type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <p className="text-xs text-muted-foreground">Fee: ₦50, deducted from the amount sent. The account name is confirmed before you send.</p>
        <Button disabled={busy || !bankValid} onClick={() => setConfirming(true)}>Review bank transfer</Button>
      </> : confirming && mode === "bank" ? <>
        <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Bank</dt><dd className="break-words">{bankName}</dd></div><div><dt className="text-muted-foreground">Account</dt><dd className="break-words">{accountName} · {accountNumber}</dd></div><div><dt className="text-muted-foreground">Amount</dt><dd>{money(bankValue)}</dd></div><div><dt className="text-muted-foreground">Fin3a fee</dt><dd>{money(50)}</dd></div><div><dt className="text-muted-foreground">Bank receives</dt><dd className="font-semibold">{money(bankValue - 50)}</dd></div></dl>
        <Button disabled={busy || !bankValid} onClick={() => void bankTransfer()}>{busy ? "Sending…" : "Confirm bank transfer"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
      </> : confirming ? <>
        <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Recipient</dt><dd className="break-words">{recipient?.display_name ?? "Fin3a user"} · {recipient?.fin3a_id}</dd></div><div><dt className="text-muted-foreground">Amount</dt><dd>{money(Number(amount))}</dd></div><div><dt className="text-muted-foreground">Fin3a fee</dt><dd>{money(0)}</dd></div></dl>
        <Button disabled={busy || !valid} onClick={() => void transfer()}>{busy ? "Sending…" : "Confirm transfer"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
      </> : mode === "fin3a" ? <>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transfer currency">{options.map(c => <Button key={c} variant={currency === c ? "default" : "outline"} aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c}</Button>)}</div>
        {!currencyTransferEnabled && <p role="status" className="text-xs text-muted-foreground">{currency} Fin3a-user transfers are not activated yet. The wallet is visible, but sending is disabled until the currency is supported by the secure ledger transfer function.</p>}
        {local && <p className="text-xs text-muted-foreground">{local} bank payouts and transfers are being added; provider country coverage alone does not activate them.</p>}
        <p className="text-sm text-muted-foreground">Available: {money(available)}</p>
        <Label htmlFor="transfer-recipient">Fin3a ID, email or phone number</Label>
        <Input id="transfer-recipient" value={identifier} onChange={e => { setIdentifier(e.target.value); setRecipient(null); }} maxLength={254} />
        <Button variant="outline" disabled={busy || identifier.trim().length < 3} onClick={() => void findRecipient()}>{busy ? "Finding…" : "Find user"}</Button>
        <SendToContact disabled={busy} recipients={recipient ? [recipient] : []} onSelect={value => { setIdentifier(value); void findRecipient(value); }} />
        {recipient && <p role="status" className="break-words text-sm">{recipient.display_name ?? "Fin3a user"} · {recipient.fin3a_id}</p>}
        <Label htmlFor="transfer-amount">Amount ({currency === "NGN" ? "₦" : "$"})</Label>
        <Input id="transfer-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button disabled={busy || !valid} onClick={() => setConfirming(true)}>Review transfer</Button>
      </> : null}
    </DialogContent>
  </Dialog>;
}
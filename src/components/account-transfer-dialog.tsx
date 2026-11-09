import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lookupRecipient, sendTransfer, type ResolvedParticipant } from "@/lib/share-split.functions";
import { canTransfer } from "@/lib/account-transfer";
import { getNigerianBanks, verifyBankAccount } from "@/lib/bank-transfer.functions";
import { createNgnWithdrawal } from "@/lib/ngn-withdrawal.functions";
import { SendToContact } from "@/components/send-to-contact";
import { accountCurrencies } from "@/lib/country-currency";
import { getBankPayoutCapability } from "@/lib/flutterwave-capabilities";

export function AccountTransferDialog({ open, onOpenChange, balances, country }: { open: boolean; onOpenChange: (open: boolean) => void; balances: { currency: string; balance: { available: number } }[]; country: string }) {
  const qc = useQueryClient();
  const countryCode = country.trim().toUpperCase();
  const availableCurrencies = new Set(balances.map(account => account.currency));
  const options = accountCurrencies(countryCode).filter(currency => availableCurrencies.has(currency));
  const [selectedCurrency, setCurrency] = useState<string>(options[0] ?? "USD");
  const currency = options.includes(selectedCurrency) ? selectedCurrency : (options[0] ?? "USD");
  const currencyTransferEnabled = options.includes(currency) && /^[A-Z]{3}$/.test(currency);
  const [identifier, setIdentifier] = useState("");
  const [recipient, setRecipient] = useState<ResolvedParticipant | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedMode, setMode] = useState<"fin3a" | "bank" | "local_bank" | null>(null);
  const mode = selectedMode;
  const localBankCapability = countryCode === "NG" ? null : getBankPayoutCapability(countryCode);
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
      await sendTransfer({ data: { toUserId: recipient.user_id, currency, amount: Number(amount) } });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transfer completed.");
      setAmount(""); setRecipient(null); setIdentifier(""); setConfirming(false); onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Transfer could not be completed."); setConfirming(false); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) { setConfirming(false); onOpenChange(value); } }}>
    <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-h-[100dvh] max-w-none translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none border-0 p-4 sm:max-w-none">
      <DialogHeader><DialogTitle>{confirming ? "Confirm transfer" : "Transfer"}</DialogTitle><DialogDescription>{mode === "bank" ? "Send from your NGN wallet to a Nigerian bank account." : mode === "local_bank" ? "Local bank transfers for your country." : "Send to another Fin3a user."}</DialogDescription></DialogHeader>
      {!confirming && <div className="grid grid-cols-2 gap-3" role="group" aria-label="Transfer destination">
        <button type="button" aria-pressed={mode === "fin3a"} onClick={() => setMode("fin3a")} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "fin3a" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">F</span><span className="text-xs text-muted-foreground">{mode === "fin3a" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">Fin3a user</span><span className="mt-1 block text-xs text-muted-foreground">Send to another Fin3a account</span>
        </button>
        {countryCode === "NG" && <button type="button" aria-pressed={mode === "bank"} onClick={() => { setMode("bank"); setCurrency("NGN"); }} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "bank" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">₦</span><span className="text-xs text-muted-foreground">{mode === "bank" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">NGN Banks</span><span className="mt-1 block text-xs text-muted-foreground">Pay out to Nigerian bank accounts</span>
        </button>}
        {localBankCapability && <button type="button" aria-pressed={mode === "local_bank"} onClick={() => setMode("local_bank")} className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (mode === "local_bank" ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="flex w-full items-center justify-between"><span className="text-lg font-semibold text-primary">{localBankCapability.currency}</span><span className="text-xs text-muted-foreground">{mode === "local_bank" ? "Selected" : "Tap to select"}</span></span>
          <span className="mt-3 block text-sm font-semibold">Local bank transfer</span><span className="mt-1 block text-xs text-muted-foreground">Send to a {localBankCapability.name} bank account</span>
        </button>}
      </div>}
      {mode === "local_bank" && !confirming ? <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Local bank transfer availability">
        <p className="font-medium">{localBankCapability?.name} · {localBankCapability?.currency}</p>
        <p className="text-sm text-muted-foreground">Flutterwave documents bank payouts for this destination. Fin3a has not yet completed production merchant-route approval, settlement verification, country-specific bank-code validation and reconciliation testing for this route.</p>
        <p className="text-sm text-muted-foreground">Bank details and transfer submission will become available only after those checks are completed. No money can be moved through this option yet.</p>
        <Button variant="outline" disabled>Local bank transfer not yet enabled</Button>
      </section> : null}
      {mode === "bank" && !confirming ? <>
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
        <div className="flex items-center gap-3">{options.length > 1 ? <div className="w-36 shrink-0"><Label htmlFor="transfer-currency" className="sr-only">Transfer currency</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger id="transfer-currency" aria-label="Transfer currency" className="h-10"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div> : options.length === 1 ? <div className="rounded-md border border-border px-3 py-2 text-sm" aria-label="Transfer currency">{options[0]}</div> : <p role="status" className="text-sm text-muted-foreground">No supported fiat wallet is available for transfer.</p>}<p className="text-sm text-muted-foreground">Available: {money(available)}</p></div>
        {!currencyTransferEnabled && <p role="status" className="text-xs text-muted-foreground">{currency} Fin3a-user transfers are not activated yet. The wallet is visible, but sending is disabled until the currency is supported by the secure ledger transfer function.</p>}
        <Label htmlFor="transfer-recipient">Fin3a ID, email or phone number</Label>
        <Input id="transfer-recipient" value={identifier} onChange={e => { setIdentifier(e.target.value); setRecipient(null); }} maxLength={254} />
        <Button variant="outline" disabled={busy || identifier.trim().length < 3} onClick={() => void findRecipient()}>{busy ? "Finding…" : "Find user"}</Button>
        <SendToContact disabled={busy} recipients={recipient ? [recipient] : []} onSelect={value => { setIdentifier(value); void findRecipient(value); }} />
        {recipient && <p role="status" className="break-words text-sm">{recipient.display_name ?? "Fin3a user"} · {recipient.fin3a_id}</p>}
        <Label htmlFor="transfer-amount">Amount ({new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find(part => part.type === "currency")?.value ?? currency})</Label>
        <Input id="transfer-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button disabled={busy || !valid} onClick={() => setConfirming(true)}>Review transfer</Button>
      </> : null}
    </DialogContent>
  </Dialog>;
}
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lookupRecipient, sendTransfer, type ResolvedParticipant } from "@/lib/share-split.functions";
import { canTransfer } from "@/lib/account-transfer";

export function AccountTransferDialog({ open, onOpenChange, balances }: { open: boolean; onOpenChange: (open: boolean) => void; balances: { currency: string; balance: { available: number } }[] }) {
  const qc = useQueryClient();
  const options = (["NGN", "USD"] as const).filter(c => balances.some(a => a.currency === c));
  const local = balances.find(a => a.currency !== "NGN" && a.currency !== "USD")?.currency;
  const [currency, setCurrency] = useState<"NGN" | "USD">(options[0] ?? "USD");
  const [identifier, setIdentifier] = useState("");
  const [recipient, setRecipient] = useState<ResolvedParticipant | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const available = balances.find(a => a.currency === currency)?.balance.available ?? 0;
  const money = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(n);
  const valid = canTransfer(Number(amount), available, recipient ? 1 : 0);

  async function findRecipient() {
    setBusy(true);
    try {
      const result = await lookupRecipient({ data: { identifier } });
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
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>{confirming ? "Confirm transfer" : "Transfer"}</DialogTitle><DialogDescription>One Fin3a user to another. No external bank or crypto transfers.</DialogDescription></DialogHeader>
      {confirming ? <>
        <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Recipient</dt><dd className="break-words">{recipient?.display_name ?? "Fin3a user"} · {recipient?.fin3a_id}</dd></div><div><dt className="text-muted-foreground">Amount</dt><dd>{money(Number(amount))}</dd></div><div><dt className="text-muted-foreground">Fin3a fee</dt><dd>{money(0)}</dd></div></dl>
        <Button disabled={busy || !valid} onClick={() => void transfer()}>{busy ? "Sending…" : "Confirm transfer"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
      </> : <>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transfer currency">{options.map(c => <Button key={c} variant={currency === c ? "default" : "outline"} aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c} {c === "NGN" ? "₦" : "$"}</Button>)}</div>
        {local && <p className="text-xs text-muted-foreground">{local} transfers are not supported in your country yet. You can transfer from your USD account.</p>}
        <p className="text-sm text-muted-foreground">Available: {money(available)}</p>
        <Label htmlFor="transfer-recipient">Fin3a ID, email or phone number</Label>
        <Input id="transfer-recipient" value={identifier} onChange={e => { setIdentifier(e.target.value); setRecipient(null); }} maxLength={254} />
        <Button variant="outline" disabled={busy || identifier.trim().length < 3} onClick={() => void findRecipient()}>{busy ? "Finding…" : "Find user"}</Button>
        {recipient && <p role="status" className="break-words text-sm">{recipient.display_name ?? "Fin3a user"} · {recipient.fin3a_id}</p>}
        <Label htmlFor="transfer-amount">Amount ({currency === "NGN" ? "₦" : "$"})</Label>
        <Input id="transfer-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button disabled={busy || !valid} onClick={() => setConfirming(true)}>Review transfer</Button>
      </>}
    </DialogContent>
  </Dialog>;
}
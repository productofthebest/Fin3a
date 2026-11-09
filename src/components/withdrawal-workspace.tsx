import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NgnWithdrawalPanel } from "@/components/ngn-withdrawal-panel";
import { withdrawalOptions } from "@/lib/withdrawal-options";
import type { InternationalHistoryRow } from "@/lib/international-withdrawal.functions";

export function WithdrawalWorkspace({ country, currency, available, ngnEnabled, history }: {
  country: string; currency: string; available: number; ngnEnabled: boolean;
  history: { rows: InternationalHistoryRow[]; unavailable: boolean };
}) {
  const options = withdrawalOptions(country, currency, ngnEnabled);
  const [method, setMethod] = useState<"bank" | "crypto">(options.defaultMethod);
  const [token, setToken] = useState("USDT");
  const methodCount = Number(options.showBankMethod) + Number(options.showCryptoMethod);

  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{country} · {currency} wallet</p>
    {methodCount > 0 && <div className={`grid grid-cols-${methodCount === 2 ? "2" : "1"} gap-2`} role="group" aria-label="Withdrawal method">
      {options.showBankMethod && <Button variant={method === "bank" ? "default" : "outline"} aria-pressed={method === "bank"} onClick={() => setMethod("bank")}>Bank withdrawal</Button>}
      {options.showCryptoMethod && <Button variant={method === "crypto" ? "default" : "outline"} aria-pressed={method === "crypto"} onClick={() => setMethod("crypto")}>Crypto withdrawal</Button>}
    </div>}
    {method === "bank" && options.showBankMethod ? <section className="space-y-4" aria-label="Bank withdrawal">
      <h2 className="font-display text-lg font-semibold">{currency} bank withdrawal</h2>
      {!options.bankEnabled && <p role="status" className="text-sm text-muted-foreground">{options.bankReason} No money will be moved.</p>}
      {options.ngn ? <fieldset disabled={!options.bankEnabled} className="min-w-0"><NgnWithdrawalPanel available={available} /></fieldset>
        : <><Button disabled className="w-full">Bank withdrawal unavailable</Button>
          <section className="border-t border-border pt-4"><h3 className="font-semibold">Withdrawal history</h3>
            {history.unavailable ? <p className="mt-2 text-sm text-muted-foreground">History is temporarily unavailable.</p> : history.rows.length ? <ul className="divide-y divide-border">{history.rows.map(row => <li key={row.reference} className="py-3 text-sm"><p>{row.currency} {(row.amount_minor / 10 ** row.exponent).toFixed(row.exponent)} · {row.status}</p><p className="break-all text-xs text-muted-foreground">{row.reference}</p></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No withdrawals yet.</p>}
          </section></>}
    </section> : method === "crypto" && options.showCryptoMethod ? <section className="space-y-4" aria-label="Crypto withdrawal">
      <h2 className="font-display text-lg font-semibold">USD crypto withdrawal</h2>
      <p className="text-sm text-muted-foreground">Crypto withdrawals are denominated in USD for all countries. Choose USDT or USDC as the payout asset. Your local fiat balance will not be converted or debited automatically.</p>
      <p role="status" className="text-sm text-muted-foreground">Crypto payouts are unavailable. A verified payout provider, supported networks, limits and settlement checks are not connected. No wallet will be debited.</p>
      <div><Label htmlFor="withdraw-token">Payout asset</Label><Select value={token} onValueChange={setToken}><SelectTrigger id="withdraw-token"><SelectValue /></SelectTrigger><SelectContent>{options.tokens.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="withdraw-network">Network</Label><Select disabled><SelectTrigger id="withdraw-network"><SelectValue placeholder="No verified payout networks" /></SelectTrigger><SelectContent /></Select></div>
      <div><Label htmlFor="withdraw-address">Destination address</Label><Input id="withdraw-address" disabled placeholder="Unavailable until a network is verified" /></div>
      <div><Label htmlFor="withdraw-crypto-amount">Withdrawal amount (USD)</Label><Input id="withdraw-crypto-amount" disabled placeholder="0.00 USD" /></div>
      <dl className="divide-y divide-border text-sm">{["Fee (USD)", "Minimum (USD)", "Maximum (USD)", "USD wallet debit"].map(label => <div key={label} className="flex justify-between gap-3 py-2"><dt>{label}</dt><dd className="text-muted-foreground">Unavailable</dd></div>)}</dl>
      <Button disabled className="w-full">Review unavailable</Button>
      <section className="border-t border-border pt-4"><h3 className="font-semibold">Withdrawal history</h3><p className="mt-2 text-sm text-muted-foreground">Crypto payout history is unavailable until a verified transaction service is connected.</p></section>
    </section> : <p role="status" className="text-sm text-muted-foreground">No withdrawal method is configured for this wallet.</p>}
  </div>;
}

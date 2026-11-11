import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NgnWithdrawalPanel } from "@/components/ngn-withdrawal-panel";
import { InternationalWithdrawalPanel } from "@/components/international-withdrawal-panel";
import { withdrawalOptions } from "@/lib/withdrawal-options";
import type { InternationalHistoryRow } from "@/lib/international-withdrawal.functions";

export function WithdrawalWorkspace({ country, currency, available, ngnEnabled, history }: {
  country: string; currency: string; available: number; ngnEnabled: boolean;
  history: { rows: InternationalHistoryRow[]; unavailable: boolean };
}) {
  const options = withdrawalOptions(country, currency, ngnEnabled);
  const [method, setMethod] = useState<"bank" | "crypto">(options.defaultMethod);
  const [token, setToken] = useState("USDT");
  const [network, setNetwork] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");

  const showUsMethodSwitch = options.usd && options.showBankMethod && options.showCryptoMethod;
  const selectedMethod = showUsMethodSwitch ? method : options.defaultMethod;

  return <div className="space-y-6">
    {showUsMethodSwitch && <div className="w-40">
      <Select value={selectedMethod === "crypto" ? "crypto" : "USD"} onValueChange={value => setMethod(value === "crypto" ? "crypto" : "bank")}>
        <SelectTrigger aria-label="Withdrawal currency or method"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="crypto">Crypto</SelectItem>
        </SelectContent>
      </Select>
    </div>}
    {selectedMethod === "bank" && options.showBankMethod ? <section className="space-y-4" aria-label="Bank withdrawal">
      <h2 className="font-display text-lg font-semibold">{currency} bank withdrawal</h2>
      {options.ngn ? <div className="min-w-0"><NgnWithdrawalPanel available={available} /></div>
        : <InternationalWithdrawalPanel />}
    </section> : selectedMethod === "crypto" && options.showCryptoMethod ? <section className="space-y-4" aria-label="Crypto withdrawal">
      <h2 className="font-display text-lg font-semibold">USD crypto withdrawal</h2>
      <div><Label htmlFor="withdraw-token">Payout asset</Label><Select value={token} onValueChange={setToken}><SelectTrigger id="withdraw-token"><SelectValue /></SelectTrigger><SelectContent>{options.tokens.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="withdraw-network">Network</Label><Input id="withdraw-network" value={network} onChange={event => setNetwork(event.target.value)} placeholder="Enter network for UI testing" /></div>
      <div><Label htmlFor="withdraw-address">Destination address</Label><Input id="withdraw-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Wallet address" autoComplete="off" /></div>
      <div><Label htmlFor="withdraw-crypto-amount">Withdrawal amount (USD)</Label><Input id="withdraw-crypto-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00 USD" /></div>
    </section> : <p role="status" className="text-sm text-muted-foreground">No withdrawal method is configured for this wallet.</p>}
  </div>;
}

import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Landmark, Smartphone, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInternationalWithdrawalHistory, getInternationalWithdrawalOptions } from "@/lib/international-withdrawal.functions";
import { INTERNATIONAL_LOCKED } from "@/lib/international-withdrawal";

export const internationalOptions = queryOptions({ queryKey: ["international-withdrawal", "options"], queryFn: () => getInternationalWithdrawalOptions() });
export const internationalHistory = queryOptions({ queryKey: ["international-withdrawal", "history"], queryFn: () => getInternationalWithdrawalHistory() });

export function InternationalWithdrawalPanel() {
  const { data } = useSuspenseQuery(internationalOptions);
  const { data: history } = useSuspenseQuery(internationalHistory);
  const [method, setMethod] = useState<"bank" | "mobile_money">("bank");
  const [amount, setAmount] = useState("");
  const currency = data.routes[0]?.currency;
  return <section className="space-y-6" aria-label="International withdrawal">
    <div className="flex items-start gap-3 border-y border-border py-4 text-sm text-muted-foreground" role="status"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><p>{INTERNATIONAL_LOCKED}</p></div>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Withdrawal method">
      <Button variant={method === "bank" ? "default" : "outline"} aria-pressed={method === "bank"} onClick={() => setMethod("bank")}><Landmark className="size-4" />Bank</Button>
      <Button variant={method === "mobile_money" ? "default" : "outline"} aria-pressed={method === "mobile_money"} onClick={() => setMethod("mobile_money")}><Smartphone className="size-4" />Mobile money</Button>
    </div>
    <div className="space-y-4">
      <div><Label htmlFor="international-country">Destination country</Label><Input id="international-country" value={data.country} readOnly /></div>
      <div><Label htmlFor="international-currency">Wallet currency</Label><Input id="international-currency" value={currency ?? "Unavailable"} readOnly /></div>
      <div><Label htmlFor="international-amount">Amount{currency ? ` (${currency})` : ""}</Label><Input id="international-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div><Label htmlFor="international-name">Recipient name</Label><Input id="international-name" disabled /></div>
      {method === "bank" ? <><div><Label htmlFor="international-bank">Bank</Label><Input id="international-bank" disabled /></div><div><Label htmlFor="international-account">Account number</Label><Input id="international-account" disabled /></div></> : <><div><Label htmlFor="international-network">Mobile-money network</Label><Input id="international-network" disabled /></div><div><Label htmlFor="international-mobile">Mobile number</Label><Input id="international-mobile" disabled /></div></>}
      <p className="text-sm text-muted-foreground">{data.routes.some(r => r.method === method) ? "Merchant approval and verified charges are not available for this withdrawal." : "This withdrawal method is unavailable for your country."}</p>
      <Button className="w-full" disabled><LockKeyhole className="size-4" />Withdrawal unavailable</Button>
    </div>
    <section className="border-t border-border pt-5" aria-label="International withdrawal history"><h2 className="font-display text-lg font-semibold">International withdrawal history</h2>
      {history.unavailable ? <p className="mt-3 text-sm text-muted-foreground">History is temporarily unavailable.</p> : history.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No international withdrawals.</p> : <ul className="divide-y divide-border">{history.rows.map(row => <li key={row.reference} className="py-3 text-sm"><div className="flex justify-between gap-3"><span>{row.currency} {(row.amount_minor / 10 ** row.exponent).toFixed(row.exponent)}</span><span>{row.status}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">{row.reference}</p></li>)}</ul>}
    </section>
  </section>;
}
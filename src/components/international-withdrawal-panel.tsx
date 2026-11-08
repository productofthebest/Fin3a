import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Landmark, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInternationalWithdrawalHistory, getInternationalWithdrawalOptions } from "@/lib/international-withdrawal.functions";
import { validateInternationalPayout } from "@/lib/international-payout.functions";
import { INTERNATIONAL_LOCKED } from "@/lib/international-withdrawal";

export const internationalOptions = queryOptions({ queryKey: ["international-withdrawal", "options"], queryFn: () => getInternationalWithdrawalOptions() });
export const internationalHistory = queryOptions({ queryKey: ["international-withdrawal", "history"], queryFn: () => getInternationalWithdrawalHistory() });

type FieldName = "accountName" | "accountNumber" | "routingNumber" | "address" | "sortCode" | "branchCode" | "bankCode" | "iban" | "swiftCode";
type Field = { name: FieldName; label: string; placeholder: string; inputMode?: "text" | "numeric" };
const BANK_FIELDS: Record<string, Field[]> = {
  US: [
    { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
    { name: "routingNumber", label: "ABA routing number", placeholder: "9 digits", inputMode: "numeric" },
    { name: "accountNumber", label: "Bank account number", placeholder: "Account number", inputMode: "numeric" },
    { name: "address", label: "Beneficiary address", placeholder: "Street address" },
  ],
  GB: [
    { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
    { name: "sortCode", label: "Sort code", placeholder: "6 digits", inputMode: "numeric" },
    { name: "accountNumber", label: "Account number", placeholder: "8 digits", inputMode: "numeric" },
  ],
  ZA: [
    { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
    { name: "branchCode", label: "Branch code", placeholder: "6 digits", inputMode: "numeric" },
    { name: "accountNumber", label: "Account number", placeholder: "Bank account number", inputMode: "numeric" },
  ],
  GH: [
    { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
    { name: "bankCode", label: "Bank code", placeholder: "Provider bank code" },
    { name: "accountNumber", label: "Account number", placeholder: "Bank account number", inputMode: "numeric" },
  ],
  KE: [
    { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
    { name: "bankCode", label: "Bank code", placeholder: "Provider bank code" },
    { name: "accountNumber", label: "Account number", placeholder: "Bank account number", inputMode: "numeric" },
  ],
};

const fieldsFor = (country: string): Field[] => BANK_FIELDS[country] ?? [
  { name: "accountName", label: "Account holder name", placeholder: "Full legal name" },
  { name: "iban", label: "IBAN", placeholder: "International bank account number" },
  { name: "swiftCode", label: "SWIFT / BIC", placeholder: "Bank identifier code" },
];

export function InternationalWithdrawalPanel() {
  const { data } = useSuspenseQuery(internationalOptions);
  const { data: history } = useSuspenseQuery(internationalHistory);
  const route = data.routes.find(r => r.method === "bank");
  const fields = useMemo(() => fieldsFor(data.country), [data.country]);
  const [beneficiary, setBeneficiary] = useState<Partial<Record<FieldName, string>>>({});
  const [amount, setAmount] = useState("");
  const [checking, setChecking] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [validationPassed, setValidationPassed] = useState(false);
  const currency = route?.currency ?? null;
  const complete = fields.every(field => Boolean(beneficiary[field.name]?.trim()));

  async function validateDetails() {
    if (!route || !currency || !complete || checking) return;
    setChecking(true);
    setValidationMessage("");
    setValidationPassed(false);
    try {
      const result = await validateInternationalPayout({ data: {
        walletCurrency: currency,
        destinationCountry: data.country,
        currency,
        method: "bank",
        beneficiary: Object.fromEntries(fields.map(field => [field.name, beneficiary[field.name] ?? ""])),
      } });
      if (result.beneficiaryValid) {
        setValidationPassed(true);
        setValidationMessage("Bank details passed the available format checks. This is not bank-account ownership verification, and payouts remain disabled pending merchant approval and settlement testing.");
      } else {
        setValidationMessage(result.reason === "invalid_beneficiary"
          ? `Please review: ${(result.invalidFields ?? []).join(", ")}.`
          : "This bank route is not currently available for your country and wallet.");
      }
    } catch {
      setValidationMessage("We couldn't validate these details right now. No withdrawal was submitted.");
    } finally {
      setChecking(false);
    }
  }

  return <section className="space-y-6" aria-label="Withdraw">
    <div className="flex items-start gap-3 border-y border-border py-4 text-sm text-muted-foreground" role="status">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" />
      <p>{INTERNATIONAL_LOCKED}</p>
    </div>
    {!route || !currency ? (
      <div className="rounded-xl border border-border p-4">
        <h2 className="font-display text-lg font-semibold">Bank withdrawal unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{data.country === "NG" ? "Nigeria uses the existing NGN bank-withdrawal flow in your local wallet." : "There is no configured bank-withdrawal schema for your profile country yet."}</p>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="size-4" />{data.country} local bank details · {currency}</div>
        <div><Label htmlFor="withdraw-amount">Amount ({currency})</Label><Input id="withdraw-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></div>
        {fields.map(field => (
          <div key={field.name}>
            <Label htmlFor={`withdraw-${field.name}`}>{field.label}</Label>
            <Input id={`withdraw-${field.name}`} inputMode={field.inputMode ?? "text"} autoComplete="off" value={beneficiary[field.name] ?? ""} placeholder={field.placeholder} onChange={event => {
              setBeneficiary(current => ({ ...current, [field.name]: event.target.value }));
              setValidationPassed(false);
              setValidationMessage("");
            }} />
          </div>
        ))}
        <Button className="w-full" variant="outline" disabled={!complete || checking} onClick={() => void validateDetails()}>{checking ? "Validating…" : "Validate bank details"}</Button>
        {validationMessage && <p role="status" className="text-sm text-muted-foreground">{validationMessage}</p>}
        <Button className="w-full" disabled><LockKeyhole className="size-4" />{validationPassed ? "Payouts still locked" : "Withdrawals unavailable"}</Button>
        <p className="text-xs text-muted-foreground">The form follows your saved country and its local bank-field format. Changing country in Settings refreshes the applicable form; it does not convert balances or alter existing records.</p>
      </div>
    )}
    <section className="border-t border-border pt-5" aria-label="Withdrawal history">
      <h2 className="font-display text-lg font-semibold">Recent withdrawals</h2>
      {history.unavailable ? <p className="mt-3 text-sm text-muted-foreground">History is temporarily unavailable.</p> : history.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No withdrawals yet.</p> : <ul className="divide-y divide-border">{history.rows.map(row => <li key={row.reference} className="py-3 text-sm"><div className="flex justify-between gap-3"><span>{row.currency} {(row.amount_minor / 10 ** row.exponent).toFixed(row.exponent)}</span><span>{row.status}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">{row.reference}</p></li>)}</ul>}
    </section>
  </section>;
}

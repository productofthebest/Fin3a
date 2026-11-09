import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInternationalWithdrawalHistory, getInternationalWithdrawalOptions } from "@/lib/international-withdrawal.functions";
import { findRoute, validateBeneficiary, type BeneficiaryInput } from "@/lib/international-payout-routes";

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
  const [validationMessage, setValidationMessage] = useState("");
  const complete = fields.every(field => Boolean(beneficiary[field.name]?.trim()));
  const currency = route?.currency ?? null;

  function validateDetails() {
    if (!route || !currency || !complete) return;
    const schema = findRoute(data.country, currency, "bank");
    if (!schema) {
      setValidationMessage("No bank field schema is configured for this country.");
      return;
    }
    const result = validateBeneficiary(schema, beneficiary as BeneficiaryInput);
    setValidationMessage(result.ok ? "Details passed local format checks." : result.errors.join(", "));
  }

  return <section className="space-y-4" aria-label="Bank details">
    <p className="text-xs text-muted-foreground">Test mode · payout submission is disabled.</p>
    {route && currency ? <>
      {fields.map(field => (
        <div key={field.name}>
          <Label htmlFor={`withdraw-${field.name}`}>{field.label}</Label>
          <Input id={`withdraw-${field.name}`} inputMode={field.inputMode ?? "text"} autoComplete="off" value={beneficiary[field.name] ?? ""} placeholder={field.placeholder} onChange={event => {
            setBeneficiary(current => ({ ...current, [field.name]: event.target.value }));
            setValidationMessage("");
          }} />
        </div>
      ))}
      <Button className="w-full" variant="outline" disabled={!complete} onClick={validateDetails}>Check bank details</Button>
      {validationMessage && <p role="status" className="text-sm text-muted-foreground">{validationMessage}</p>}
    </> : <p className="text-sm text-muted-foreground">Bank detail fields are not configured for this country and currency.</p>}
    <section className="border-t border-border pt-5" aria-label="Withdrawal history">
      <h2 className="font-display text-lg font-semibold">Recent withdrawals</h2>
      {history.unavailable ? <p className="mt-3 text-sm text-muted-foreground">History is temporarily unavailable.</p> : history.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No withdrawals yet.</p> : <ul className="divide-y divide-border">{history.rows.map(row => <li key={row.reference} className="py-3 text-sm"><div className="flex justify-between gap-3"><span>{row.currency} {(row.amount_minor / 10 ** row.exponent).toFixed(row.exponent)}</span><span>{row.status}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">{row.reference}</p></li>)}</ul>}
    </section>
  </section>;
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RecordCurrencySelect({ value, currencies, onChange }: {
  value: string; currencies: string[]; onChange: (value: string) => void;
}) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-40" aria-label="Record currency"><SelectValue /></SelectTrigger>
    <SelectContent>{currencies.map(currency => <SelectItem key={currency} value={currency}>{currency === "all" ? "All currencies" : currency}</SelectItem>)}</SelectContent>
  </Select>;
}
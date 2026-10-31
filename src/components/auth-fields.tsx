import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { PHONE_COUNTRIES } from "@/lib/auth-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = [...PHONE_COUNTRIES].sort((a, b) => (regionNames.of(a.code) ?? a.code).localeCompare(regionNames.of(b.code) ?? b.code));

export function PhoneField({ country, onCountry, phone, onPhone, disabled }: { country: CountryCode; onCountry: (value: CountryCode) => void; phone: string; onPhone: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-2">
    <Label htmlFor="phone">Phone number</Label>
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2">
      <select aria-label="Country calling code" value={country} disabled={disabled} onChange={(e) => { const found = PHONE_COUNTRIES.find((c) => c.code === e.target.value); if (found) onCountry(found.code); }} className="h-10 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {countries.map((c) => <option key={c.code} value={c.code}>{regionNames.of(c.code)} (+{c.dial})</option>)}
      </select>
      <Input id="phone" type="tel" autoComplete="tel-national" placeholder="Phone number" value={phone} onChange={(e) => onPhone(e.target.value)} required disabled={disabled} />
    </div>
  </div>;
}

export function PasswordField({ id = "password", label = "Password", value, onChange, autoComplete = "current-password", disabled }: { id?: string; label?: string; value: string; onChange: (value: string) => void; autoComplete?: string; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} required minLength={6} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} disabled={disabled} className="pr-11" />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-10" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  </div>;
}
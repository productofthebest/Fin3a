import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { CountryCode } from "libphonenumber-js";
import { AppShell } from "@/components/app-shell";
import { PhoneField } from "@/components/auth-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsQuery } from "@/lib/queries";
import { normalizedPhone, validOtp } from "@/lib/auth-options";
import { getLinkedPhone, requestLinkCode, verifyLinkCode } from "@/lib/phone-auth.functions";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => pageMeta("Phone sign-in", "Link a verified phone number to your Fin3a account."),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  component: SecurityPage,
});

function SecurityPage() {
  const qc = useQueryClient();
  const linked = useQuery({ queryKey: ["linked-phone"], queryFn: () => getLinkedPhone() });
  const [country, setCountry] = useState<CountryCode>("NG");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }

  return (
    <AppShell>
      <Card className="mx-auto max-w-lg">
        <CardHeader><CardTitle>Phone sign-in</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {linked.data?.phone ? <>Linked number: <span className="text-foreground">{linked.data.phone}</span>. You can sign in with it using an SMS code.</> : "Link your phone number so you can sign in to this same account with an SMS code."}
          </p>
          {!sent ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
              const n = normalizedPhone(phone, country);
              await requestLinkCode({ data: { phone: n } }); setSent(n); toast.success("Code sent by SMS.");
            }); }}>
              <PhoneField country={country} onCountry={setCountry} phone={phone} onPhone={setPhone} disabled={busy} />
              <Button type="submit" disabled={busy}>{linked.data?.phone ? "Change number" : "Send code"}</Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!validOtp(code)) return; void run(async () => {
              await verifyLinkCode({ data: { phone: sent, code } });
              setSent(null); setCode(""); setPhone(""); toast.success("Phone number linked.");
              await qc.invalidateQueries({ queryKey: ["linked-phone"] });
            }); }}>
              <Label htmlFor="link-code">Six-digit code sent to {sent}</Label>
              <Input id="link-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || !validOtp(code)}>Verify</Button>
                <Button type="button" variant="ghost" onClick={() => { setSent(null); setCode(""); }}>Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

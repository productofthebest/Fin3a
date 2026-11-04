import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { CountryCode } from "libphonenumber-js";
import { AppShell } from "@/components/app-shell";
import { PhoneField } from "@/components/auth-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsQuery } from "@/lib/queries";
import { normalizedPhone, validOtp } from "@/lib/auth-options";
import { getLinkedPhone, requestLinkCode, verifyLinkCode } from "@/lib/phone-auth.functions";
import { pageMeta } from "@/lib/page-meta";
import { updateSettings } from "@/lib/settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => pageMeta("Settings", "Manage your Fin3a personal details, email, verified phone number and account verification availability."),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  component: SecurityPage,
});

function SecurityPage() {
  const qc = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const account = useQuery({ queryKey: ["settings", "auth-details"], queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error("Could not load your contact details.");
    return data.user;
  } });
  const [name, setName] = useState(settings?.display_name ?? "");
  const [email, setEmail] = useState("");
  const [emailReview, setEmailReview] = useState(false);
  const [emailPending, setEmailPending] = useState<string | null>(null);
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
      <div className="mx-auto max-w-lg space-y-8">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <section className="space-y-4 border-b border-border pb-8">
          <h2 className="font-display text-xl font-semibold">Personal details</h2>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => {
            await updateSettings({ data: { display_name: name } });
            await qc.invalidateQueries({ queryKey: ["settings"] });
            toast.success("Details saved.");
          }); }}>
            <Label htmlFor="settings-name">Full name</Label>
            <Input id="settings-name" value={name} maxLength={60} autoComplete="name" onChange={e => setName(e.target.value)} />
            <Button disabled={busy || name === (settings?.display_name ?? "")} type="submit">Save details</Button>
          </form>
        </section>
        <section className="space-y-4 border-b border-border pb-8">
          <h2 className="font-display text-xl font-semibold">Email</h2>
          <p className="break-all text-sm text-muted-foreground">{account.isPending ? "Loading email…" : account.isError ? "Email details unavailable. Please try again." : account.data?.email?.endsWith("@phone.fin3a.local") ? "No personal email linked." : account.data?.email ?? "No email linked."}</p>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); setEmailReview(true); }}>
            <Label htmlFor="settings-email">New email address</Label>
            <Input id="settings-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Button disabled={busy || !email.trim() || account.isError || account.isPending || email.trim() === account.data?.email} type="submit">Change email</Button>
          </form>
          {(emailPending || account.data?.new_email) && <p role="status" className="break-words text-sm text-muted-foreground">Email change requested for {emailPending ?? account.data?.new_email}. Check your inboxes for confirmation instructions.</p>}
        </section>
        <section className="space-y-4 border-b border-border pb-8">
          <h2 className="font-display text-xl font-semibold">Phone number</h2>
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
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Identity verification (KYC)</h2>
          <p className="text-sm text-muted-foreground">KYC submission is not available yet. If verification is needed, the requirements will appear here. Do not send identity documents in AI chat.</p>
          <Button variant="outline" disabled>Verification unavailable</Button>
        </section>
      </div>
      <Dialog open={emailReview} onOpenChange={value => { if (!busy) setEmailReview(value); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change email?</DialogTitle><DialogDescription className="break-words">Request a change to {email}. Follow the confirmation instructions sent to your inboxes before using your new email to sign in.</DialogDescription></DialogHeader>
          <Button disabled={busy} onClick={() => void run(async () => {
            const next = email.trim();
            const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: window.location.origin });
            if (error) throw new Error("Could not request the email change. Please try again later.");
            setEmailPending(next); setEmailReview(false); setEmail("");
            await qc.invalidateQueries({ queryKey: ["settings", "auth-details"] });
            toast.success("Email change requested. Check your inboxes.");
          })}>{busy ? "Requesting…" : "Confirm email change"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setEmailReview(false)}>Cancel</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

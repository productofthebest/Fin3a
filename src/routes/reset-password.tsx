import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth-fields";
import { AUTH_DESTINATION } from "@/lib/auth-options";
import { SupportContact } from "@/components/support-contact";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset your password — Fin3a AI" },
    { name: "description", content: "Securely choose a new password for your Fin3a account." },
    { property: "og:title", content: "Reset your password — Fin3a AI" },
    { property: "og:description", content: "Recover access to your personal Fin3a account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Capture recovery intent before the client consumes the URL hash.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const recovery = params.get("type") === "recovery";
    if (!recovery) { setChecked(true); return; }
    supabase.auth.getUser().then(({ data }) => { setReady(Boolean(data.user)); setChecked(true); });
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!ready || busy) return;
    setError(null); if (password !== confirm) { setError("Your passwords do not match."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await navigate({ to: AUTH_DESTINATION, replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to change your password."); } finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
    <Link to="/" className="mb-8 font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
    <h1 className="mb-6 font-display text-3xl font-semibold">Choose a new password</h1>
    {!checked ? <p role="status" className="text-muted-foreground">Checking your recovery link…</p> : !ready ? <><p role="alert" className="mb-6 text-muted-foreground">This recovery link is invalid or expired. Request a new link from the sign-in page.</p><Button asChild><Link to="/auth">Back to sign in</Link></Button></> : <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <PasswordField value={password} onChange={setPassword} autoComplete="new-password" disabled={busy} />
      <PasswordField id="confirm-password" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={busy} />
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
    </form>}
    <p className="mt-8 text-center text-xs text-muted-foreground"><SupportContact className="underline-offset-4 hover:text-foreground hover:underline" /></p>
  </main>;
}

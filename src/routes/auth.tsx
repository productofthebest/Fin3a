import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, Mail, Phone, ShieldCheck, Zap } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PhoneField, PasswordField } from "@/components/auth-fields";
import { AUTH_DESTINATION, OTP_LENGTH, RESEND_COOLDOWN, authSearch, normalizedPhone, validOtp, type AuthMethod } from "@/lib/auth-options";

export const Route = createFileRoute("/auth")({
  validateSearch: authSearch,
  head: () => ({ meta: [
    { title: "Sign in or get started — Fin3a AI" },
    { name: "description", content: "Access Fin3a with your phone number and SMS code or your email and password." },
    { property: "og:title", content: "Sign in or get started — Fin3a AI" },
    { property: "og:description", content: "Secure phone and email access to your personal Fin3a dashboard." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { method = "email", mode = "signin" } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<CountryCode>("NG");
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const [forgot, setForgot] = useState(false);
  const signup = mode === "signup";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: AUTH_DESTINATION, replace: true }); });
  }, [navigate]);
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update(); const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function resetScreen() { setError(null); setNotice(null); setSentPhone(null); setOtp(""); setAwaitingEmail(false); setForgot(false); }
  function switchMethod(value: string) {
    if (value !== "phone" && value !== "email") return;
    resetScreen(); void navigate({ to: "/auth", search: { method: value, mode }, replace: true });
  }
  function showError(e: unknown) { setError(e instanceof Error ? e.message : "Unable to sign in. Please try again."); }

  async function sendCode(resend = false) {
    if (busy || (resend && remaining > 0)) return;
    setBusy(true); setError(null);
    try {
      const number = resend && sentPhone ? sentPhone : normalizedPhone(phone, country);
      await requestPhoneCode({ data: { phone: number, purpose: signup ? "signup" : "signin" } });
      setSentPhone(number); setOtp(""); setRetryAt(Date.now() + RESEND_COOLDOWN * 1000);
      setNotice(resend ? "A new verification code was sent." : null);
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); if (!sentPhone || !validOtp(otp) || busy) return;
    setBusy(true); setError(null);
    try {
      const { tokenHash } = await verifyPhoneCode({ data: { phone: sentPhone, code: otp, purpose: signup ? "signup" : "signin" } });
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("Verification did not create a session. Please request a new code.");
      setOtp(""); await navigate({ to: AUTH_DESTINATION, replace: true });
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (method === "phone") { await sendCode(); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      if (forgot) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (resetError) throw resetError;
        setNotice("If an account exists for that email, a password reset link will arrive shortly.");
      } else if (signup) {
        if (password !== confirmPassword) throw new Error("Your passwords do not match.");
        const { data, error: signupError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } } });
        if (signupError) throw signupError;
        if (data.session) await navigate({ to: AUTH_DESTINATION, replace: true });
        else setAwaitingEmail(true);
      } else {
        const { data, error: signinError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signinError) throw signinError;
        if (data.session) await navigate({ to: AUTH_DESTINATION, replace: true });
      }
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function oauth(provider: "google" | "lovable") {
    setBusy(true); setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) await navigate({ to: AUTH_DESTINATION, replace: true });
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/">Back home</Link></Button>
    </header>
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">{sentPhone ? "Verify your number" : awaitingEmail ? "Check your email" : forgot ? "Reset your password" : signup ? "Get started with Fin3a" : "Welcome back"}</h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">{sentPhone ? <>Enter the six-digit SMS code sent to <span className="break-all text-foreground">{sentPhone}</span>.</> : awaitingEmail ? <>Confirm your email at <span className="break-all text-foreground">{email}</span> before signing in.</> : forgot ? "We'll email you a link to choose a new password." : signup ? "Create your account. Your finances stay yours." : "Sign in to your Fin3a account."}</p>
      {error && <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-md border border-border bg-secondary p-3 text-sm">{notice}</p>}
      {sentPhone ? <form onSubmit={verifyCode} className="space-y-6">
        <Label htmlFor="sms-code">Verification code</Label>
        <InputOTP id="sms-code" aria-label="Six-digit SMS verification code" maxLength={OTP_LENGTH} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp} disabled={busy} autoFocus autoComplete="one-time-code" containerClassName="justify-center">
          <InputOTPGroup>{Array.from({ length: OTP_LENGTH }, (_, i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg sm:h-14 sm:w-12" />)}</InputOTPGroup>
        </InputOTP>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !validOtp(otp)}>{busy ? "Verifying…" : "Verify and continue"}</Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSentPhone(null); setOtp(""); setError(null); setNotice(null); }} disabled={busy}><ArrowLeft className="size-4" />Change number</Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy || remaining > 0} onClick={() => sendCode(true)}>{remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}</Button>
        </div>
      </form> : awaitingEmail ? <Button variant="secondary" onClick={() => { resetScreen(); void navigate({ to: "/auth", search: { method: "email", mode: "signin" }, replace: true }); }}>Back to sign in</Button> : <>
        {!forgot && <Tabs value={method} onValueChange={switchMethod} className="mb-6"><TabsList aria-label="Authentication method" className="grid h-auto w-full grid-cols-2 gap-1"><TabsTrigger value="phone" disabled={busy} className="gap-2 px-2 py-3"><Phone className="size-4 shrink-0" />Phone number</TabsTrigger><TabsTrigger value="email" disabled={busy} className="gap-2 px-2 py-3"><Mail className="size-4 shrink-0" />Email & password</TabsTrigger></TabsList></Tabs>}
        <form onSubmit={submit} className="space-y-4">
          {signup && !forgot && <div className="space-y-2"><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} /></div>}
          {method === "phone" && !forgot ? <PhoneField country={country} onCountry={setCountry} phone={phone} onPhone={setPhone} disabled={busy} /> : <>
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} /></div>
            {!forgot && <PasswordField value={password} onChange={setPassword} autoComplete={signup ? "new-password" : "current-password"} disabled={busy} />}
            {signup && !forgot && <PasswordField id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" disabled={busy} />}
            {!signup && !forgot && <Button type="button" variant="link" className="h-auto px-0 text-sm" onClick={() => { setForgot(true); setError(null); }}>Forgot password?</Button>}
          </>}
          <Button type="submit" className="w-full whitespace-normal" size="lg" disabled={busy}>{busy ? "Please wait…" : forgot ? "Send reset link" : method === "phone" ? "Continue with phone number" : signup ? "Create account with email" : "Continue with email and password"}</Button>
        </form>
        {forgot ? <Button variant="ghost" className="mt-4" onClick={resetScreen}><ArrowLeft className="size-4" />Back to sign in</Button> : <>
          <p className="mt-5 text-center text-sm text-muted-foreground">{signup ? "Already have an account?" : "New to Fin3a?"} <Link to="/auth" search={{ method, mode: signup ? "signin" : "signup" }} onClick={resetScreen} className="font-medium text-primary">{signup ? "Sign in" : "Get started"}</Link></p>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
          <div className="grid gap-2"><Button variant="secondary" disabled={busy} onClick={() => oauth("google")}>Continue with Google</Button><Button variant="outline" disabled={busy} onClick={() => oauth("lovable")}>Continue with Lovable</Button></div>
        </>}
      </>}
    </main>
    <footer className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground"><Zap className="size-3.5 text-primary" />Powered by Top Floor</footer>
  </div>;
}

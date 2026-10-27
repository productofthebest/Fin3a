import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Fin3a AI" },
      { name: "description", content: "Sign in or create your Fin3a AI account." },
      { property: "og:title", content: "Sign in — Fin3a AI" },
      { property: "og:description", content: "Sign in or create your Fin3a AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8L20 3.1A12 12 0 0 0 1.2 6.6l4.1 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          setAwaitingEmail(email);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "lovable") {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
      setBusy(false);
    }
  }

  if (awaitingEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <span className="text-foreground">{awaitingEmail}</span>.
              Click it to activate your account, then sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full" onClick={() => setAwaitingEmail(null)}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">
            Fin<span className="text-primary">3a</span>
          </CardTitle>
          <CardDescription>
            {mode === "signin" ? "Welcome back. Sign in to continue." : "Create your account to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md py-1.5 text-sm transition-colors",
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => handleOAuth("google")}>
            <GoogleIcon /> Continue with Google
          </Button>
          <button
            type="button"
            className="lovable-auth-button w-full"
            disabled={busy}
            onClick={() => handleOAuth("lovable")}
          >
            Continue with Lovable
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

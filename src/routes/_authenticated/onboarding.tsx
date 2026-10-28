import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { completeOnboarding } from "@/lib/settings.functions";
import { settingsQuery } from "@/lib/queries";
import { CURRENCIES } from "@/lib/fin3a";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (settings?.onboarding_completed) throw redirect({ to: "/dashboard" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const [currency, setCurrency] = useState(settings?.currency || "USD");
  const [currencySearch, setCurrencySearch] = useState("");
  const [displayName, setDisplayName] = useState(settings?.display_name || "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await completeOnboarding({
        data: { currency, display_name: displayName || undefined },
      });
      queryClient.setQueryData(settingsQuery().queryKey, result);
      toast.success("You're all set");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Welcome to Fin3a</CardTitle>
            <CardDescription>
              Pick the currency you think in. We'll show every amount in it — you can change it
              anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Preferred currency</Label>
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {CURRENCIES.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setCurrency(option.code)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        currency === option.code
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      <span className="block font-medium">{option.code}</span>
                      <span className="text-xs text-muted-foreground">{option.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display name (optional)</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we greet you?"
                  maxLength={60}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Setting up…" : "Start tracking"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

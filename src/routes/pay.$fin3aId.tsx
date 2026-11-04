import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicShareProfile, lookupRecipient, sendTransfer } from "@/lib/share-split.functions";
import { SPLIT_CURRENCIES, type SplitCurrency } from "@/lib/split-bill";
import { pageMeta } from "@/lib/page-meta";

const payQuery = (fin3aId: string) =>
  queryOptions({
    queryKey: ["pay", fin3aId],
    queryFn: () => getPublicShareProfile({ data: { fin3aId } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/pay/$fin3aId")({
  head: () => pageMeta("Pay on Fin3a", "Send a payment to a Fin3a user with their unique account ID."),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(payQuery(params.fin3aId)),
  component: Page,
});

function Page() {
  const { fin3aId } = Route.useParams();
  const { data: profile } = useSuspenseQuery(payQuery(fin3aId));
  const lookup = useServerFn(lookupRecipient);
  const send = useServerFn(sendTransfer);
  const sym = (currency: string) => (currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<SplitCurrency>("NGN");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [payUrl, setPayUrl] = useState("");

  useEffect(() => {
    setPayUrl(window.location.href);
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold">Payment link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This Fin3a payment link does not exist. Check the link and try again.</p>
        <Button asChild variant="outline" className="mt-6"><Link to="/">Go to Fin3a</Link></Button>
      </main>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const resolved = await lookup({ data: { identifier: fin3aId } });
      if (!resolved.found) {
        toast.error("You cannot send money to this account — it may be your own link");
        return;
      }
      await send({
        data: {
          toUserId: resolved.participant.user_id,
          currency,
          amount: Number(amount),
          ...(reference ? { reference } : {}),
        },
      });
      toast.success(`Sent to ${profile!.display_name ?? profile!.fin3a_id}`);
      setAmount(""); setReference("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-10">
      <Link to="/" className="font-display text-lg font-semibold tracking-tight">
        Fin<span className="text-primary">3a</span>
      </Link>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-xs text-muted-foreground">Pay</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{profile.display_name ?? "Fin3a user"}</h1>
        <p className="mt-1 font-mono text-sm text-primary">{profile.fin3a_id}</p>
        {payUrl ? (
          <div className="mx-auto mt-5 inline-block rounded-xl border border-border bg-white p-4">
            <QRCode value={payUrl} size={140} />
          </div>
        ) : null}
      </section>

      {signedIn === null ? (
        <Loader2 className="mx-auto mt-8 size-5 animate-spin" aria-label="Checking sign-in" />
      ) : signedIn ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Send from your Fin3a balance</h2>
          <div className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="pay-amount">Amount</Label>
              <Input id="pay-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-currency">Currency</Label>
              <select
                id="pay-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SplitCurrency)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SPLIT_CURRENCIES.map((c) => <option key={c} value={c}>{sym(c)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pay-ref">Note (optional)</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </div>
            <Button onClick={() => void submit()} disabled={busy || !(Number(amount) > 0)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Send payment
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-xl border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Sign in to your Fin3a account to send this payment.</p>
          <Button asChild className="mt-3"><Link to="/auth">Sign in to Fin3a</Link></Button>
        </section>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Payments are processed server-side between Fin3a accounts and verified before balances change. Never share your password or one-time codes.</p>
      </div>
    </main>
  );
}

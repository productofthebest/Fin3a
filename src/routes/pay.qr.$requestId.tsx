import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payQrRequest, resolveQrRequest, type QrRequestDetails } from "@/lib/qr-payments.functions";
import { formatQrAmount } from "@/lib/qr-payments";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/pay/qr/$requestId")({
  head: () => pageMeta("Fin3a payment request", "Review and pay a Fin3a QR payment request."),
  component: Page,
});

function Page() {
  const { requestId } = Route.useParams();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [details, setDetails] = useState<QrRequestDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [paidTransferId, setPaidTransferId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    resolveQrRequest({ data: { requestId } })
      .then((d) => {
        setDetails(d);
        if (d.amount != null) setAmount(String(d.amount));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load this payment request"));
  }, [signedIn, requestId]);

  async function confirmPay() {
    setBusy(true);
    try {
      const { transferId } = await payQrRequest({
        data: details?.amount != null ? { requestId } : { requestId, amount: Number(amount) },
      });
      setPaidTransferId(transferId);
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

      {paidTransferId ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-bold">Payment sent</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {details?.recipientName ?? "The recipient"} has been paid. Both accounts now show this payment in their activity.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Transaction reference</p>
          <p className="mt-1 break-all rounded-md bg-secondary p-2 font-mono text-xs">{paidTransferId}</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/activity">View my activity</Link></Button>
        </section>
      ) : signedIn === null ? (
        <Loader2 className="mx-auto mt-16 size-5 animate-spin" aria-label="Checking sign-in" />
      ) : !signedIn ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">Fin3a payment request</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your Fin3a account to review and pay this request.</p>
          <Button asChild className="mt-4"><Link to="/auth">Sign in to Fin3a</Link></Button>
        </section>
      ) : loadError ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">Request unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/">Go to Fin3a</Link></Button>
        </section>
      ) : !details ? (
        <Loader2 className="mx-auto mt-16 size-5 animate-spin" aria-label="Loading payment request" />
      ) : details.status !== "open" ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">
            {details.status === "expired" ? "Request expired" : details.status === "paid" ? "Already paid" : "Request unavailable"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {details.status === "expired"
              ? "This payment request has expired. Ask the recipient for a new one."
              : details.status === "paid"
                ? "This payment request has already been paid."
                : "This payment request is no longer open."}
          </p>
          <Button asChild variant="outline" className="mt-4"><Link to="/dashboard">Back to Fin3a</Link></Button>
        </section>
      ) : details.isOwn ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">This is your own request</h1>
          <p className="mt-2 text-sm text-muted-foreground">Share the QR code or link with the person who should pay you.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/accounts/qr">My QR codes</Link></Button>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs text-muted-foreground">Payment request from</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{details.recipientName}</h1>
            <p className="mt-1 font-mono text-sm text-primary">{details.recipientFin3aId}</p>
            <div className="mt-5 rounded-lg bg-secondary/50 p-4 text-left text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatQrAmount(details.amount ?? null, details.currency ?? "NGN")}</span></div>
              {details.description ? (
                <div className="mt-2 flex justify-between gap-4"><span className="text-muted-foreground">For</span><span className="text-right">{details.description}</span></div>
              ) : null}
              {details.expiresAt ? (
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1 text-muted-foreground"><Timer className="size-3.5" /> Expires</span>
                  <span>{new Date(details.expiresAt).toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Confirm payment</h2>
            {details.amount == null ? (
              <div className="mt-3">
                <Label htmlFor="qr-amount">Amount ({details.currency})</Label>
                <Input id="qr-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            ) : null}
            <Button className="mt-4 w-full" onClick={() => void confirmPay()} disabled={busy || !(Number(amount) > 0)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Pay {details.amount != null ? formatQrAmount(details.amount, details.currency ?? "NGN") : `${details.currency}`}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">The money moves only when you confirm here.</p>
          </section>
        </>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Payments are verified and processed server-side between Fin3a accounts. Never share your password or one-time codes.</p>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, MessageCircle, MessageSquare, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getShareProfile } from "@/lib/share-split.functions";
import { pageMeta } from "@/lib/page-meta";

const shareQuery = () =>
  queryOptions({ queryKey: ["accounts", "share-profile"], queryFn: () => getShareProfile(), staleTime: 60_000 });

export const Route = createFileRoute("/_authenticated/accounts/share")({
  head: () => pageMeta("Share account", "Share your Fin3a account ID and payment link so other Fin3a users can pay you."),
  loader: ({ context }) => context.queryClient.ensureQueryData(shareQuery()),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(shareQuery());
  const [copied, setCopied] = useState<string | null>(null);
  const payLink = data.fin3aId ? `${window.location.origin}/pay/${data.fin3aId}` : null;
  const shareText = data.fin3aId
    ? `Pay me on Fin3a — ${data.displayName ?? "Fin3a user"} (${data.fin3aId}). ${payLink}`
    : null;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — long-press to copy manually");
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Share Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Share your Fin3a account ID or payment link so other Fin3a users can send you money.
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Account name</p>
            <p className="mt-1 font-display text-xl font-semibold">{data.displayName ?? "Fin3a user"}</p>
            <p className="mt-4 text-xs text-muted-foreground">Your unique Fin3a account ID</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-primary">{data.fin3aId ?? "Unavailable"}</p>
            {payLink ? (
              <>
                <p className="mt-4 text-xs text-muted-foreground">Payment link</p>
                <p className="mt-1 break-all rounded-md bg-secondary p-2 font-mono text-xs">{payLink}</p>
              </>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!data.fin3aId} onClick={() => copy("Account ID", data.fin3aId!)}>
                {copied === "Account ID" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy ID
              </Button>
              <Button variant="outline" size="sm" disabled={!payLink} onClick={() => copy("Payment link", payLink!)}>
                {copied === "Payment link" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link
              </Button>
              <Button variant="outline" size="sm" disabled={!shareText} onClick={() => copy("Account details", shareText!)}>
                {copied === "Account details" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy details
              </Button>
            </div>
          </div>
          {payLink ? (
            <div className="mx-auto rounded-xl border border-border bg-white p-4">
              <QRCode value={payLink} size={140} />
              <p className="mt-2 text-center text-xs text-muted-foreground">Scan to pay</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Share through your apps</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" disabled={!shareText}>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText ?? "")}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!shareText}>
            <a href={`sms:?&body=${encodeURIComponent(shareText ?? "")}`}>
              <MessageSquare className="size-4" /> SMS
            </a>
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!shareText}
              onClick={() => void navigator.share({ title: "Pay me on Fin3a", text: shareText!, ...(payLink ? { url: payLink } : {}) }).catch(() => {})}
            >
              <Share2 className="size-4" /> More apps
            </Button>
          ) : null}
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Only your name, Fin3a ID and payment link are shared. Your balance, transactions, phone number and sign-in
          details are never visible to people you share with. Incoming payments appear in your account activity.
        </p>
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Camera, Download, Loader2, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getShareProfile } from "@/lib/share-split.functions";
import { cancelQrRequest, createQrRequest, getMyQrRequests, logQrScan, resolveQrRequest } from "@/lib/qr-payments.functions";
import { formatQrAmount, parseScannedQr, qrProfileUrl, qrRequestUrl, QR_EXPIRY_OPTIONS } from "@/lib/qr-payments";
import { pageMeta } from "@/lib/page-meta";

const shareQuery = () =>
  queryOptions({ queryKey: ["accounts", "share-profile"], queryFn: () => getShareProfile(), staleTime: 60_000 });
const requestsQuery = () =>
  queryOptions({ queryKey: ["qr", "my-requests"], queryFn: () => getMyQrRequests(), staleTime: 15_000 });

export const Route = createFileRoute("/_authenticated/accounts_/qr")({
  head: () => pageMeta("QR payments", "Show your Fin3a payment QR, scan another user's code, or create a fixed payment request."),
  loader: ({ context }) => context.queryClient.ensureQueryData(shareQuery()),
  component: Page,
});

function downloadQr(svgId: string, filename: string) {
  const svg = document.getElementById(svgId)?.querySelector("svg");
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, 0, 0, 512, 512);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };
  img.src = `data:image/svg+xml;base64,${btoa(xml)}`;
}

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(shareQuery());
  const { data: requests } = useQuery(requestsQuery());
  const [scanning, setScanning] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Fixed request form
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState<number | null>(1440);
  const [creating, setCreating] = useState(false);
  const [newRequestId, setNewRequestId] = useState<string | null>(null);
  const originRef = useRef<string>("");
  if (typeof window !== "undefined" && !originRef.current) originRef.current = window.location.origin;
  const origin = originRef.current;

  const profileUrl = profile.fin3aId && origin ? qrProfileUrl(origin, profile.fin3aId) : null;

  async function handleScan(text: string) {
    const parsed = parseScannedQr(text);
    if (parsed.kind === "fin3a_request") {
      setScanning(false);
      setResolving(true);
      try {
        const details = await resolveQrRequest({ data: { requestId: parsed.requestId } });
        if (details.status === "open" && !details.isOwn) {
          void navigate({ to: "/pay/qr/$requestId", params: { requestId: parsed.requestId } });
        } else if (details.isOwn) {
          toast.info("This is your own payment request");
        } else {
          toast.error(`This payment request is ${details.status}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read this payment request");
      } finally {
        setResolving(false);
      }
    } else if (parsed.kind === "fin3a_profile") {
      setScanning(false);
      void logQrScan({ data: { kind: "fin3a_profile", detail: parsed.fin3aId } });
      void navigate({ to: "/pay/$fin3aId", params: { fin3aId: parsed.fin3aId } });
    } else if (parsed.kind === "external") {
      void logQrScan({ data: { kind: "external", detail: parsed.url } });
      toast.warning("This is an external QR code, not a Fin3a payment", { description: parsed.url });
    } else {
      void logQrScan({ data: { kind: "invalid" } });
      toast.error("This QR code is not a valid Fin3a payment code");
    }
  }

  async function handleCreate() {
    const parsedAmount = amount.trim() ? Number(amount) : null;
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setCreating(true);
    try {
      const { requestId } = await createQrRequest({
        data: { amount: parsedAmount, currency, description: description.trim() || undefined, expiresInMinutes: expiry },
      });
      setNewRequestId(requestId);
      setAmount("");
      setDescription("");
      toast.success("Payment request created");
      await queryClient.invalidateQueries({ queryKey: ["qr", "my-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the request");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">QR Payments</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Show your code to receive money, scan another user's code to pay, or create a fixed payment request.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* My Payment QR */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <QrCode className="size-4 text-primary" /> My Payment QR
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Other Fin3a users scan this to pay you.</p>
          <div className="mt-4 flex flex-col items-center gap-4">
            {profileUrl ? (
              <div id="my-qr" className="rounded-xl border border-border bg-white p-4">
                <QRCode value={profileUrl} size={180} />
              </div>
            ) : (
              <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                QR unavailable
              </div>
            )}
            <div className="text-center">
              <p className="font-medium">{profile.displayName ?? "Fin3a user"}</p>
              <p className="font-mono text-sm text-primary">{profile.fin3aId ?? ""}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" disabled={!profileUrl} onClick={() => downloadQr("my-qr", "fin3a-payment-qr.png")}>
                <Download className="size-4" /> Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!profileUrl}
                onClick={() => void navigator.clipboard.writeText(profileUrl!).then(() => toast.success("Payment link copied"))}
              >
                Copy link
              </Button>
            </div>
          </div>
        </section>

        {/* Scan to Pay */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Camera className="size-4 text-primary" /> Scan to Pay
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan another user's Fin3a QR code. You'll review the recipient and amount before anything is paid.
          </p>
          <div className="mt-4 flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border">
            <Camera className="size-8 text-muted-foreground" />
            <Button onClick={() => setScanning(true)} disabled={resolving}>
              {resolving ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Open camera
            </Button>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p>Payments are never made automatically — you always confirm the recipient and amount first.</p>
          </div>
        </section>
      </div>

      {/* Fixed payment request */}
      <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Ticket className="size-4 text-primary" /> Request a fixed payment
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a QR code for a specific amount. When scanned, the details fill in automatically — the payer still confirms.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount (optional)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Request amount"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")}
            aria-label="Currency"
          >
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
          <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={expiry === null ? "never" : String(expiry)}
            onChange={(e) => setExpiry(e.target.value === "never" ? null : Number(e.target.value))}
            aria-label="Expiry"
          >
            {QR_EXPIRY_OPTIONS.map((o) => (
              <option key={o.label} value={o.minutes === null ? "never" : String(o.minutes)}>{o.label}</option>
            ))}
          </select>
        </div>
        <Button className="mt-3" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Create request QR
        </Button>

        {newRequestId && origin ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-secondary/40 p-4">
            <div id="request-qr" className="rounded-xl border border-border bg-white p-4">
              <QRCode value={qrRequestUrl(origin, newRequestId)} size={160} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadQr("request-qr", "fin3a-request-qr.png")}>
                <Download className="size-4" /> Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(qrRequestUrl(origin, newRequestId)).then(() => toast.success("Request link copied"))}
              >
                Copy link
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Recent requests */}
      {requests && requests.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Your recent requests</h2>
          <ul className="mt-3 divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.description ?? "Payment request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatQrAmount(r.amount, r.currency)}
                    {r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      r.status === "paid"
                        ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        : r.status === "open"
                          ? "rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                          : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                    }
                  >
                    {r.status}
                  </span>
                  {r.status === "open" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void cancelQrRequest({ data: { requestId: r.id } })
                          .then(() => queryClient.invalidateQueries({ queryKey: ["qr", "my-requests"] }))
                          .catch(() => toast.error("Could not cancel"))
                      }
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scanning ? <QrScanner onScan={handleScan} onClose={() => setScanning(false)} /> : null}
    </AppShell>
  );
}

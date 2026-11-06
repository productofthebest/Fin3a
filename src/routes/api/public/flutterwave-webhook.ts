import { createFileRoute } from "@tanstack/react-router";
import { handleWebhook, WEBHOOK_VERSION } from "@/lib/flutterwave-webhook";

// Flutterwave calls this after a payment. The shared hash proves the sender,
// and the payment is re-verified with Flutterwave before any wallet credit.
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      GET: () => Response.json({ version: WEBHOOK_VERSION, ready: Boolean(process.env["FLW_WEBHOOK_HASH"] && process.env["FLW_SECRET_KEY"]), signature: "v3-verif-hash" }, { headers: { "Cache-Control": "no-store" } }),
      POST: async ({ request }) => {
        return handleWebhook(request, process.env["FLW_WEBHOOK_HASH"], async notice => {
          if (notice.kind === "transfer") {
            const { processTransferNotice } = await import("@/lib/ngn-withdrawal.server");
            return processTransferNotice(notice.id, notice.reference);
          }
          const { processTopupNotice } = await import("@/lib/ngn-topup.server");
          return processTopupNotice(notice);
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

// Flutterwave calls this after a payment. The shared hash proves the sender,
// and the payment is re-verified with Flutterwave before any wallet credit.
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["FLW_WEBHOOK_HASH"];
        const got = request.headers.get("verif-hash");
        if (!expected || !got || got.length !== expected.length) return new Response("Unauthorized", { status: 401 });
        let diff = 0;
        for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
        if (diff !== 0) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as { event?: string; data?: { tx_ref?: string } } | null;
        const txRef = body?.data?.tx_ref;
        if (body?.event !== "charge.completed" || typeof txRef !== "string" || !/^F3T-[0-9a-f-]{36}$/.test(txRef)) return new Response("ok");
        const { settleTopup } = await import("@/lib/ngn-topup.server");
        try { await settleTopup(txRef); } catch { return new Response("retry", { status: 500 }); }
        return new Response("ok");
      },
    },
  },
});

import { relayOrigin } from "./withdrawal-production";

/** Payouts and hosted collections use fixed egress; unrelated Flutterwave APIs remain unchanged. */
export async function payoutFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!/^\/(?:transfers(?:\/[1-9]\d{0,19}|\?reference=F3[WX]-[0-9a-f-]{36})?|transactions\/[1-9]\d{0,19}\/verify)$/.test(path)) throw new Error("INVALID_PAYOUT_PATH");
  const origin = relayOrigin(process.env["FLW_PAYOUT_RELAY_URL"]);
  const token = process.env["FLW_PAYOUT_RELAY_TOKEN"];
  if (!origin || !token) throw new Error("PAYOUT_TRANSPORT_UNAVAILABLE");
  // Flutterwave credentials live on the relay, never forwarded from Fin3a or exposed to the browser.
  return fetch(`${origin}/v1/flutterwave${path}`, {
    ...init,
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
}

/** Hosted checkout only: card details are entered on Flutterwave, never sent through Fin3a. */
export async function collectionFetch(init: RequestInit): Promise<Response> {
  const origin = relayOrigin(process.env["FLW_PAYOUT_RELAY_URL"]);
  const token = process.env["FLW_PAYOUT_RELAY_TOKEN"];
  if (!origin || !token) throw new Error("COLLECTION_TRANSPORT_UNAVAILABLE");
  return fetch(`${origin}/v1/flutterwave/payments`, {
    ...init,
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
}

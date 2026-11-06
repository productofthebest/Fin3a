import { relayOrigin } from "./withdrawal-production";

/** Only payout operations use fixed egress; incoming top-up and bill APIs are unchanged. */
export async function payoutFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!/^\/transfers(?:\/[1-9]\d{0,19}|\?reference=F3W-[0-9a-f-]{36})?$/.test(path)) throw new Error("INVALID_PAYOUT_PATH");
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
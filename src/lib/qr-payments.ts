// Pure QR payment helpers: payload building/parsing and display formatting.
// QR codes only ever encode a URL with an opaque identifier — never amounts
// alone, credentials, balances, or personal data.

export type ScannedQr =
  | { kind: "fin3a_profile"; fin3aId: string }
  | { kind: "fin3a_request"; requestId: string }
  | { kind: "external"; url: string }
  | { kind: "invalid"; raw: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIN3A_ID_RE = /^FIN-[0-9A-F]{8}$/;

/** URL encoded into a fixed-payment-request QR code. */
export function qrRequestUrl(origin: string, requestId: string): string {
  return `${origin}/pay/qr/${requestId}`;
}

/** URL encoded into a user's personal "My Payment QR" code. */
export function qrProfileUrl(origin: string, fin3aId: string): string {
  return `${origin}/pay/${fin3aId}`;
}

/**
 * Classify scanned QR text. Accepts Fin3a URLs from any origin (the request
 * id is opaque and re-validated server-side) plus path-only payloads.
 * Everything else is external (safe URL display) or invalid.
 */
export function parseScannedQr(raw: string): ScannedQr {
  const text = raw.trim();
  if (!text) return { kind: "invalid", raw };

  // Path-only payloads (e.g. generated in tests or copied without origin).
  const pathMatch = text.match(/^\/pay\/(qr\/)?([A-Za-z0-9-]+)\/?$/);
  if (pathMatch) {
    return pathMatch[1]
      ? { kind: "fin3a_request", requestId: pathMatch[2] }
      : { kind: "fin3a_profile", fin3aId: pathMatch[2].toUpperCase() };
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { kind: "invalid", raw: text.slice(0, 120) };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "invalid", raw: text.slice(0, 120) };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "pay" && segments.length === 2 && FIN3A_ID_RE.test(segments[1].toUpperCase())) {
    return { kind: "fin3a_profile", fin3aId: segments[1].toUpperCase() };
  }
  if (segments[0] === "pay" && segments[1] === "qr" && segments.length === 3 && UUID_RE.test(segments[2])) {
    return { kind: "fin3a_request", requestId: segments[2] };
  }
  return { kind: "external", url: text.slice(0, 300) };
}

export function isRequestExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < now.getTime();
}

export function formatQrAmount(amount: number | null, currency: string): string {
  if (amount === null) return `Any amount (${currency})`;
  const symbol = currency === "NGN" ? "₦" : currency === "USD" ? "$" : "";
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export const QR_EXPIRY_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
  { label: "Never", minutes: null },
] as const;

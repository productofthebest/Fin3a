// Pure OTP rules shared by the server and tests. No secrets or I/O here.
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_PER_PHONE_HOUR = 5;
export const OTP_MAX_PER_IP_HOUR = 15;

export function generateOtp(): string {
  const buf = new Uint32Array(1);
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  do crypto.getRandomValues(buf); while (buf[0]! >= limit);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

export async function hashOtp(secret: string, phone: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${phone}:${code}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SendHistory = { lastSentAt: number | null; phoneSendsLastHour: number; ipSendsLastHour: number };

/** Returns null when a new code may be sent, otherwise a user-facing reason. */
export function sendBlockReason(h: SendHistory, now: number): string | null {
  if (h.lastSentAt && now - h.lastSentAt < OTP_RESEND_SECONDS * 1000) {
    const wait = Math.ceil((OTP_RESEND_SECONDS * 1000 - (now - h.lastSentAt)) / 1000);
    return `Please wait ${wait}s before requesting another code.`;
  }
  if (h.phoneSendsLastHour >= OTP_MAX_PER_PHONE_HOUR) return "Too many codes requested for this number. Try again in an hour.";
  if (h.ipSendsLastHour >= OTP_MAX_PER_IP_HOUR) return "Too many code requests from this device. Try again later.";
  return null;
}

export type OtpRecord = { code_hash: string; attempts: number; expires_at: string; consumed_at: string | null };

export type VerifyOutcome = "ok" | "expired" | "locked" | "wrong" | "missing";

export function checkOtp(rec: OtpRecord | null, candidateHash: string, now: number): VerifyOutcome {
  if (!rec || rec.consumed_at) return "missing";
  if (new Date(rec.expires_at).getTime() <= now) return "expired";
  if (rec.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  return safeEqual(rec.code_hash, candidateHash) ? "ok" : "wrong";
}

export const VERIFY_MESSAGES: Record<Exclude<VerifyOutcome, "ok">, string> = {
  missing: "No active code for this number. Request a new code.",
  expired: "This code has expired. Request a new code.",
  locked: "Too many wrong attempts. Request a new code.",
  wrong: "That code is incorrect.",
};

/** Synthetic, non-deliverable login email for phone-only accounts. */
export function phoneLoginEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.fin3a.local`;
}

import { z } from "zod";

export const GUEST_MODEL = "gpt-5-mini";
export const GUEST_MAX_OUTPUT = 1200;
export const guestMessageSchema = z.object({ message: z.string().trim().min(1).max(2000) }).strict();
export const GUEST_INSTRUCTIONS = `You are Fin3a AI, a personal financial intelligence assistant.
You have no access to account records. Answer general public questions on science, technology, sports, history, travel, current events and finance. Do not force unrelated questions into a financial interpretation. Keep answers under 180 words in plain text. Retain ordinary safety restrictions; do not help bypass logins or paywalls or reveal private personal information.
Never invent the person's income, spending, balances or commitments. If personal records are needed, invite them to sign in for answers from their own records.
Do not request passwords, verification codes, API keys or account credentials. Do not recommend crypto, trading or specific investment products. When PUBLIC WEB EVIDENCE is supplied, label those facts Web and disclose dates and uncertainty; otherwise do not claim live rates or current news. You are not a licensed financial adviser.`;

export function guestLimitMessage(reason?: string) {
  if (reason === "disabled") return "Fin3a AI is temporarily paused. Please try again later.";
  if (reason === "limit") return "Guest questions have reached their limit. Sign in for personal answers or try again tomorrow.";
  if (reason === "budget") return "Guest AI has reached its spending allowance. Please try again later.";
  return "Fin3a AI is temporarily unavailable. Please try again later.";
}

/** Same-origin browser requests only; this is a secondary check, not identity or bot verification. */
export function isGuestOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
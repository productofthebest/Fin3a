import { accountHelpIntent } from "./account-help";

export const PUBLIC_QUESTION_ERROR = "For web searches, remove personal details, account numbers and credentials, then ask a public-topic question.";

/** Public question only: this is a conservative detector, not guaranteed anonymisation. */
export function homepageSearchQuestion(question: string): { query: string | null; error?: string } {
  const text = question.trim();
  if (!text || text.length > 2000) return { query: null, error: "Enter a question of up to 2,000 characters." };
  const sensitive = [
    /\b0x[a-f0-9]{40}\b|\b(?:bc1|ltc1)[a-z0-9]{20,}\b|\b[13T][1-9A-HJ-NP-Za-km-z]{25,34}\b/i,
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
    /\b(?:\d[\s()-]?){8,}\b/,
    /\b(?:password|passcode|otp|verification code|api[-_ ]?key|access token|secret key|private key|bearer|ssn|social security|passport|account number|card number|iban)\b/i,
    /\b(?:sk-[a-z0-9_-]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/i,
    /\bmy (?:name|address|phone|email|medical|diagnosis|date of birth)\b/i,
    /\b(?:i earn|i owe|i have|my salary|my income|my balance|my account|my spending|my debt)\b[^.!?]*\d/i,
  ];
  if (sensitive.some((pattern) => pattern.test(text))) return { query: null, error: PUBLIC_QUESTION_ERROR };
  if (accountHelpIntent(text)) return { query: null };
  // Own-record questions remain private answers rather than public searches.
  if (/\b(?:my|our)\b.*\b(?:balance|income|spending|expenses|transactions|bills|goals|records|salary|debt|account)\b|\b(?:did i spend|can i afford|my money)\b/i.test(text)) return { query: null };
  return { query: text };
}
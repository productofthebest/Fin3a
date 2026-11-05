export type AccountHelpIntent = "deposit" | "withdraw" | "details";

/** Fixed navigation only. No amount, address, identity or credential is extracted into chat. */
export function accountHelpIntent(text: string): AccountHelpIntent | null {
  if (/\b(?:withdraw\w*|cash out)\b/i.test(text)) return "withdraw";
  if (/\b(?:deposit\w*|top[ -]?up)\b/i.test(text)) return "deposit";
  if (/\b(?:crypto|bitcoin|btc|usdc|usdt|bank|account|wallet)\b.*\b(?:address|details|number)\b|\b(?:address|details|number)\b.*\b(?:crypto|bitcoin|bank|account|wallet)\b/i.test(text)) return "details";
  return null;
}

export const ACCOUNT_HELP_TEXT: Record<AccountHelpIntent, string> = {
  deposit: "Crypto deposits convert to your chosen NGN or USD balance for that deposit. Only verified provider-supported coins and networks can be used. Deposit instructions are not available yet. Open your wallet page to review availability and fees.",
  withdraw: "NGN bank withdrawals and USD withdrawals using USDC or USDT require a verified provider quote and your confirmation. Withdrawals are not available yet. Enter payment details only on your signed-in wallet page, never in chat.",
  details: "Your balances and any available deposit addresses belong on your signed-in wallet page. Bank details and crypto deposit addresses are not available yet. Never share passwords, verification codes, private keys or recovery phrases in chat.",
};
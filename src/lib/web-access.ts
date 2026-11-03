export const WEB_RESERVATION_USD = 0.22;
export const WEB_CALL_USD = 0.01;
export const WEB_MAX_CALLS = 1;
export type WebSource = { url: string; title: string };

/** Only literal public templates leave the app: never user text or financial snapshots. */
export function publicSearchQuery(question: string): string | null {
  const q = question.toLowerCase();
  if (/exchange|naira|dollar.*rate|currency.*rate|forex/.test(q)) {
    return /naira|nigeria|\bngn\b/.test(q)
      ? "Current USD NGN exchange rate Central Bank of Nigeria official rate date"
      : "Current official major currency exchange rates central bank date";
  }
  if (/tax/.test(q)) {
    const country = ["Nigeria", "Ghana", "Kenya", "United Kingdom", "United States", "Canada", "South Africa", "India"].find((c) => q.includes(c.toLowerCase()));
    return country ? `Current ${country} personal income tax rules official government date` : "Current personal income tax guidance official government country differences";
  }
  if (/inflation|interest rate|financial news|economic news|latest news/.test(q)) return "Latest inflation interest rates economic financial news official central banks date";
  return null;
}

export function safeWebSources(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    try {
      const url = new URL(s.url);
      if (url.protocol !== "https:" || url.username || url.password || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  }).slice(0, 8);
}

export function webCost(input: number, output: number, calls: number) {
  if (![input, output, calls].every((n) => Number.isInteger(n) && n >= 0) || calls > WEB_MAX_CALLS) return null;
  return (input * 0.25 + output * 2) / 1_000_000 + calls * WEB_CALL_USD;
}
// Shared, browser-safe helpers for Top Floor company identity knowledge.
export const TOPFLOOR_SITE = "https://topfloorr.com";

const IDENTITY_PATTERNS = [
  /\btop\s*floor\b/i,
  /\btopfloorr?\b/i,
  /who (?:owns?|founded|created|made|built|is behind|runs?) (?:fin3a|this app|this)/i,
  /(?:owner|founder|parent company|company) (?:of|behind) (?:fin3a|this app)/i,
  /is fin3a (?:independent|owned|a (?:subsidiary|product|brand))/i,
  /fin3a.{0,50}(?:owned|ownership|parent|subsidiary)/i,
  /(?:what|which) company (?:is )?(?:behind|owns?) (?:fin3a|this)/i,
];

/** Detects questions about Fin3a's ownership or Top Floor. Conservative: generic "top floor" mentions also match. */
export function isCompanyIdentityQuestion(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 2000) return false;
  return IDENTITY_PATTERNS.some((p) => p.test(t));
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
};

/** Strips HTML to readable text. Untrusted input is treated as data only. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, name: string) => {
      const key = name.toLowerCase();
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16) || 32);
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10) || 32);
      return ENTITY_MAP[key] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|json|xml|pdf|zip|woff2?|ttf|mp4|webm|mp3)(?:$|[?#])/i;

/** Same-origin https page links found in HTML, deduped, assets excluded, capped. */
export function extractSameSiteLinks(html: string, site: string, max = 8): string[] {
  let origin: string;
  try {
    origin = new URL(site).origin;
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
    try {
      const url = new URL(raw, origin);
      if (url.origin !== origin || url.protocol !== "https:") continue;
      url.hash = "";
      const href = url.href;
      if (ASSET_EXTENSIONS.test(href) || seen.has(href)) continue;
      seen.add(href);
      links.push(href);
      if (links.length >= max) break;
    } catch {
      continue;
    }
  }
  return links;
}

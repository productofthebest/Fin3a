export function pageMeta(title: string, description: string) {
  return { meta: [
    { title: `${title} — Fin3a AI` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Fin3a AI` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}
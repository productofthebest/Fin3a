import { createFileRoute, redirect } from "@tanstack/react-router";
import { createThread } from "@/lib/assistant.functions";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/assistant/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Fin3a AI" },
      { name: "description", content: "Ask Fin3a AI about your spending, runway and what-if scenarios." },
      { property: "og:title", content: "Dashboard — Fin3a AI" },
      { property: "og:description", content: "Ask Fin3a AI about your spending, runway and what-if scenarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    const target = await createThread();
    throw redirect({ to: "/assistant/$threadId", params: { threadId: target.id }, replace: true });
  },
});

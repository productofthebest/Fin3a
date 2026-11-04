import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

// The Dashboard is now the AI Assistant; keep /dashboard working for sign-in redirects and bookmarks.
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta("Dashboard", "Fin3a personal financial assistant dashboard."),
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/assistant", replace: true });
  },
});

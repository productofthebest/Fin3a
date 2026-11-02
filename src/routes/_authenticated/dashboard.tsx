import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is now the AI Assistant; keep /dashboard working for sign-in redirects and bookmarks.
export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/assistant", replace: true });
  },
});

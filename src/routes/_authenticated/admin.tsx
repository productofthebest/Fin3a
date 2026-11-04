import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

// Preserve the public URL without exposing the retired AI administration screen.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMeta("Administration", "Fin3a account administration and financial operations."),
  beforeLoad: () => { throw redirect({ to: "/admin-overview", replace: true }); },
});

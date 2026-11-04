import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pathless auth gate: every route under /_authenticated requires a signed-in
 * session. Client-only (ssr: false) because the session lives in browser
 * storage and cannot be read during SSR.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Local session read (no network round trip); every server function still verifies the token.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

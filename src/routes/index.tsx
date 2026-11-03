import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LandingAssistant } from "@/components/landing-assistant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fin3a AI — Personal Financial Intelligence" },
      {
        name: "description",
        content: "Understand how you earn, how you spend, and how long your money will last.",
      },
      { property: "og:title", content: "Fin3a AI — Personal Financial Intelligence" },
      {
        property: "og:description",
        content: "Understand how you earn, how you spend, and how long your money will last.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  // OAuth (Google / Lovable) returns to this origin — send signed-in users in.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <span className="font-display text-lg font-semibold tracking-tight">
          Fin<span className="text-primary">3a</span>
        </span>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <p className="max-w-xl text-lg text-primary">
          Fin3a AI tracks what you earn, what you spend, and what's coming due — then turns it into
          clear, personal financial intelligence.
        </p>
      </section>

      <LandingAssistant />

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Zap className="size-4 fill-topfloor-gold" />
          <span className="text-topfloor-gold">Powered by</span>{" "}
          <span className="text-topfloor-gold">Top Floor</span>
        </p>
      </div>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © 2026 Fin3a AI. All rights reserved.
      </footer>
    </div>
  );
}

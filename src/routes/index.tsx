import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ChartLine, ScanLine, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="font-display text-lg font-semibold tracking-tight">
          Fin<span className="text-primary">3a</span>
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">By Top Floor</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Know exactly how your money moves — and how long it will last.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Fin3a AI tracks what you earn, what you spend, and what's coming due — then turns it into
          clear, personal financial intelligence.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Get started <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth">I already have an account</Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: "Track every naira and dollar",
              body: "Log income and expenses in your own currency, with categories and recurring bills handled for you.",
            },
            {
              icon: ChartLine,
              title: "See the full picture",
              body: "Cash flow by month, spending by category, pending money and available funds — on one dashboard.",
            },
            {
              icon: ScanLine,
              title: "Scan, don't type",
              body: "Soon: snap a receipt, teller slip or statement and Fin3a reads the numbers for you.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Fin3a AI — a Top Floor product
      </footer>
    </div>
  );
}

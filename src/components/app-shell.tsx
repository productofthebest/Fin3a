import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getIsAdmin } from "@/lib/admin.functions";
import { LogOut, QrCode } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/assistant", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/spending", label: "Spending" },
  { to: "/activity", label: "Activity" },
  { to: "/categories", label: "Categories" },
  { to: "/bills", label: "Bills" },
  { to: "/analysis", label: "Analysis" },
  { to: "/planning", label: "Planning" },
  { to: "/goals", label: "Goals" },
  { to: "/insights", label: "Insights" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const { data: isAdmin } = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin(), staleTime: 300_000 });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/dashboard" className="font-display text-lg font-semibold tracking-tight">
            Fin<span className="text-primary">3a</span>
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  (item.to === "/assistant" ? pathname.startsWith("/assistant") : pathname === item.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            {settings?.currency ? (
              <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {settings.currency}
              </span>
            ) : null}
            {settings?.display_name ? (
              <span className="hidden text-sm text-muted-foreground md:inline">{settings.display_name}</span>
            ) : null}
            <Link to="/security" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Phone</Link>
            {isAdmin ? <Link to="/admin" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Admin</Link> : null}
            <Link
              to="/accounts/qr"
              title="Scan or Receive Payment"
              aria-label="Scan or Receive Payment"
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <QrCode className="size-4" />
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                (item.to === "/assistant" ? pathname.startsWith("/assistant") : pathname === item.to)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}

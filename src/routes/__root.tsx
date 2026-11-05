import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { createSessionCacheHandler } from "@/lib/session-cache";
import { Button } from "@/components/ui/button";
import { isModuleLoadError, recoverBrowserModuleLoad } from "@/lib/module-load-recovery";
import { isTransientNetworkError } from "@/lib/network-retry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const connectionDrop = isTransientNetworkError(error);
  useEffect(() => {
    if (connectionDrop) {
      // A dropped connection is not an app defect: retry when the phone is back online or visible.
      const retry = () => {
        if (navigator.onLine && document.visibilityState === "visible") {
          router.invalidate();
          reset();
        }
      };
      const onVisible = () => { if (document.visibilityState === "visible") retry(); };
      const timer = window.setTimeout(retry, 3_000);
      window.addEventListener("online", retry);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("online", retry);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    recoverBrowserModuleLoad(error);
    return undefined;
  }, [error, connectionDrop, router, reset]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {connectionDrop ? "Connection interrupted" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {connectionDrop
            ? "Your connection dropped for a moment. Fin3a will reconnect automatically, or tap Try again."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              if (isModuleLoadError(error)) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fin3a AI — Personal Financial Intelligence" },
      { name: "description", content: "Understand how you earn, how you spend, and how long your money will last." },
      { name: "author", content: "Top Floor" },
      { property: "og:title", content: "Fin3a AI — Personal Financial Intelligence" },
      { property: "og:description", content: "Understand how you earn, how you spend, and how long your money will last." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const handlePreloadError = (event: Event) => {
      const error = (event as Event & { payload?: unknown }).payload;
      if (recoverBrowserModuleLoad(error)) event.preventDefault();
    };
    window.addEventListener("vite:preloadError", handlePreloadError);
    return () => window.removeEventListener("vite:preloadError", handlePreloadError);
  }, []);

  // Re-validate identity transitions so route gates and caches stay fresh.
  useEffect(() => {
    const handleSession = createSessionCacheHandler(queryClient, () => router.invalidate());
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(event, session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}

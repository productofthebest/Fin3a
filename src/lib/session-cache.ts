import type { QueryClient } from "@tanstack/react-query";

/** Query keys are account-agnostic, so never retain them across identities. */
export function createSessionCacheHandler(queryClient: QueryClient, invalidateRoutes: () => unknown) {
  let previousUserId: string | null | undefined;
  return (event: string, userId: string | null) => {
    if (event === "INITIAL_SESSION") {
      previousUserId = userId;
      return;
    }
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    if (event === "SIGNED_OUT" || previousUserId !== userId) {
      // Cancel first; clear synchronously before the next account can render.
      void queryClient.cancelQueries();
      queryClient.clear();
    }
    previousUserId = userId;
    void invalidateRoutes();
    if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
  };
}
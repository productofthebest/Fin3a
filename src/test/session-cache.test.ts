import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createSessionCacheHandler } from "@/lib/session-cache";

describe("account cache isolation", () => {
  it("removes private data immediately on logout without refetching signed-out queries", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const routes = vi.fn();
    const handler = createSessionCacheHandler(client, routes);
    handler("INITIAL_SESSION", "account-a");
    client.setQueryData(["dashboard", 0], { private: "account-a" });
    handler("SIGNED_OUT", null);
    expect(client.getQueryData(["dashboard", 0])).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
    expect(routes).toHaveBeenCalledOnce();
  });
  it("cannot return the previous account's settings or documents after account switching", () => {
    const client = new QueryClient();
    const handler = createSessionCacheHandler(client, vi.fn());
    handler("INITIAL_SESSION", "account-a");
    client.setQueryData(["settings"], { user_id: "account-a" });
    client.setQueryData(["documents"], ["account-a-document"]);
    handler("SIGNED_IN", "account-b");
    expect(client.getQueryData(["settings"])).toBeUndefined();
    expect(client.getQueryData(["documents"])).toBeUndefined();
  });
  it("does not thrash caches or routes on token refresh", () => {
    const client = new QueryClient();
    const routes = vi.fn();
    const handler = createSessionCacheHandler(client, routes);
    handler("INITIAL_SESSION", "account-a");
    client.setQueryData(["settings"], { user_id: "account-a" });
    handler("TOKEN_REFRESHED", "account-a");
    expect(client.getQueryData(["settings"])).toEqual({ user_id: "account-a" });
    expect(routes).not.toHaveBeenCalled();
  });
});
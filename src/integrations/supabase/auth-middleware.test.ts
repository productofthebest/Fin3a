import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: null as Request | null,
  getClaims: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    server: (handler: (args: { next: (options?: unknown) => unknown }) => unknown) => handler,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => mocks.request }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return { auth: { getClaims: mocks.getClaims } };
  },
}));

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const middleware = requireSupabaseAuth as unknown as (args: {
  next: (options?: unknown) => unknown;
}) => Promise<unknown>;

describe("Supabase claims middleware used by payout server functions", () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";
    mocks.request = new Request("https://app.example.test", {
      headers: { authorization: "Bearer header.payload.signature" },
    });
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "verified-user-123", role: "authenticated" } },
      error: null,
    });
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("passes only the verified claims subject into server-function context", async () => {
    const next = vi.fn().mockResolvedValue("continued");
    await expect(middleware({ next })).resolves.toBe("continued");
    expect(mocks.getClaims).toHaveBeenCalledWith("header.payload.signature");
    expect(next).toHaveBeenCalledWith({
      context: expect.objectContaining({
        userId: "verified-user-123",
        claims: { sub: "verified-user-123", role: "authenticated" },
        supabase: expect.any(Object),
      }),
    });
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test_key",
      expect.objectContaining({
        global: expect.objectContaining({
          headers: { Authorization: "Bearer header.payload.signature" },
        }),
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
  });

  it("rejects requests without a bearer token before creating a Supabase client", async () => {
    mocks.request = new Request("https://app.example.test");
    await expect(middleware({ next: vi.fn() })).rejects.toThrow("Unauthorized: No authorization header provided");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed bearer tokens", async () => {
    mocks.request = new Request("https://app.example.test", {
      headers: { authorization: "Bearer not-a-jwt" },
    });
    await expect(middleware({ next: vi.fn() })).rejects.toThrow("Unauthorized: Invalid token");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects tokens that Supabase cannot validate", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: new Error("invalid") });
    await expect(middleware({ next: vi.fn() })).rejects.toThrow("Unauthorized: Invalid token");
  });

  it("rejects verified claims without a subject", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { role: "authenticated" } }, error: null });
    await expect(middleware({ next: vi.fn() })).rejects.toThrow("Unauthorized: No user ID found in token");
  });

  it("fails closed when Supabase environment configuration is missing", async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await expect(middleware({ next: vi.fn() })).rejects.toThrow("Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

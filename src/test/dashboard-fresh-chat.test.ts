import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createThread: vi.fn(),
  listThreads: vi.fn(),
}));

vi.mock("@/lib/assistant.functions", () => mocks);
vi.mock("@/lib/queries", () => ({ settingsQuery: () => ({ queryKey: ["settings"] }) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => options,
}));

import { Route } from "@/routes/_authenticated/assistant.index";

describe("Dashboard entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts a new conversation on every return instead of reopening history", async () => {
    mocks.createThread.mockResolvedValueOnce({ id: "first" }).mockResolvedValueOnce({ id: "second" });
    const loader = (Route as unknown as { loader: (args: unknown) => Promise<unknown> }).loader;
    const args = { context: { queryClient: { ensureQueryData: vi.fn().mockResolvedValue({ onboarding_completed: true }) } } };
    await expect(loader(args)).rejects.toMatchObject({ params: { threadId: "first" } });
    await expect(loader(args)).rejects.toMatchObject({ params: { threadId: "second" } });
    expect(mocks.createThread).toHaveBeenCalledTimes(2);
    expect(mocks.listThreads).not.toHaveBeenCalled();
  });
});
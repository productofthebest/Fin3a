import { describe, expect, it, vi } from "vitest";
import { isTransientNetworkError, shouldRetryQuery, withNetworkRetry } from "@/lib/network-retry";
import { isModuleLoadError } from "@/lib/module-load-recovery";

describe("connection drop handling", () => {
  it.each(["Load failed", "Failed to fetch", "NetworkError when attempting to fetch resource."])(
    "treats %s as a connection drop, not a broken page file",
    (message) => {
      expect(isTransientNetworkError(new TypeError(message))).toBe(true);
      expect(isModuleLoadError(new TypeError(message))).toBe(false);
    },
  );

  it("does not treat account errors as connection drops", () => {
    expect(isTransientNetworkError(new Error("Insufficient balance"))).toBe(false);
    expect(isTransientNetworkError(new Error("Thread not found"))).toBe(false);
  });

  it("retries a read after a connection drop and returns the result", async () => {
    const read = vi.fn().mockRejectedValueOnce(new TypeError("Load failed")).mockResolvedValue("ok");
    await expect(withNetworkRetry(read, async () => {})).resolves.toBe("ok");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("gives up after 4 attempts", async () => {
    const read = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    await expect(withNetworkRetry(read, async () => {})).rejects.toThrow("Load failed");
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("never retries ordinary errors", async () => {
    const read = vi.fn().mockRejectedValue(new Error("Thread not found"));
    await expect(withNetworkRetry(read, async () => {})).rejects.toThrow("Thread not found");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps one retry for ordinary query failures and three for connection drops", () => {
    expect(shouldRetryQuery(1, new Error("Thread not found"))).toBe(false);
    expect(shouldRetryQuery(2, new TypeError("Load failed"))).toBe(true);
    expect(shouldRetryQuery(3, new TypeError("Load failed"))).toBe(false);
  });
});

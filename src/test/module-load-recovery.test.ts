import { describe, expect, it, vi } from "vitest";
import { isModuleLoadError, recoverModuleLoad } from "@/lib/module-load-recovery";

describe("failed page asset recovery", () => {
  it.each([
    "Importing a module script failed.",
    "Failed to fetch dynamically imported module: /assets/page.js",
    "error loading dynamically imported module",
  ])("recognizes browser module failure: %s", (message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });

  it("reloads once and stops persistent failures from looping", () => {
    const values = new Map<string, string>();
    const reload = vi.fn();
    const browser = {
      storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
      reload,
      now: () => 100_000,
    };
    const error = new TypeError("Importing a module script failed.");
    expect(recoverModuleLoad(error, browser)).toBe(true);
    expect(recoverModuleLoad(error, browser)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads ordinary network or financial errors", () => {
    const reload = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    expect(recoverModuleLoad(new Error("Failed to fetch"), { storage, reload, now: Date.now })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not reload if the loop guard cannot be persisted", () => {
    const reload = vi.fn();
    const storage = { getItem: () => null, setItem: () => { throw new Error("Storage disabled"); } };
    expect(recoverModuleLoad(new Error("Importing a module script failed."), { storage, reload, now: Date.now })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
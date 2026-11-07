import { describe, expect, it, vi } from "vitest";
import { isModuleLoadError, isPreviewReloadError, recoverModuleLoad } from "@/lib/module-load-recovery";

describe("failed page asset recovery", () => {
  const previewHtml = '<html><head><script>window.parent.postMessage({ type: "FORCE_RELOAD" }, "*");</script></head></html>';

  it("recovers the explicit preview refresh response once without replaying requests", () => {
    const values = new Map<string, string>();
    const reload = vi.fn();
    const browser = {
      storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
      reload,
      now: () => 100_000,
    };
    expect(isPreviewReloadError(new Error(previewHtml))).toBe(true);
    expect(recoverModuleLoad(new Error(previewHtml), browser)).toBe(true);
    expect(recoverModuleLoad(new Error(previewHtml), browser)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it.each(["Unauthorized", "401", "FORCE_RELOAD", "<html>Unauthorized</html>", "Insufficient balance"])("does not refresh ordinary access or payment failures: %s", (message) => {
    expect(isPreviewReloadError(new Error(message))).toBe(false);
    const reload = vi.fn();
    expect(recoverModuleLoad(new Error(message), { storage: { getItem: () => null, setItem: vi.fn() }, reload, now: Date.now })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
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
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { isModuleLoadError as isMLE } from "@/lib/module-load-recovery";
d2("stale lazy route chunk", () => {
  i2("treats a missing lazy route export as a page-asset failure", () => {
    e2(isMLE(new Error("undefined is not an object (evaluating 'e[t??`default`]')"))).toBe(true);
    e2(isMLE(new Error("Cannot read properties of undefined (reading 'default')"))).toBe(true);
    e2(isMLE(new Error("Insufficient balance"))).toBe(false);
  });
});

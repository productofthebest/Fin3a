import { describe, expect, it } from "vitest";
import {
  assertSupportedFxPair,
  flutterwaveFxEnabled,
} from "./flutterwave-fx.server";

describe("Flutterwave FX adapter safety", () => {
  it("keeps FX disabled unless both merchant and application gates are enabled", () => {
    expect(flutterwaveFxEnabled({ FLW_SECRET_KEY: "secret" })).toBe(false);
    expect(flutterwaveFxEnabled({
      FLW_SECRET_KEY: "secret",
      FLW_FX_ENABLED: "true",
    })).toBe(false);
    expect(flutterwaveFxEnabled({
      FLW_SECRET_KEY: "secret",
      FLW_FX_MERCHANT_ENABLED: "true",
    })).toBe(false);
    expect(flutterwaveFxEnabled({
      FLW_SECRET_KEY: "secret",
      FLW_FX_ENABLED: "true",
      FLW_FX_MERCHANT_ENABLED: "true",
    })).toBe(true);
  });

  it.each([
    ["NGN", "USD"],
    ["GHS", "USD"],
    ["USD", "NGN"],
  ])("accepts documented pair %s to %s", (base, target) => {
    expect(() => assertSupportedFxPair(base, target)).not.toThrow();
  });

  it.each([
    ["USD", "GHS"],
    ["GHS", "NGN"],
    ["EUR", "USD"],
    ["NGN", "GHS"],
  ])("rejects unsupported pair %s to %s", (base, target) => {
    expect(() => assertSupportedFxPair(base, target)).toThrow("UNSUPPORTED_FX_PAIR");
  });
});

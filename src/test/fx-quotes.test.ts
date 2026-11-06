import { describe, expect, it } from "vitest";
import { calculateFxPairQuote } from "@/lib/fx-quotes";

describe("generic FX pair quote arithmetic", () => {
  it.each([
    ["NGN", "USD", 2800, 1 / 1400, 0, 2],
    ["GHS", "USD", 100, 0.07, 0, 7],
    ["GBP", "USD", 100, 1.25, 0, 125],
    ["EUR", "USD", 100, 1.08, 0, 108],
    ["KES", "USD", 1000, 0.0075, 0, 7.5],
    ["ZAR", "USD", 1000, 0.055, 0, 55],
    ["XOF", "USD", 10000, 0.00165, 0, 16.5],
  ])("calculates %s to %s from an explicit supplied rate", (from, to, amount, rate, feeBps, expected) => {
    expect(calculateFxPairQuote({ fromCurrency: from, toCurrency: to, sourceAmount: amount, rate, feeBps })?.destinationAmount).toBe(expected);
  });

  it("deducts the source-currency fee before converting", () => {
    expect(calculateFxPairQuote({ fromCurrency: "GHS", toCurrency: "USD", sourceAmount: 100, rate: 0.07, feeBps: 100 })).toEqual({
      fromCurrency: "GHS", toCurrency: "USD", sourceAmount: 100, feeAmount: 1,
      netSourceAmount: 99, rate: 0.07, destinationAmount: 6.93,
    });
  });

  it("supports reverse direction with a separately supplied pair rate", () => {
    expect(calculateFxPairQuote({ fromCurrency: "USD", toCurrency: "GHS", sourceAmount: 10, rate: 14.2, feeBps: 0 })?.destinationAmount).toBe(142);
  });

  it("normalizes currency codes and applies destination precision", () => {
    expect(calculateFxPairQuote({ fromCurrency: "gbp", toCurrency: "usd", sourceAmount: 10.123, rate: 1.251, feeBps: 0, sourcePrecision: 2, destinationPrecision: 2 })).toMatchObject({
      fromCurrency: "GBP", toCurrency: "USD", sourceAmount: 10.12, destinationAmount: 12.66,
    });
  });

  it.each([
    { fromCurrency: "USD", toCurrency: "USD", sourceAmount: 10, rate: 1, feeBps: 0 },
    { fromCurrency: "US", toCurrency: "USD", sourceAmount: 10, rate: 1, feeBps: 0 },
    { fromCurrency: "USD", toCurrency: "EUR", sourceAmount: 0, rate: 1, feeBps: 0 },
    { fromCurrency: "USD", toCurrency: "EUR", sourceAmount: 10, rate: 0, feeBps: 0 },
    { fromCurrency: "USD", toCurrency: "EUR", sourceAmount: 10, rate: 1, feeBps: -1 },
    { fromCurrency: "USD", toCurrency: "EUR", sourceAmount: 10, rate: 1, feeBps: 10_000 },
  ])("rejects invalid pair or quote input: $fromCurrency/$toCurrency", input => {
    expect(calculateFxPairQuote(input)).toBeNull();
  });

  it("rejects a result that rounds to zero", () => {
    expect(calculateFxPairQuote({ fromCurrency: "USD", toCurrency: "JPY", sourceAmount: 0.001, rate: 0.001, feeBps: 0 })).toBeNull();
  });
});

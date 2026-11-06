import { describe, expect, it } from "vitest";
import { hasValidFlutterwaveWebhookHash, isValidFlutterwaveWebhookHash } from "./flutterwave-webhook.server";

describe("Flutterwave V3 webhook authentication", () => {
  const secret = "test-only-webhook-secret-hash";

  it("accepts an exact configured verif-hash", () => {
    expect(isValidFlutterwaveWebhookHash(secret, secret)).toBe(true);
    const request = new Request("https://fin3a.example/api/flutterwave/webhook", {
      headers: { "verif-hash": secret },
    });
    expect(hasValidFlutterwaveWebhookHash(request, secret)).toBe(true);
  });

  it("rejects missing, empty, wrong, modified, and oversized values", () => {
    expect(isValidFlutterwaveWebhookHash(null, secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash("", secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash(secret, undefined)).toBe(false);
    expect(isValidFlutterwaveWebhookHash("wrong-secret", secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash(secret + " ", secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash("x".repeat(513), secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash(secret, "x".repeat(513))).toBe(false);
  });

  it("does not normalize case or whitespace", () => {
    expect(isValidFlutterwaveWebhookHash(secret.toUpperCase(), secret)).toBe(false);
    expect(isValidFlutterwaveWebhookHash(" " + secret, secret)).toBe(false);
  });
});

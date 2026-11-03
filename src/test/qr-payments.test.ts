import { describe, expect, it } from "vitest";
import { formatQrAmount, isRequestExpired, parseScannedQr, qrProfileUrl, qrRequestUrl } from "@/lib/qr-payments";

describe("parseScannedQr", () => {
  it("parses a Fin3a profile URL", () => {
    expect(parseScannedQr("https://fin3a.lovable.app/pay/FIN-3589A54F")).toEqual({
      kind: "fin3a_profile",
      fin3aId: "FIN-3589A54F",
    });
  });

  it("parses a Fin3a payment request URL", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(parseScannedQr(`https://fin3a.lovable.app/pay/qr/${id}`)).toEqual({ kind: "fin3a_request", requestId: id });
  });

  it("parses path-only payloads", () => {
    expect(parseScannedQr("/pay/FIN-3589A54F")).toEqual({ kind: "fin3a_profile", fin3aId: "FIN-3589A54F" });
    expect(parseScannedQr("/pay/qr/123e4567-e89b-42d3-a456-426614174000")).toEqual({
      kind: "fin3a_request",
      requestId: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("treats other https URLs as external", () => {
    expect(parseScannedQr("https://example.com/shop")).toEqual({ kind: "external", url: "https://example.com/shop" });
  });

  it("rejects non-URL text and non-http schemes", () => {
    expect(parseScannedQr("hello world").kind).toBe("invalid");
    expect(parseScannedQr("javascript:alert(1)").kind).toBe("invalid");
    expect(parseScannedQr("").kind).toBe("invalid");
  });

  it("treats lookalike paths as external, not Fin3a payments", () => {
    expect(parseScannedQr("https://evil.com/pay/FIN-3589A54F/extra").kind).toBe("external");
    expect(parseScannedQr("https://evil.com/pay/qr/not-a-uuid").kind).toBe("external");
  });
});

describe("payload builders", () => {
  it("builds URLs that round-trip through the parser", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(parseScannedQr(qrRequestUrl("https://app.fin3a.com", id))).toEqual({ kind: "fin3a_request", requestId: id });
    expect(parseScannedQr(qrProfileUrl("https://app.fin3a.com", "FIN-3589A54F"))).toEqual({
      kind: "fin3a_profile",
      fin3aId: "FIN-3589A54F",
    });
  });
});

describe("expiry and formatting", () => {
  it("detects expiry", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(isRequestExpired("2026-11-03T11:00:00Z", now)).toBe(true);
    expect(isRequestExpired("2026-11-03T13:00:00Z", now)).toBe(false);
    expect(isRequestExpired(null, now)).toBe(false);
  });

  it("formats amounts", () => {
    expect(formatQrAmount(15000, "NGN")).toBe("₦15,000.00 NGN");
    expect(formatQrAmount(null, "USD")).toBe("Any amount (USD)");
  });
});

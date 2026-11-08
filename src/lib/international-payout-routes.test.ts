import { describe, expect, it } from "vitest";
import {
  INTERNATIONAL_PAYOUT_ROUTES, evaluateRoute, findRoute, isRouteVerified, isValidAbaRouting, isValidBic, isValidIban,
  normalizeMobileNumber, toMinorUnits, validateBeneficiary, type MerchantRouteVerification,
} from "./international-payout-routes";

const now = new Date("2026-11-08T00:00:00Z");
const gh = { walletCountry: "GH", walletCurrency: "GHS", destinationCountry: "GH", currency: "GHS", method: "mobile_money" as const };
const record = (routeId: string, extra: Partial<MerchantRouteVerification> = {}): MerchantRouteVerification =>
  ({ routeId, verifiedAt: "2026-11-01T00:00:00Z", verifiedBy: "admin-1", evidenceRef: "sandbox-123", ...extra });

describe("route enablement", () => {
  it("disables every route when no verification records exist", () => {
    for (const r of INTERNATIONAL_PAYOUT_ROUTES) expect(isRouteVerified(r, [], now)).toBe(false);
  });
  it("does not treat published coverage as merchant approval", () => {
    expect(evaluateRoute({ ...gh, method: "bank" }, [], now)).toEqual({ ok: false, reason: "not_merchant_verified" });
  });
  it("enables only the exact verified route", () => {
    const res = evaluateRoute(gh, [record("flw:GH:GHS:mobile_money")], now);
    expect(res.ok).toBe(true);
    expect(evaluateRoute({ ...gh, method: "bank" }, [record("flw:GH:GHS:mobile_money")], now).ok).toBe(false);
  });
  it("rejects expired, future, or evidence-less records", () => {
    const id = "flw:GH:GHS:mobile_money";
    expect(evaluateRoute(gh, [record(id, { expiresAt: "2026-11-07T00:00:00Z" })], now).ok).toBe(false);
    expect(evaluateRoute(gh, [record(id, { verifiedAt: "2026-12-01T00:00:00Z" })], now).ok).toBe(false);
    expect(evaluateRoute(gh, [record(id, { evidenceRef: " " })], now).ok).toBe(false);
    expect(evaluateRoute(gh, [record(id, { verifiedBy: "" })], now).ok).toBe(false);
  });
  it("leaves Nigeria on the existing NGN path", () => {
    expect(evaluateRoute({ walletCountry: "NG", walletCurrency: "NGN", destinationCountry: "NG", currency: "NGN", method: "bank" }, [], now))
      .toEqual({ ok: false, reason: "nigeria_uses_ngn_path" });
  });
  it("enforces destination country and currency against the wallet", () => {
    const recs = [record("flw:GH:GHS:mobile_money")];
    expect(evaluateRoute({ ...gh, walletCountry: "KE" }, recs, now)).toEqual({ ok: false, reason: "wallet_country_mismatch" });
    expect(evaluateRoute({ ...gh, walletCurrency: "USD" }, recs, now)).toEqual({ ok: false, reason: "wallet_currency_mismatch" });
    expect(evaluateRoute({ ...gh, currency: "USD" }, recs, now)).toEqual({ ok: false, reason: "unknown_route" });
  });
  it("finds routes case-insensitively", () => {
    expect(findRoute("ke", "kes", "mobile_money")?.networks).toEqual(["MPESA"]);
  });
});

describe("minor units", () => {
  it("respects currency decimals", () => {
    expect(toMinorUnits(12.34, "USD")).toBe(1234);
    expect(toMinorUnits(1.5, "UGX")).toBeNull();
    expect(toMinorUnits(1500, "UGX")).toBe(1500);
    expect(toMinorUnits(1.234, "GHS")).toBeNull();
    expect(toMinorUnits(0, "USD")).toBeNull();
    expect(toMinorUnits(1, "ABC")).toBeNull();
  });
});

describe("beneficiary validators", () => {
  it("checks IBAN checksum and country", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00", "DE")).toBe(true);
    expect(isValidIban("DE89370400440532013001", "DE")).toBe(false);
    expect(isValidIban("DE89370400440532013000", "FR")).toBe(false);
  });
  it("checks BIC format and country", () => {
    expect(isValidBic("DEUTDEFF", "DE")).toBe(true);
    expect(isValidBic("DEUTDEFF500", "DE")).toBe(true);
    expect(isValidBic("DEUTFRFF", "DE")).toBe(false);
  });
  it("checks US routing checksum", () => {
    expect(isValidAbaRouting("021000021")).toBe(true);
    expect(isValidAbaRouting("021000022")).toBe(false);
  });
  it("normalizes mobile numbers per country", () => {
    const dial = { prefix: "233", length: 9 };
    expect(normalizeMobileNumber("0241234567", dial)).toBe("233241234567");
    expect(normalizeMobileNumber("+233 24 123 4567", dial)).toBe("233241234567");
    expect(normalizeMobileNumber("+254712345678", dial)).toBeNull();
    expect(normalizeMobileNumber("02412345", dial)).toBeNull();
  });
  it("validates Ghana mobile money", () => {
    const r = findRoute("GH", "GHS", "mobile_money")!;
    expect(validateBeneficiary(r, { accountName: "Ama Mensah", network: "mtn", mobileNumber: "0241234567" }))
      .toEqual({ ok: true, normalized: { accountName: "Ama Mensah", network: "MTN", mobileNumber: "233241234567" } });
    expect(validateBeneficiary(r, { accountName: "Ama", network: "MPESA", mobileNumber: "0241234567" })).toEqual({ ok: false, errors: ["network"] });
  });
  it("validates US, UK, EU and ZA bank details", () => {
    expect(validateBeneficiary(findRoute("US", "USD", "bank")!, { accountName: "John Doe", routingNumber: "021000021", accountNumber: "123456789", address: "1 Main St, NY" }).ok).toBe(true);
    expect(validateBeneficiary(findRoute("US", "USD", "bank")!, { accountName: "John Doe", routingNumber: "021000022", accountNumber: "12", address: "" }))
      .toEqual({ ok: false, errors: ["routingNumber", "accountNumber", "address"] });
    expect(validateBeneficiary(findRoute("GB", "GBP", "bank")!, { accountName: "Jane Roe", sortCode: "20-00-00", accountNumber: "12345678" }).ok).toBe(true);
    expect(validateBeneficiary(findRoute("DE", "EUR", "bank")!, { accountName: "Hans Muller", iban: "DE89370400440532013000", swiftCode: "DEUTDEFF" }).ok).toBe(true);
    expect(validateBeneficiary(findRoute("ZA", "ZAR", "bank")!, { accountName: "Thabo N", branchCode: "250655", accountNumber: "62000000000" }).ok).toBe(true);
  });
  it("rejects missing or invalid names", () => {
    const r = findRoute("GB", "GBP", "bank")!;
    expect(validateBeneficiary(r, { accountName: "1", sortCode: "200000", accountNumber: "12345678" })).toEqual({ ok: false, errors: ["accountName"] });
  });
});

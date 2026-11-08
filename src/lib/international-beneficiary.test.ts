import { describe, expect, it } from "vitest";
import { buildInternationalTransferFields, GH_TRANSFER_SCHEMA, merchantRouteReady, type VerifiedMerchantRoute } from "./international-beneficiary";
import { findRoute } from "./international-payout-routes";
const record: VerifiedMerchantRoute = { route_id: "flw:GH:GHS:mobile_money", country: "GH", currency: "GHS", method: "mobile_money", environment: "production", schema_version: GH_TRANSFER_SCHEMA, provider_codes: ["MTN"], evidence_ref: "merchant-approval", verified_by: "admin", verified_at: "2026-11-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", revoked: false, fee_minor: 0, max_minor: 1000000 };
function gh() { const r = findRoute("GH", "GHS", "mobile_money"); if (!r) throw new Error("missing candidate"); return r; }
describe("merchant-specific Ghana adapter", () => {
  it("maps only verified provider codes to exact V3 fields", () => {
    expect(buildInternationalTransferFields(gh(), record, { accountName: "Ama Mensah", network: "MTN", mobileNumber: "0241234567" })).toEqual({ ok: true, fields: { account_bank: "MTN", account_number: "233241234567", beneficiary_name: "Ama Mensah", currency: "GHS", debit_currency: "GHS" } });
  });
  it("rejects codes absent from verified catalog", () => {
    expect(buildInternationalTransferFields(gh(), record, { accountName: "Ama Mensah", network: "VODAFONE", mobileNumber: "0241234567" })).toEqual({ ok: false, reason: "unverified_provider_code" });
  });
  it("rejects expired, revoked, sandbox, schema-missing or country-mismatched evidence", () => {
    for (const patch of [{ revoked: true }, { expires_at: "2026-01-01T00:00:00Z" }, { environment: "sandbox" as const }, { schema_version: "generic-iban" }, { country: "KE" }, { evidence_ref: " " }]) expect(merchantRouteReady({ ...record, ...patch }, gh())).toBe(false);
  });
  it("never promotes generic EU checks to an executable schema", () => {
    const eu = findRoute("DE", "EUR", "bank"); if (!eu) throw new Error("missing candidate");
    expect(merchantRouteReady({ ...record, route_id: eu.id, country: "DE", currency: "EUR", method: "bank" }, eu)).toBe(false);
  });
  it("rejects arbitrary provider metadata from the browser", () => {
    expect(buildInternationalTransferFields(gh(), record, { accountName: "Ama Mensah", network: "MTN", mobileNumber: "0241234567", debit_currency: "USD" }).ok).toBe(false);
  });
});
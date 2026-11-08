import { describe, expect, it } from "vitest";
import { internationalWithdrawalsEnabled, withdrawalsEnabled } from "./withdrawal-production";

const ready = {
  FLW_PAYOUT_ENVIRONMENT: "production",
  FLW_STATIC_EGRESS_VERIFIED: "true",
  FLW_IP_WHITELIST_VERIFIED: "true",
  FLW_PRODUCTION_VERIFIED: "true",
  FLW_PAYOUT_RELAY_URL: "https://relay.example.com/",
  FLW_PAYOUT_RELAY_TOKEN: "x".repeat(40),
  FLW_WEBHOOK_HASH: "webhook-secret-hash",
};

describe("independent international withdrawal gate", () => {
  it("keeps international withdrawals disabled by default", () => {
    expect(internationalWithdrawalsEnabled(ready)).toBe(false);
  });

  it("requires a separate international opt-in and all verified transport controls", () => {
    expect(internationalWithdrawalsEnabled({ ...ready, FLW_INTERNATIONAL_WITHDRAWALS_ENABLED: "true" })).toBe(true);
    expect(internationalWithdrawalsEnabled({
      ...ready, FLW_INTERNATIONAL_WITHDRAWALS_ENABLED: "true", FLW_IP_WHITELIST_VERIFIED: "false",
    })).toBe(false);
  });

  it("does not change the existing NGN kill switch when the international flag changes", () => {
    expect(withdrawalsEnabled({ ...ready, FLW_WITHDRAWALS_ENABLED: "true" })).toBe(true);
    expect(withdrawalsEnabled({ ...ready, FLW_INTERNATIONAL_WITHDRAWALS_ENABLED: "true" })).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  buildInternationalPayoutPreflight,
  internationalPayoutPreflightInput,
  runAuthenticatedInternationalPayoutPreflight,
  type InternationalPayoutPreflightDatabase,
} from "./international-payout-api";

const validGhanaMobile = {
  walletCurrency: "GHS",
  destinationCountry: "GH",
  currency: "GHS",
  method: "mobile_money" as const,
  beneficiary: { accountName: "Ama Mensah", network: "MTN", mobileNumber: "0241234567" },
};

function fakeDatabase(options?: {
  rateAllowed?: boolean | null;
  rateError?: unknown | null;
  settings?: { country?: string } | null;
  settingsError?: unknown | null;
  account?: { currency?: string } | null;
  accountError?: unknown | null;
}) {
  const filters: Array<{ table: string; column: string; value: string }> = [];
  const rpc = vi.fn().mockResolvedValue({
    data: options?.rateAllowed ?? true,
    error: options?.rateError ?? null,
  });
  const from = vi.fn((table: "user_settings" | "accounts") => {
    const query = {
      select: (_columns: string) => query,
      eq: (column: string, value: string) => {
        filters.push({ table, column, value });
        return query;
      },
      maybeSingle: async () => table === "user_settings"
        ? { data: options?.settings === undefined ? { country: "GH" } : options.settings, error: options?.settingsError ?? null }
        : { data: options?.account === undefined ? { currency: "GHS" } : options.account, error: options?.accountError ?? null },
    };
    return query;
  });
  return {
    db: { rpc, from } as unknown as InternationalPayoutPreflightDatabase,
    filters,
    rpc,
    from,
  };
}

describe("authenticated international payout preflight", () => {
  it("accepts only the declared input contract and rejects browser-supplied wallet identity", () => {
    expect(internationalPayoutPreflightInput.safeParse(validGhanaMobile).success).toBe(true);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, walletCountry: "GH" }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, unexpected: true }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, method: "card" }).success).toBe(false);
  });

  it("rejects unknown beneficiary fields and non-string values", () => {
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile, beneficiary: { ...validGhanaMobile.beneficiary, admin: "true" },
    }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile, beneficiary: { ...validGhanaMobile.beneficiary, accountName: { value: "Ama" } },
    }).success).toBe(false);
  });

  it("rejects oversized beneficiary values", () => {
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile, beneficiary: { ...validGhanaMobile.beneficiary, accountName: "A".repeat(201) },
    }).success).toBe(false);
  });

  it("validates a beneficiary but never enables an unverified route", () => {
    expect(buildInternationalPayoutPreflight(validGhanaMobile, "GH")).toEqual({
      ok: false, enabled: false, reason: "not_merchant_verified", beneficiaryValid: true, invalidFields: [],
    });
  });

  it("reports invalid beneficiary fields without exposing normalized account data", () => {
    expect(buildInternationalPayoutPreflight({
      ...validGhanaMobile, beneficiary: { accountName: "Ama", network: "MPESA", mobileNumber: "0241234567" },
    }, "GH")).toEqual({
      ok: false, enabled: false, reason: "invalid_beneficiary", beneficiaryValid: false, invalidFields: ["network"],
    });
  });

  it("rejects trusted wallet-country and wallet-currency mismatches", () => {
    expect(buildInternationalPayoutPreflight(validGhanaMobile, "KE").reason).toBe("wallet_country_mismatch");
    expect(buildInternationalPayoutPreflight({ ...validGhanaMobile, walletCurrency: "USD" }, "GH").reason)
      .toBe("wallet_currency_mismatch");
  });

  it("rejects unsupported country/currency/method combinations", () => {
    expect(buildInternationalPayoutPreflight({
      ...validGhanaMobile, destinationCountry: "CA", currency: "CAD",
    }, "GH").reason).toBe("unknown_route");
  });

  it("keeps Nigeria on the existing NGN withdrawal path", () => {
    expect(buildInternationalPayoutPreflight({
      walletCurrency: "NGN", destinationCountry: "NG", currency: "NGN", method: "bank", beneficiary: {},
    }, "NG").reason).toBe("nigeria_uses_ngn_path");
  });

  it("uses only the verified user id for both wallet-context queries", async () => {
    const { db, filters, rpc } = fakeDatabase();
    const result = await runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "user-123", db);
    expect(result.reason).toBe("not_merchant_verified");
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      _bucket: "international_payout_preflight", _limit: 20, _window_seconds: 600,
    });
    expect(filters).toEqual([
      { table: "user_settings", column: "user_id", value: "user-123" },
      { table: "accounts", column: "user_id", value: "user-123" },
      { table: "accounts", column: "currency", value: "GHS" },
    ]);
  });

  it("does not query wallet data when rate limiting denies or errors", async () => {
    for (const opts of [{ rateAllowed: false }, { rateAllowed: null, rateError: new Error("rpc down") }]) {
      const { db, from } = fakeDatabase(opts);
      const result = await runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "user-123", db);
      expect(result).toEqual({ ok: false, enabled: false, reason: "temporarily_unavailable" });
      expect(from).not.toHaveBeenCalled();
    }
  });

  it("fails closed when settings or account data is missing or errors", async () => {
    for (const opts of [
      { settings: null },
      { settingsError: new Error("settings unavailable") },
      { account: null },
      { accountError: new Error("account unavailable") },
    ]) {
      const { db } = fakeDatabase(opts);
      await expect(runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "user-123", db))
        .resolves.toEqual({ ok: false, enabled: false, reason: "wallet_context_unavailable" });
    }
  });

  it("fails closed without a verified user identity", async () => {
    const { db, rpc, from } = fakeDatabase();
    await expect(runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "", db))
      .resolves.toEqual({ ok: false, enabled: false, reason: "wallet_context_unavailable" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed when the rate-limit RPC throws", async () => {
    const db = {
      rpc: vi.fn().mockRejectedValue(new Error("network failure")),
      from: vi.fn(),
    } as unknown as InternationalPayoutPreflightDatabase;
    await expect(runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "user-123", db))
      .resolves.toEqual({ ok: false, enabled: false, reason: "temporarily_unavailable" });
  });

  it("fails closed when wallet queries throw", async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.reject(new Error("database unavailable")),
            eq: () => ({ maybeSingle: () => Promise.reject(new Error("database unavailable")) }),
          }),
        }),
      })),
    } as unknown as InternationalPayoutPreflightDatabase;
    await expect(runAuthenticatedInternationalPayoutPreflight(validGhanaMobile, "user-123", db))
      .resolves.toEqual({ ok: false, enabled: false, reason: "wallet_context_unavailable" });
  });
});

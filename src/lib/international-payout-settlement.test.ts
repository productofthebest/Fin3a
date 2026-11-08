import { describe, expect, it } from "vitest";
import {
  buildInternationalTransferPayload,
  internationalWithdrawalInput,
} from "./international-payout-settlement";

const idempotencyKey = "00000000-0000-4000-8000-000000000001";
const ref = "F3X-00000000-0000-4000-8000-000000000002";

describe("documented Flutterwave international bank payout payloads", () => {
  it("validates and maps the required USD beneficiary metadata", () => {
    const result = buildInternationalTransferPayload({
      walletCurrency: "USD",
      destinationCountry: "US",
      currency: "USD",
      method: "bank",
      amount: 125.5,
      idempotencyKey,
      beneficiary: {
        accountName: "Jane Doe",
        accountNumber: "123456789",
        routingNumber: "021000021",
        swiftCode: "IRVTUS3N",
        bankName: "Test Bank",
        accountType: "checking",
        address: "1 Main Street, San Francisco",
        postalCode: "94105",
        streetNumber: "1",
        streetName: "Main Street",
      },
    }, ref);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.currency).toBe("USD");
      expect(result.payload.debit_currency).toBe("USD");
      expect(result.payload.meta[0]).toMatchObject({
        routing_number: "021000021",
        swift_code: "IRVTUS3N",
        bank_name: "Test Bank",
        account_type: "checking",
        beneficiary_address: "1 Main Street, San Francisco",
        postal_code: "94105",
        street_number: "1",
        street_name: "Main Street",
      });
    }
  });

  it("validates GBP personal details and requires the names to match", () => {
    const valid = buildInternationalTransferPayload({
      walletCurrency: "GBP",
      destinationCountry: "GB",
      currency: "GBP",
      method: "bank",
      amount: 20,
      idempotencyKey,
      beneficiary: {
        accountName: "Jane Doe",
        accountNumber: "12345678",
        routingNumber: "200000",
        bankName: "Test Bank",
        accountType: "personal",
        firstName: "Jane",
        lastName: "Doe",
      },
    }, ref);
    expect(valid.ok).toBe(true);

    const mismatch = buildInternationalTransferPayload({
      walletCurrency: "GBP",
      destinationCountry: "GB",
      currency: "GBP",
      method: "bank",
      amount: 20,
      idempotencyKey,
      beneficiary: {
        accountName: "Jane Smith",
        accountNumber: "12345678",
        routingNumber: "200000",
        bankName: "Test Bank",
        accountType: "personal",
        firstName: "Jane",
        lastName: "Doe",
      },
    }, ref);
    expect(mismatch).toMatchObject({ ok: false, reason: "invalid_beneficiary" });
    if (!mismatch.ok) expect(mismatch.invalidFields).toContain("beneficiaryNameMismatch");
  });

  it("validates EUR IBAN, BIC, routing and address metadata", () => {
    const result = buildInternationalTransferPayload({
      walletCurrency: "EUR",
      destinationCountry: "DE",
      currency: "EUR",
      method: "bank",
      amount: 99.99,
      idempotencyKey,
      beneficiary: {
        accountName: "Hans Muller",
        iban: "DE89370400440532013000",
        routingNumber: "BECFDE7HKKX",
        swiftCode: "BECFDE7HKKX",
        bankName: "Test Bank",
        postalCode: "80331",
        streetNumber: "10",
        streetName: "Hauptstrasse",
        city: "Munich",
      },
    }, ref);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.account_number).toBe("DE89370400440532013000");
      expect(result.payload.meta[0]).toMatchObject({
        routing_number: "BECFDE7HKKX",
        swift_code: "BECFDE7HKKX",
        city: "Munich",
      });
    }
  });

  it("rejects unsupported corridors and currency precision", () => {
    const unsupported = buildInternationalTransferPayload({
      walletCurrency: "GHS",
      destinationCountry: "GH",
      currency: "GHS",
      method: "bank",
      amount: 10,
      idempotencyKey,
      beneficiary: { accountName: "Ama Mensah", accountNumber: "12345678", bankName: "Test Bank" },
    }, ref);
    expect(unsupported).toEqual({ ok: false, reason: "provider_schema_pending" });

    const invalidPrecision = buildInternationalTransferPayload({
      walletCurrency: "USD",
      destinationCountry: "US",
      currency: "USD",
      method: "bank",
      amount: 1.234,
      idempotencyKey,
      beneficiary: {},
    }, ref);
    expect(invalidPrecision).toEqual({ ok: false, reason: "invalid_amount" });
  });

  it("rejects unknown browser fields and malformed withdrawal inputs", () => {
    expect(internationalWithdrawalInput.safeParse({
      walletCurrency: "USD", destinationCountry: "US", currency: "USD", method: "bank",
      amount: 10, idempotencyKey, beneficiary: { accountName: "Jane Doe", cardNumber: "4111111111111111" },
    }).success).toBe(false);
    expect(internationalWithdrawalInput.safeParse({
      walletCurrency: "USD", destinationCountry: "US", currency: "USD", method: "bank",
      amount: 10, idempotencyKey, beneficiary: { accountName: "Jane Doe" }, unexpected: true,
    }).success).toBe(false);
  });
});

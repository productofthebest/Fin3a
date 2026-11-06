import { z } from "zod";
import { payoutFetch } from "./payout-transport.server";

const providerResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.union([z.number(), z.string()]),
    tx_ref: z.string(),
    amount: z.union([z.number(), z.string()]),
    currency: z.string(),
    status: z.string(),
  }),
});

export interface ExpectedFlutterwavePayment {
  transactionId: string;
  txRef: string;
  amount: number;
  currency: string;
}

export interface VerifiedFlutterwavePayment {
  providerTransactionId: string;
  txRef: string;
  amount: number;
  currency: string;
  status: "successful";
}

/**
 * Fetches transaction evidence from Flutterwave through the authenticated fixed-origin relay.
 * The caller must load ExpectedFlutterwavePayment from a server-owned pending deposit record.
 * This function verifies evidence only; it never credits a wallet.
 */
export async function verifyFlutterwaveTransaction(
  expected: ExpectedFlutterwavePayment,
): Promise<VerifiedFlutterwavePayment> {
  if (
    !/^[1-9]\d{0,19}$/.test(expected.transactionId) ||
    !/^F3I-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(expected.txRef) ||
    !Number.isFinite(expected.amount) ||
    expected.amount <= 0 ||
    !/^[A-Z]{3}$/.test(expected.currency)
  ) throw new Error("PAYMENT_VERIFICATION_FAILED");

  const response = await payoutFetch(
    `/transactions/${expected.transactionId}/verify`,
    { method: "GET" },
  );
  if (!response.ok) throw new Error("PAYMENT_VERIFICATION_FAILED");

  const body: unknown = await response.json().catch(() => null);
  const parsed = providerResponse.safeParse(body);
  if (!parsed.success) throw new Error("PAYMENT_VERIFICATION_FAILED");

  const data = parsed.data.data;
  const amount = Number(data.amount);
  const providerTransactionId = String(data.id);
  const currency = data.currency.toUpperCase();

  if (
    providerTransactionId !== expected.transactionId ||
    data.tx_ref !== expected.txRef ||
    !Number.isFinite(amount) ||
    amount !== expected.amount ||
    currency !== expected.currency ||
    data.status.toLowerCase() !== "successful"
  ) throw new Error("PAYMENT_VERIFICATION_FAILED");

  return {
    providerTransactionId,
    txRef: data.tx_ref,
    amount,
    currency,
    status: "successful",
  };
}

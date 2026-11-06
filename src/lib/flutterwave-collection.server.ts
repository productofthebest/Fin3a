// Server-only hosted collection adapter. Never accepts or forwards card credentials.
import { z } from "zod";
import { collectionFetch } from "./payout-transport.server";

const hostedPaymentInput = z.object({
  txRef: z.string().regex(/^F3I-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
  amount: z.number().finite().positive().max(1_000_000_000)
    .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  customer: z.object({
    email: z.string().email().max(254),
    name: z.string().trim().min(2).max(120),
    phoneNumber: z.string().trim().min(7).max(30).optional(),
  }).strict(),
}).strict();

const responseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ link: z.string().url() }),
});

/**
 * Creates a Flutterwave-hosted checkout session through the fixed-egress relay.
 * Country/currency/method eligibility is enforced again by the relay. This
 * function does not credit a wallet; a separate provider verification and
 * idempotent ledger settlement must happen before funds become available.
 */
export async function createHostedCollection(input: unknown): Promise<{ checkoutUrl: string }> {
  const data = hostedPaymentInput.parse(input);
  const response = await collectionFetch({
    method: "POST",
    body: JSON.stringify({
      tx_ref: data.txRef,
      amount: data.amount,
      country: data.country,
      currency: data.currency,
      customer: {
        email: data.customer.email,
        name: data.customer.name,
        ...(data.customer.phoneNumber ? { phonenumber: data.customer.phoneNumber } : {}),
      },
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  const parsed = responseSchema.safeParse(body);
  if (!response.ok || !parsed.success) {
    // Do not surface raw provider responses, which may contain personal data.
    throw new Error("HOSTED_CHECKOUT_UNAVAILABLE");
  }
  const url = new URL(parsed.data.data.link);
  if (url.protocol !== "https:" || url.hostname !== "checkout.flutterwave.com") {
    throw new Error("INVALID_CHECKOUT_URL");
  }
  return { checkoutUrl: url.toString() };
}

/**
 * Pure FX quote arithmetic for any ISO-4217 currency pair.
 *
 * This module is deliberately not a payment rail: callers must supply a fresh,
 * server-owned executable rate and must never accept rate/fee/output from a client.
 * Settlement stays disabled until a quote provider and atomic DB executor exist.
 */
export interface FxPairQuoteInput {
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: number;
  /** Destination-currency units per one source-currency unit. */
  rate: number;
  /** Fee deducted from source amount, in basis points. */
  feeBps: number;
  sourcePrecision?: number;
  destinationPrecision?: number;
}

export interface FxPairQuotePreview {
  fromCurrency: string;
  toCurrency: string;
  sourceAmount: number;
  feeAmount: number;
  netSourceAmount: number;
  rate: number;
  destinationAmount: number;
}

const roundTo = (value: number, precision: number) => {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

export function calculateFxPairQuote(input: FxPairQuoteInput): FxPairQuotePreview | null {
  const fromCurrency = input.fromCurrency.trim().toUpperCase();
  const toCurrency = input.toCurrency.trim().toUpperCase();
  const sourcePrecision = input.sourcePrecision ?? 2;
  const destinationPrecision = input.destinationPrecision ?? 2;

  if (!/^[A-Z]{3}$/.test(fromCurrency) || !/^[A-Z]{3}$/.test(toCurrency) || fromCurrency === toCurrency) return null;
  if (!Number.isFinite(input.sourceAmount) || input.sourceAmount <= 0) return null;
  if (!Number.isFinite(input.rate) || input.rate <= 0) return null;
  if (!Number.isInteger(input.feeBps) || input.feeBps < 0 || input.feeBps >= 10_000) return null;
  if (![sourcePrecision, destinationPrecision].every(p => Number.isInteger(p) && p >= 0 && p <= 6)) return null;

  const sourceAmount = roundTo(input.sourceAmount, sourcePrecision);
  if (sourceAmount <= 0) return null;
  const feeAmount = roundTo(sourceAmount * input.feeBps / 10_000, sourcePrecision);
  const netSourceAmount = roundTo(sourceAmount - feeAmount, sourcePrecision);
  const destinationAmount = roundTo(netSourceAmount * input.rate, destinationPrecision);
  if (netSourceAmount <= 0 || destinationAmount <= 0 || !Number.isFinite(destinationAmount)) return null;

  return { fromCurrency, toCurrency, sourceAmount, feeAmount, netSourceAmount, rate: input.rate, destinationAmount };
}

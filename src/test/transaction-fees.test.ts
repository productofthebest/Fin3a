import { describe, expect, it } from "vitest";
import { calculateFee, minorUnits, type FeeSetting } from "../lib/transaction-fees";
import { summarizeRevenue } from "../lib/revenue-report";
const settings: FeeSetting[] = ["crypto_sell","crypto_withdrawal","crypto_swap","ngn_withdrawal"].map(service => ({ service: service as FeeSetting["service"], id:null,rate_bps:service === "crypto_swap" ? 10 : service === "ngn_withdrawal" ? 0 : 100, high_rate_bps:service === "crypto_swap" ? 10 : service === "ngn_withdrawal" ? 0 : 50, threshold_usd:5000,flat_ngn:service === "ngn_withdrawal" ? 50 : 0,created_at:null }));
describe("Launch fee rules", () => {
  for (const service of ["crypto_sell","crypto_withdrawal"]) for (const asset of ["USDT","USDC"]) for (const [value, fee] of ([["999.99","10.00"],["1000","10.00"],["4999.99","50.00"],["5000","25.00"],["10000","50.00"]] as const)) it(`${service} ${asset} USD ${value}`, () => expect(calculateFee({service,asset,currency:"USD",payout:value,usdValue:value},settings).fin3aFee).toBe(fee));
  for (const asset of ["USDT","USDC","BTC"]) for (const currency of ["NGN","USD"] as const) it(`free ${asset} deposit to ${currency}`, () => expect(calculateFee({service:"crypto_deposit",asset,currency,payout:"1000"},settings).fin3aFee).toBe("0.00"));
  for (const service of ["internal_transfer","share_payment","bill_split","qr_payment","bill_payment","currency_swap"]) it(`free ${service}`, () => expect(calculateFee({service,currency:"NGN",payout:"5000"},settings).finalAmount).toBe("5000.00"));
  it("deducts flat NGN 50 from payout", () => expect(calculateFee({service:"ngn_withdrawal",currency:"NGN",payout:"5000"},settings)).toMatchObject({fin3aFee:"50.00",finalAmount:"4950.00"}));
  it("keeps provider charges separate", () => expect(calculateFee({service:"ngn_withdrawal",currency:"NGN",payout:"5000",providerCharge:"20",networkCharge:"5"},settings).finalAmount).toBe("4925.00"));
  it("rejects no positive payout", () => expect(() => calculateFee({service:"ngn_withdrawal",currency:"NGN",payout:"50"},settings)).toThrow());
  it("rejects BTC withdrawal", () => expect(() => calculateFee({service:"crypto_withdrawal",asset:"BTC",currency:"USD",payout:"100",usdValue:"100"},settings)).toThrow());
  it("crypto swaps charge 0.1%", () => expect(calculateFee({service:"crypto_swap",asset:"USDT",currency:"USD",payout:"5000",usdValue:"5000"},settings).fin3aFee).toBe("5.00"));
  it("keeps the 0.1% swap fee below the withdrawal threshold", () => expect(calculateFee({service:"crypto_swap",asset:"USDC",currency:"USD",payout:"1000",usdValue:"1000"},settings)).toMatchObject({feeRateBps:10,fin3aFee:"1.00",finalAmount:"999.00"}));
  it("does not charge included commission twice", () => expect(calculateFee({service:"crypto_sell",asset:"USDT",currency:"USD",payout:"5000",usdValue:"5000",commissionIncluded:true},settings).fin3aFee).toBe("0.00"));
  it("rejects imprecise quotes", () => expect(() => minorUnits("1.001")).toThrow());
  it("requires verified tier valuation", () => expect(() => calculateFee({service:"crypto_sell",asset:"USDT",currency:"USD",payout:"100"},settings)).toThrow());
});
it("separates currency, estimates, settlement and refund from earned revenue", () => {
  const quotes = [{id:"a",service:"crypto_sell",currency:"USD",provider:"test",quoted_payout:"5000",asset:"USDT",network:null},{id:"b",service:"ngn_withdrawal",currency:"NGN",provider:"test",quoted_payout:"5000",asset:null,network:null}];
  const event = {id:"e",snapshot_id:"a",event_kind:"earned",fin3a_fee:"25",provider_commission:"0",provider_charge:"2",network_charge:"0",occurred_at:"2026-11-04",related_event_id:null};
  const totals = summarizeRevenue([event,{...event,id:"s",event_kind:"settled"},{...event,id:"r",event_kind:"refund",fin3a_fee:"5",provider_charge:"0",related_event_id:"e"},{...event,id:"estimate",event_kind:"commission_estimate",fin3a_fee:"0",provider_commission:"10"},{...event,id:"ngn",snapshot_id:"b",fin3a_fee:"50",provider_charge:"0"}], quotes);
  expect(totals.find(t => t.currency === "USD")).toMatchObject({gross:"25.00",net:"18.00",estimated:"10.00",volume:"5000.00",settled:"25.00"});
  expect(totals.find(t => t.currency === "NGN")).toMatchObject({gross:"50.00",net:"50.00"});
});
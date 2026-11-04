import { describe, expect, it } from "vitest";
import { parseCryptoQr, withdrawalAssetAllowed } from "@/lib/crypto-qr";
import { parseScannedQr } from "@/lib/qr-payments";
import { accountHelpIntent } from "@/lib/account-help";
import { homepageSearchQuestion } from "@/lib/homepage-web";

const btc = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
const evm = "0x52908400098527886E0F7030069857D2E4169EE7";

describe("cryptocurrency QR review", () => {
  it("detects Bitcoin deposit address QR and BIP21 without taking QR amount as authority", () => {
    expect(parseScannedQr(`bitcoin:${btc}?amount=0.1`)).toEqual({ kind: "crypto", address: btc, family: "Bitcoin", asset: "BTC", chainId: null, tokenContract: null });
  });
  it("rejects altered Bitcoin checksum", () => {
    expect(parseCryptoQr(btc.slice(0, -1) + "U")).toBeNull();
  });
  it("recognizes EVM addresses but never assumes USDC, USDT or a network", () => {
    expect(parseCryptoQr(evm)).toMatchObject({ family: "EVM", asset: null, chainId: null });
  });
  it("extracts ERC20 destination rather than treating token contract as recipient", () => {
    const contract = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    expect(parseCryptoQr(`ethereum:${contract}@1/transfer?address=${evm}&uint256=1000000`)).toMatchObject({ address: evm, tokenContract: contract, chainId: "1", asset: null });
  });
  it("supports checksum-valid other deposit crypto address formats without enabling payment", () => {
    expect(parseCryptoQr("D7Y55b7hJbc9WD7tHTJcG9YKoYeCvGvFgG")).toBeNull();
    expect(parseCryptoQr("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb")).toMatchObject({ family: "TRON", asset: null });
  });
  it("permits only USDC and USDT withdrawal assets", () => {
    expect(withdrawalAssetAllowed("USDC")).toBe(true);
    expect(withdrawalAssetAllowed("USDT")).toBe(true);
    expect(withdrawalAssetAllowed("BTC")).toBe(false);
    expect(withdrawalAssetAllowed("ETH")).toBe(false);
  });
  it("rejects dangerous schemes, excessive payloads, required unknown parameters and testnets", () => {
    expect(parseCryptoQr("javascript:alert(1)")).toBeNull();
    expect(parseCryptoQr("a".repeat(2049))).toBeNull();
    expect(parseCryptoQr(`bitcoin:${btc}?req-rpc=https://evil.example`)).toBeNull();
    expect(parseCryptoQr("tb1qexample")).toBeNull();
  });
});

describe("private account prompt navigation", () => {
  it("routes bank withdrawal and stablecoin withdrawal to account help", () => {
    expect(accountHelpIntent("Withdraw USDC to my crypto address")).toBe("withdraw");
    expect(accountHelpIntent("Help with my bank withdrawal")).toBe("withdraw");
    expect(accountHelpIntent("Where are my account details?")).toBe("details");
    expect(accountHelpIntent("Deposit bitcoin into USD")).toBe("deposit");
  });
  it("keeps crypto/bank service prompts out of public research", () => {
    expect(homepageSearchQuestion("How do I withdraw USDT?").query).toBeNull();
    expect(homepageSearchQuestion("Show my crypto deposit address").query).toBeNull();
  });
  it("rejects a pasted wallet address before research", () => {
    expect(homepageSearchQuestion(`Find ${btc}`).error).toBeTruthy();
    expect(homepageSearchQuestion(`Find ${evm}`).error).toBeTruthy();
  });
});
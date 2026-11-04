import { base58check, bech32, bech32m } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

export interface CryptoQr {
  kind: "crypto";
  address: string;
  family: "Bitcoin" | "EVM" | "TRON" | "Litecoin" | "Dogecoin";
  asset: string | null;
  chainId: string | null;
  tokenContract: string | null;
}

function familyOf(address: string): CryptoQr["family"] | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
    const body = address.slice(2);
    if (body === body.toLowerCase() || body === body.toUpperCase()) return "EVM";
    const hash = Array.from(keccak_256(new TextEncoder().encode(body.toLowerCase())), b => b.toString(16).padStart(2, "0")).join("");
    if ([...body].every((char, i) => !/[a-f]/i.test(char) || (parseInt(hash[i] ?? "0", 16) >= 8 ? char === char.toUpperCase() : char === char.toLowerCase()))) return "EVM";
    return null;
  }
  if (/^(bc1|ltc1)/i.test(address)) {
    for (const [codec, modern] of [[bech32, false], [bech32m, true]] as const) {
      try {
        const { prefix, words } = codec.decode(address as `${string}1${string}`, 90);
        const version = words[0];
        if (version === undefined || version > 16 || modern !== (version > 0)) continue;
        const bytes = codec.fromWords(words.slice(1));
        if (bytes.length < 2 || bytes.length > 40 || (version === 0 && bytes.length !== 20 && bytes.length !== 32)) continue;
        if (prefix === "bc") return "Bitcoin";
        if (prefix === "ltc") return "Litecoin";
      } catch { /* invalid checksum or witness program */ }
    }
    return null;
  }
  try {
    const decoded = base58check(sha256).decode(address);
    if (decoded.length !== 21) return null;
    switch (decoded[0]) {
      case 0: case 5: return "Bitcoin";
      case 65: return "TRON";
      case 48: case 50: return "Litecoin";
      case 30: case 22: return "Dogecoin";
    }
  } catch { /* invalid address/checksum */ }
  return null;
}

/** Recognition only: never establishes ownership, token identity, network support or a payable destination. */
export function parseCryptoQr(raw: string): CryptoQr | null {
  const text = raw.trim();
  if (!text || text.length > 2048 || /[\s\x00-\x1f]/.test(text)) return null;
  const match = text.match(/^(bitcoin|ethereum|tron|litecoin|dogecoin):(?:\/\/)?([^?]+)(?:\?(.*))?$/i);
  let address = text;
  let chainId: string | null = null;
  let tokenContract: string | null = null;
  let expected: CryptoQr["family"] | null = null;
  if (match) {
    const families: Record<string, CryptoQr["family"]> = { bitcoin: "Bitcoin", ethereum: "EVM", tron: "TRON", litecoin: "Litecoin", dogecoin: "Dogecoin" };
    expected = families[match[1]?.toLowerCase() ?? ""] ?? null;
    const target = (match[2] ?? "").replace(/^pay-/, "");
    const params = new URLSearchParams(match[3] ?? "");
    if ([...params.keys()].some(k => k.startsWith("req-"))) return null;
    if (expected === "EVM") {
      const evm = target.match(/^(0x[0-9a-fA-F]{40})(?:@(\d{1,10}))?(\/transfer)?$/);
      if (!evm) return null;
      chainId = evm[2] ?? null;
      if (evm[3]) {
        tokenContract = evm[1] ?? null;
        if (!tokenContract || familyOf(tokenContract) !== "EVM") return null;
        address = params.get("address") ?? "";
        if (params.getAll("address").length !== 1) return null;
      } else address = evm[1] ?? "";
    } else address = target;
  }
  const family = familyOf(address);
  if (!family || (expected && family !== expected)) return null;
  const asset = family === "Bitcoin" ? "BTC" : family === "Litecoin" ? "LTC" : family === "Dogecoin" ? "DOGE" : null;
  return { kind: "crypto", address, family, asset, chainId, tokenContract };
}

export function withdrawalAssetAllowed(asset: string): boolean {
  return asset === "USDC" || asset === "USDT";
}
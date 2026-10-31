import { describe, expect, it } from "vitest";
import { checkOtp, generateOtp, hashOtp, sendBlockReason } from "@/lib/phone-otp";

const now = Date.parse("2026-10-31T10:00:00Z");
const future = new Date(now + 60_000).toISOString();

describe("phone OTP rules", () => {
  it("generates six digits", () => { for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/); });
  it("hash never contains the code and depends on phone", async () => {
    const h = await hashOtp("s", "+2348012345678", "123456");
    expect(h).not.toContain("123456");
    expect(h).not.toBe(await hashOtp("s", "+2348099999999", "123456"));
  });
  it("expires after the expiry time", async () => {
    const h = await hashOtp("s", "p", "111111");
    expect(checkOtp({ code_hash: h, attempts: 0, expires_at: new Date(now).toISOString(), consumed_at: null }, h, now)).toBe("expired");
  });
  it("locks after five attempts", async () => {
    const h = await hashOtp("s", "p", "111111");
    expect(checkOtp({ code_hash: h, attempts: 5, expires_at: future, consumed_at: null }, h, now)).toBe("locked");
    expect(checkOtp({ code_hash: h, attempts: 4, expires_at: future, consumed_at: null }, h, now)).toBe("ok");
  });
  it("rejects a consumed code", async () => {
    const h = await hashOtp("s", "p", "111111");
    expect(checkOtp({ code_hash: h, attempts: 0, expires_at: future, consumed_at: future }, h, now)).toBe("missing");
  });
  it("enforces 60s resend cooldown and 5 per hour per phone", () => {
    expect(sendBlockReason({ lastSentAt: now - 30_000, phoneSendsLastHour: 1, ipSendsLastHour: 1 }, now)).toMatch(/wait 30s/);
    expect(sendBlockReason({ lastSentAt: now - 61_000, phoneSendsLastHour: 5, ipSendsLastHour: 1 }, now)).toMatch(/Too many/);
    expect(sendBlockReason({ lastSentAt: now - 61_000, phoneSendsLastHour: 4, ipSendsLastHour: 1 }, now)).toBeNull();
  });
});

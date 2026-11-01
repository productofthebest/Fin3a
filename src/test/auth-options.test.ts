import { describe, expect, it } from "vitest";
import { AUTH_DESTINATION, OTP_LENGTH, RESEND_COOLDOWN, authSearch, authenticationIntent, normalizedPhone, validOtp } from "@/lib/auth-options";

describe("Dual authentication rules", () => {
  it("normalizes Nigerian numbers with the selected country code", () => { expect(normalizedPhone("08031234567", "NG")).toBe("+2348031234567"); });
  it("supports international phone numbers", () => { expect(normalizedPhone("2025550123", "US")).toBe("+12025550123"); });
  it("rejects invalid phone numbers", () => { expect(() => normalizedPhone("123", "NG")).toThrow(); });
  it("accepts exactly six SMS digits", () => { expect(OTP_LENGTH).toBe(6); expect(validOtp("123456")).toBe(true); for (const code of ["12345", "1234567", "12a456"]) expect(validOtp(code)).toBe(false); });
  it("waits sixty seconds before a resend", () => { expect(RESEND_COOLDOWN).toBe(60); });
  it("uses the existing dashboard destination", () => { expect(AUTH_DESTINATION).toBe("/dashboard"); });
  it("only accepts known registration methods", () => { expect(authSearch({ mode: "signup", method: "phone" })).toEqual({ mode: "signup", method: "phone" }); expect(authSearch({ mode: "unknown", method: "https://example.org" })).toEqual({ mode: "signin", method: "email" }); });
  it("takes login requests out of AI chat", () => { expect(authenticationIntent("I want to log in.")).toBe("choose"); expect(authenticationIntent("I want to use my phone number.")).toBe("phone"); expect(authenticationIntent("I prefer my email.")).toBe("email"); expect(authenticationIntent("How do I save money?")).toBeNull(); });
  it("takes signup and signin prompts out of AI chat", () => { expect(authenticationIntent("Sign me up")).toBe("signup"); expect(authenticationIntent("sign me up!")).toBe("signup"); expect(authenticationIntent("I want to create a free account")).toBe("signup"); expect(authenticationIntent("Sign me in")).toBe("choose"); expect(authenticationIntent("sign me in.")).toBe("choose"); });
});
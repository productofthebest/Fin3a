import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const AUTH_DESTINATION = "/dashboard" as const;
export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN = 60;
export type AuthMethod = "phone" | "email";
export type AuthMode = "signin" | "signup";

export function authSearch(search: Record<string, unknown>): { method?: AuthMethod; mode?: AuthMode } {
  return { method: search["method"] === "phone" ? "phone" : "email", mode: search["mode"] === "signup" ? "signup" : "signin" };
}

export function normalizedPhone(value: string, country: CountryCode) {
  const phone = parsePhoneNumberFromString(value, country);
  if (!phone?.isValid()) throw new Error("Enter a valid phone number for the selected country.");
  return phone.number;
}

export function validOtp(value: string) { return /^\d{6}$/.test(value); }

export const PHONE_COUNTRIES = getCountries().map((code) => ({ code, dial: getCountryCallingCode(code) }));

export function authenticationIntent(text: string): AuthMethod | "choose" | "signup" | null {
  const value = text.trim().toLowerCase();
  if (/^(i (?:want|prefer|would like)(?: to)? (?:use )?(?:my |a )?phone(?: number)?[.!]?|continue with phone(?: number)?[.!]?)$/.test(value)) return "phone";
  if (/^(i (?:want|prefer|would like)(?: to)? (?:use )?(?:my |an? )?email(?: and password)?[.!]?|continue with email(?: and password)?[.!]?)$/.test(value)) return "email";
  if (/^(?:(?:i (?:want|would like|need) to )?(?:sign up|register|create (?:a |an |my )?(?:free )?account|get started)|sign me up)[.!]?$/.test(value)) return "signup";
  if (/^(?:(?:i (?:want|would like|need) to )?(?:log in|login|sign in)|help me (?:log in|sign in)|sign me in)[.!]?$/.test(value)) return "choose";
  return null;
}
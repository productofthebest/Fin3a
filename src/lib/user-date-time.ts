/**
 * Country-aware date and time formatting for Fin3a.
 * Uses the account's selected country timezone when mapped, then the device timezone
 * as a safe fallback for countries with multiple or unmapped zones.
 */
const COUNTRY_TIME_ZONES: Record<string, string> = {
  NG: "Africa/Lagos", GH: "Africa/Accra", KE: "Africa/Nairobi", ZA: "Africa/Johannesburg",
  EG: "Africa/Cairo", MA: "Africa/Casablanca", TZ: "Africa/Dar_es_Salaam", UG: "Africa/Kampala",
  RW: "Africa/Kigali", ET: "Africa/Addis_Ababa", ZW: "Africa/Harare", SN: "Africa/Dakar",
  GB: "Europe/London", IE: "Europe/Dublin", FR: "Europe/Paris", DE: "Europe/Berlin",
  ES: "Europe/Madrid", IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels",
  PT: "Europe/Lisbon", CH: "Europe/Zurich", AT: "Europe/Vienna", SE: "Europe/Stockholm",
  NO: "Europe/Oslo", DK: "Europe/Copenhagen", FI: "Europe/Helsinki", PL: "Europe/Warsaw",
  GR: "Europe/Athens", TR: "Europe/Istanbul", UA: "Europe/Kyiv", RO: "Europe/Bucharest",
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City",
  BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago",
  CO: "America/Bogota", PE: "America/Lima", VE: "America/Caracas", JM: "America/Jamaica",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland", FJ: "Pacific/Fiji",
  IN: "Asia/Kolkata", PK: "Asia/Karachi", BD: "Asia/Dhaka", LK: "Asia/Colombo",
  NP: "Asia/Kathmandu", SG: "Asia/Singapore", MY: "Asia/Kuala_Lumpur", ID: "Asia/Jakarta",
  PH: "Asia/Manila", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh", CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong", TW: "Asia/Taipei", JP: "Asia/Tokyo", KR: "Asia/Seoul",
  AE: "Asia/Dubai", SA: "Asia/Riyadh", QA: "Asia/Qatar", KW: "Asia/Kuwait",
  BH: "Asia/Bahrain", OM: "Asia/Muscat", IL: "Asia/Jerusalem", JO: "Asia/Amman",
  LB: "Asia/Beirut", RU: "Europe/Moscow",
};

function countryLocale(country?: string | null) {
  const code = country?.toUpperCase();
  if (!code) return undefined;
  if (code === "US") return "en-US";
  if (["GB", "NG", "GH", "KE", "ZA", "AU", "NZ", "IE", "IN"].includes(code)) return "en-GB";
  if (code === "CA") return "en-CA";
  return undefined;
}

export function userTimeZone(country?: string | null) {
  const code = country?.toUpperCase();
  return (code && COUNTRY_TIME_ZONES[code]) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatUserDateTime(value: string, country?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = countryLocale(country);
  const timeZone = userTimeZone(country);
  const dateText = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
  if (!value.includes("T")) return dateText;
  const timeText = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(date);
  return `${dateText} · ${timeText}`;
}

/** Client-safe shared types, constants and formatting helpers for Fin3a. */

export type TxType = "income" | "expense";
export type TxStatus = "pending" | "cleared" | "completed";
export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: TxType;
  icon: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  category_id: string | null;
  description: string | null;
  merchant: string | null;
  occurred_at: string;
  status: TxStatus;
  source: string;
  currency?: string | null;
  recurring_bill_id: string | null;
  notes: string | null;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "icon"> | null;
}

export interface RecurringBill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  next_due_date: string;
  category_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "icon"> | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  currency: string;
  onboarding_completed: boolean;
  display_name: string | null;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

/** Every ISO 4217 currency in active circulation — Fin3a works in any of them. */
const RAW_CURRENCIES: [code: string, name: string][] = [
  ["AED", "UAE Dirham"],
  ["AFN", "Afghan Afghani"],
  ["ALL", "Albanian Lek"],
  ["AMD", "Armenian Dram"],
  ["ANG", "Netherlands Antillean Guilder"],
  ["AOA", "Angolan Kwanza"],
  ["ARS", "Argentine Peso"],
  ["AUD", "Australian Dollar"],
  ["AWG", "Aruban Florin"],
  ["AZN", "Azerbaijani Manat"],
  ["BAM", "Bosnia-Herzegovina Convertible Mark"],
  ["BBD", "Barbadian Dollar"],
  ["BDT", "Bangladeshi Taka"],
  ["BGN", "Bulgarian Lev"],
  ["BHD", "Bahraini Dinar"],
  ["BIF", "Burundian Franc"],
  ["BMD", "Bermudian Dollar"],
  ["BND", "Brunei Dollar"],
  ["BOB", "Bolivian Boliviano"],
  ["BRL", "Brazilian Real"],
  ["BSD", "Bahamian Dollar"],
  ["BTN", "Bhutanese Ngultrum"],
  ["BWP", "Botswana Pula"],
  ["BYN", "Belarusian Ruble"],
  ["BZD", "Belize Dollar"],
  ["CAD", "Canadian Dollar"],
  ["CDF", "Congolese Franc"],
  ["CHF", "Swiss Franc"],
  ["CLP", "Chilean Peso"],
  ["CNY", "Chinese Yuan"],
  ["COP", "Colombian Peso"],
  ["CRC", "Costa Rican Colón"],
  ["CUP", "Cuban Peso"],
  ["CVE", "Cape Verdean Escudo"],
  ["CZK", "Czech Koruna"],
  ["DJF", "Djiboutian Franc"],
  ["DKK", "Danish Krone"],
  ["DOP", "Dominican Peso"],
  ["DZD", "Algerian Dinar"],
  ["EGP", "Egyptian Pound"],
  ["ERN", "Eritrean Nakfa"],
  ["ETB", "Ethiopian Birr"],
  ["EUR", "Euro"],
  ["FJD", "Fijian Dollar"],
  ["FKP", "Falkland Islands Pound"],
  ["GBP", "British Pound"],
  ["GEL", "Georgian Lari"],
  ["GHS", "Ghanaian Cedi"],
  ["GIP", "Gibraltar Pound"],
  ["GMD", "Gambian Dalasi"],
  ["GNF", "Guinean Franc"],
  ["GTQ", "Guatemalan Quetzal"],
  ["GYD", "Guyanese Dollar"],
  ["HKD", "Hong Kong Dollar"],
  ["HNL", "Honduran Lempira"],
  ["HTG", "Haitian Gourde"],
  ["HUF", "Hungarian Forint"],
  ["IDR", "Indonesian Rupiah"],
  ["ILS", "Israeli New Shekel"],
  ["INR", "Indian Rupee"],
  ["IQD", "Iraqi Dinar"],
  ["IRR", "Iranian Rial"],
  ["ISK", "Icelandic Króna"],
  ["JMD", "Jamaican Dollar"],
  ["JOD", "Jordanian Dinar"],
  ["JPY", "Japanese Yen"],
  ["KES", "Kenyan Shilling"],
  ["KGS", "Kyrgyzstani Som"],
  ["KHR", "Cambodian Riel"],
  ["KMF", "Comorian Franc"],
  ["KPW", "North Korean Won"],
  ["KRW", "South Korean Won"],
  ["KWD", "Kuwaiti Dinar"],
  ["KYD", "Cayman Islands Dollar"],
  ["KZT", "Kazakhstani Tenge"],
  ["LAK", "Lao Kip"],
  ["LBP", "Lebanese Pound"],
  ["LKR", "Sri Lankan Rupee"],
  ["LRD", "Liberian Dollar"],
  ["LSL", "Lesotho Loti"],
  ["LYD", "Libyan Dinar"],
  ["MAD", "Moroccan Dirham"],
  ["MDL", "Moldovan Leu"],
  ["MGA", "Malagasy Ariary"],
  ["MKD", "Macedonian Denar"],
  ["MMK", "Myanmar Kyat"],
  ["MNT", "Mongolian Tögrög"],
  ["MOP", "Macanese Pataca"],
  ["MRU", "Mauritanian Ouguiya"],
  ["MUR", "Mauritian Rupee"],
  ["MVR", "Maldivian Rufiyaa"],
  ["MWK", "Malawian Kwacha"],
  ["MXN", "Mexican Peso"],
  ["MYR", "Malaysian Ringgit"],
  ["MZN", "Mozambican Metical"],
  ["NAD", "Namibian Dollar"],
  ["NGN", "Nigerian Naira"],
  ["NIO", "Nicaraguan Córdoba"],
  ["NOK", "Norwegian Krone"],
  ["NPR", "Nepalese Rupee"],
  ["NZD", "New Zealand Dollar"],
  ["OMR", "Omani Rial"],
  ["PAB", "Panamanian Balboa"],
  ["PEN", "Peruvian Sol"],
  ["PGK", "Papua New Guinean Kina"],
  ["PHP", "Philippine Peso"],
  ["PKR", "Pakistani Rupee"],
  ["PLN", "Polish Złoty"],
  ["PYG", "Paraguayan Guaraní"],
  ["QAR", "Qatari Riyal"],
  ["RON", "Romanian Leu"],
  ["RSD", "Serbian Dinar"],
  ["RUB", "Russian Ruble"],
  ["RWF", "Rwandan Franc"],
  ["SAR", "Saudi Riyal"],
  ["SBD", "Solomon Islands Dollar"],
  ["SCR", "Seychellois Rupee"],
  ["SDG", "Sudanese Pound"],
  ["SEK", "Swedish Krona"],
  ["SGD", "Singapore Dollar"],
  ["SHP", "Saint Helena Pound"],
  ["SLE", "Sierra Leonean Leone"],
  ["SOS", "Somali Shilling"],
  ["SRD", "Surinamese Dollar"],
  ["SSP", "South Sudanese Pound"],
  ["STN", "São Tomé & Príncipe Dobra"],
  ["SVC", "Salvadoran Colón"],
  ["SYP", "Syrian Pound"],
  ["SZL", "Eswatini Lilangeni"],
  ["THB", "Thai Baht"],
  ["TJS", "Tajikistani Somoni"],
  ["TMT", "Turkmenistani Manat"],
  ["TND", "Tunisian Dinar"],
  ["TOP", "Tongan Paʻanga"],
  ["TRY", "Turkish Lira"],
  ["TTD", "Trinidad & Tobago Dollar"],
  ["TWD", "New Taiwan Dollar"],
  ["TZS", "Tanzanian Shilling"],
  ["UAH", "Ukrainian Hryvnia"],
  ["UGX", "Ugandan Shilling"],
  ["USD", "US Dollar"],
  ["UYU", "Uruguayan Peso"],
  ["UZS", "Uzbekistani Som"],
  ["VES", "Venezuelan Bolívar"],
  ["VND", "Vietnamese Dong"],
  ["VUV", "Vanuatu Vatu"],
  ["WST", "Samoan Tālā"],
  ["XAF", "Central African CFA Franc"],
  ["XCD", "East Caribbean Dollar"],
  ["XCG", "Caribbean Guilder"],
  ["XOF", "West African CFA Franc"],
  ["XPF", "CFP Franc"],
  ["YER", "Yemeni Rial"],
  ["ZAR", "South African Rand"],
  ["ZMW", "Zambian Kwacha"],
  ["ZWL", "Zimbabwean Dollar"],
];

export const CURRENCIES: CurrencyOption[] = RAW_CURRENCIES.map(([code, name]) => ({
  code,
  name,
  symbol: currencySymbol(code),
}));

/** Format a money amount in the user's chosen currency. */
export function formatMoney(amount: number, currency: string, opts?: { compact?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? (Number.isInteger(amount) ? 0 : 2);
  if (opts?.compact && Math.abs(amount) >= 1000) {
    const units = [
      { limit: 1e9, suffix: "b" },
      { limit: 1e6, suffix: "m" },
      { limit: 1e3, suffix: "k" },
    ];
    for (const { limit, suffix } of units) {
      if (Math.abs(amount) >= limit) {
        const value = amount / limit;
        const formatted = new Intl.NumberFormat("en-US", {
          maximumFractionDigits: value >= 100 ? 0 : 1,
        }).format(value);
        return `${currencySymbol(currency)}${formatted}${suffix}`;
      }
    }
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export const TX_STATUS_LABELS: Record<TxStatus, string> = {
  pending: "Pending",
  cleared: "Cleared funds",
  completed: "Completed",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month helpers on plain YYYY-MM-DD date strings (timezone-safe). */
export function monthLabel(offsetFromNow = 0): { year: number; month: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromNow, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function monthRange(offsetFromNow = 0): { start: string; end: string } {
  const { year, month } = monthLabel(offsetFromNow);
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return isoDate(new Date());
}

export type FinDocument = import("@/integrations/supabase/types").Database["public"]["Tables"]["documents"]["Row"];
export type TransactionDraft = import("@/integrations/supabase/types").Database["public"]["Tables"]["transaction_drafts"]["Row"] & { classification:string; review_confirmed:boolean; imported_transaction_id:string|null };

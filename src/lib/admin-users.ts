// Pure helpers for Admin user statistics. Counts come from the database; this only derives display values.

/** Growth from the previous period to the current one, in percent. Null when there is no previous baseline. */
export function growthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const ACTIVE_WINDOW_DAYS = 100;

/** A user is active when their latest recorded activity is within the active window. */
export function isActiveUser(lastActive: string | null, now: Date = new Date()): boolean {
  if (!lastActive) return false;
  const t = new Date(lastActive).getTime();
  return Number.isFinite(t) && now.getTime() - t <= ACTIVE_WINDOW_DAYS * 86_400_000;
}

export const ACCOUNT_STATUSES = ["active", "suspended", "deactivated", "restricted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const VERIFICATION_STATUSES = ["unverified", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Suspended and deactivated accounts are also blocked from signing in; restricted accounts can sign in but not move money. */
export function blocksSignIn(status: AccountStatus): boolean {
  return status === "suspended" || status === "deactivated";
}

/** Adjustment amounts are positive with at most two decimals. */
export function validAdjustmentAmount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

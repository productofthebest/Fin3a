/** Normalize names only for comparison; never use this as identity verification. */
export function normalizeLegalName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

/** Exact normalized comparison. No fuzzy matching or partial-name acceptance. */
export function legalNamesMatch(verifiedLegalName: string, resolvedBankAccountName: string): boolean {
  const verified = normalizeLegalName(verifiedLegalName);
  const resolved = normalizeLegalName(resolvedBankAccountName);
  return verified.length >= 2 && resolved.length >= 2 && verified === resolved;
}

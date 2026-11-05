export interface PhoneContact { tel?: string[]; email?: string[] }

/** Never use a contact's name as an account identifier. */
export function contactIdentifiers(contacts: PhoneContact[]): string[] {
  return [...new Set(contacts.flatMap(contact => [...(contact.tel ?? []), ...(contact.email ?? [])])
    .map(value => value.trim()).filter(value => value.length >= 3 && value.length <= 254))];
}

export function savedRecipientIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && /^FIN-[A-Z0-9]{8}$/.test(id)))];
}

export function recipientStorageKey(userId: string): string {
  return `fin3a:saved-recipients:${userId}`;
}
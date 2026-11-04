// The model receives text and aggregates, never executable account/Admin tools.
export function readOnlyAssistantOptions() {
  return { tools: {}, toolChoice: "none" as const };
}

// Refuse Admin prompts before financial reads, web research or paid inference.
// The actual access boundary remains own-user reads and no executable tools.
export function adminInformationRequest(text: string): boolean {
  return /\badmin(?:istrat(?:or|ion|ive))?\b|\badmin_[a-z_]+\b|\/admin(?:\b|[-/])|\b(?:audit logs?|service[- ]role|other users?' (?:accounts?|balances?|details?))\b/i.test(text);
}

export const ADMIN_INFORMATION_REFUSAL = "The assistant cannot retrieve, review or disclose Fin3a Admin information. I can only help with your own personal account records.";
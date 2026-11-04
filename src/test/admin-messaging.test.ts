import { describe, expect, it } from "vitest";
import { messageDraftSchema, messagingBlocker } from "../lib/admin-messaging";

const draft = { audience: "one", userId: "00000000-0000-4000-8000-000000000001", channel: "push", purpose: "account", title: "Account notice", body: "Please review your account." };
describe("Admin message recipient rules", () => {
  it("accepts exactly one registered-account identifier", () => expect(messageDraftSchema.safeParse(draft).success).toBe(true));
  it("rejects a recipient array instead of one user", () => expect(messageDraftSchema.safeParse({ ...draft, userId: [draft.userId] }).success).toBe(false));
  it("requires an identifier for one-user messages", () => expect(messageDraftSchema.safeParse({ ...draft, userId: null }).success).toBe(false));
  it("supports all users for announcements", () => expect(messageDraftSchema.safeParse({ ...draft, audience: "all", userId: null, purpose: "announcement" }).success).toBe(true));
  it("does not broadcast recipient-specific account notices", () => expect(messageDraftSchema.safeParse({ ...draft, audience: "all", userId: null }).success).toBe(false));
  it("keeps every unverified channel blocked", () => {
    for (const channel of ["push", "email", "sms"] as const) expect(messagingBlocker(channel, "one", "account").length).toBeGreaterThan(20);
  });
});
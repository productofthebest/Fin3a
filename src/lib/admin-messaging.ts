import { z } from "zod";

export const messageDraftSchema = z.object({
  audience: z.enum(["one", "all"]),
  userId: z.string().uuid().nullable(),
  channel: z.enum(["push", "email", "sms"]),
  purpose: z.enum(["account", "announcement"]),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(1000),
}).superRefine((draft, ctx) => {
  if (draft.audience === "one" && !draft.userId) ctx.addIssue({ code: "custom", path: ["userId"], message: "Select one user." });
  if (draft.audience === "all" && draft.purpose === "account") ctx.addIssue({ code: "custom", path: ["purpose"], message: "Account notices require one specific recipient and event." });
});

export type MessageDraft = z.infer<typeof messageDraftSchema>;

// Fail closed: credentials alone do not establish consent, delivery readiness or audit safety.
export function messagingBlocker(channel: MessageDraft["channel"], audience: MessageDraft["audience"], purpose: MessageDraft["purpose"]) {
  if (channel === "push") return "Push sending is unavailable. Firebase web push, device registration and consent checks are not configured.";
  if (channel === "email") return audience === "all" || purpose === "announcement"
    ? "Broadcast and promotional email require a marketing service and verified subscription consent."
    : "Account email requires a verified sender domain and an approved account-notice template.";
  return "SMS sending is unavailable until sender approval, funding, recipient consent and audited delivery are verified.";
}
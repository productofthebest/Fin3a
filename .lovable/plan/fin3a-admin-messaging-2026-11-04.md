# Fin3a Admin Messaging

## What changes
- Add **Messages** to the existing Admin menu without redesigning other pages.
- Search registered users and select **one user at a time**. No bulk or “all users” sends.
- Choose push notification, email or SMS; show recipient, message preview and channel availability before a separate send confirmation.
- Show actual submission/delivery results when the provider supports them, with honest unavailable and failure states. Never call a provider acceptance “delivered.”
- Keep messaging outside the AI assistant: no recipient lists, message history, Admin information or send access for AI.

## Message types
- **Account notices:** only about a specific event or support request for the selected user. Email uses fixed approved account-notice templates, not an unrestricted email-sending endpoint.
- **Announcements/promotions:** require explicit channel-specific consent. Promotional email cannot use Lovable's app-email service, even for one recipient; it needs a dedicated marketing service such as Klaviyo. Keep this email mode unavailable until that service and consent handling are configured.
- Never send passwords, OTPs, credentials or private financial details in notifications. Use a secure Fin3a page link when details need sign-in.

## Channel setup
- **Push:** connect Firebase Cloud Messaging with web push enabled. Add a user-controlled notification permission button and protected device registration. In the embedded preview, ask the user to open Fin3a in its own tab; background push uses a dedicated messaging worker, not an offline cache.
- **Email:** set up an owned sender domain for Lovable account notices. Promotional email requires a separate marketing provider and subscription handling. Keep unsupported modes visibly unavailable rather than simulating sends.
- **SMS:** use the existing Termii account configuration in a separate general-message sender; do not change the sign-in OTP flow. Confirm sender approval, account funding and applicable promotional-message rules before enabling it.
- SMS and external services can incur charges. No paid test or message to a real user without explicit approval.

## Security and technical implementation
- Protected server functions verify the authenticated administrator before any privileged lookup or provider call. Database operations re-check the existing Admin role through protected RPCs and write immutable Admin audit evidence.
- Resolve contact information from the selected account server-side; never accept arbitrary recipient email addresses, phone numbers or device tokens from the Admin browser.
- Use persistent idempotency for confirmed send attempts to prevent duplicate sends on retries. Unknown provider outcomes stay unknown and are not automatically resent.
- Store consent and push registrations with owner-scoped access; registration must belong to the authenticated user, and logout/account changes must not retain another user's push association. Remove stale provider-rejected tokens.
- Do not create app-email queues, email tables or unsubscribe infrastructure. Lovable owns account-email delivery/suppression; the marketing service owns promotional-email subscriptions. Use the existing immutable Admin audit trail for action evidence.
- Preserve all balances, financial history, current roles, account restrictions and unrelated features. No publication is included.

## Verification and delivery gates
- Test administrator-only access, one-recipient targeting, consent checks, content validation, duplicate-send protection, provider errors and independence from the AI assistant.
- Verify real signed-in Admin selection, previews, confirmation and unavailable states on desktop and phone.
- After channel setup and explicit test-send approval, send to an approved real test recipient and check the provider result and audit read-back. Physical-device permission/background delivery and isolated adversarial testing remain separate gates.
- Record implementation, test evidence and remaining setup dependencies in the master checklist; do not declare sending complete before real delivery verification.

## Approval requested
Approve this single-user messaging scope and security design. Provider setup and any paid test sends will be handled separately; no financial records will change.
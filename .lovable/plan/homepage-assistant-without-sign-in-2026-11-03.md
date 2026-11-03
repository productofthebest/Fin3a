# Homepage assistant without sign-in

## Requested experience
- Visitors can ask Fin3a general financial questions immediately, without signing in.
- Visitors receive no answers based on private account records. Questions needing personal figures invite them to sign in.
- After sign-in, personal financial questions use the existing protected assistant and only the current account's records.
- Preserve the homepage appearance, current sign-in methods, saved financial data and dashboard features. Voice and document scanning retain their existing sign-in requirement in this change.

## Safe implementation
1. Implement and verify in **Fin3a Staging first**, confirming independent backend, authentication and OpenAI key. This project's shared production backend must not be used for guest paid-request tests.
2. Add server-verified bot protection and a server-issued, short-lived visitor session without creating anonymous accounts. Apply durable visitor and shared request limits; never rely on browser counters or worker memory. Choose conservative defaults and document them for approval before promotion.
3. Add atomic shared spending reservations before every guest OpenAI request. Require accurate configured pricing, bounded input/output and a working global shutdown switch; fail closed when pricing or admission is unavailable. Visitor requests must appear in usage monitoring without exposing chat content or financial data.
4. Add a guest-only streaming handler with no financial-data access. Do not remove authentication from the existing personal assistant endpoint or impersonate an account to use its quota. Do not trust browser-supplied assistant/system turns.
5. Remove the homepage's compulsory sign-in response for ordinary text questions only after the protected guest handler is ready. Keep optional sign-in prompts, and direct verified users to their personal assistant for record-based answers. Correct the guest disclaimer so it does not claim to answer from records.

## Verification and release
- Run the entire existing automated suite after each implementation batch; add checks for guest/private separation, invalid visitor credentials, shutdown, missing pricing and concurrent admission.
- In isolated staging, test real guest questions, bot rejection, limit edges, budget blocking and simultaneous requests. Verify signed-in personal answers against that user's saved records, logout separation and desktop/mobile homepage behavior.
- Update the master checklist with implementation, automated evidence, real-use evidence and blockers separately.
- Report exact production code/schema changes and obtain explicit approval before promotion. Copy no users, records, sessions or secrets; do not publish.

## Current status
Proposal only: homepage still requires sign-in. No application or database changes, financial writes or paid AI requests made. Staging source access from this chat is read-only; implementation and hosted verification must take place in Fin3a Staging's chat before production promotion.
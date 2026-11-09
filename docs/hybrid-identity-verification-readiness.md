# Hybrid identity verification foundation

## Scope
- Adds an append-only, user-scoped identity-verification event table for a future trusted KYC provider integration.
- A verified event requires a provider-supplied legal name, normalized comparison name, provider event reference and verification timestamp.
- Only the service role can insert provider outcomes. Authenticated users can read only their own status. No client-side or Settings write path can create or modify a verified identity.
- Events cannot be updated or deleted. Corrections must arrive as a new provider event.
- This migration does not collect identity documents, call a KYC provider, or mark anyone verified.

## Hybrid verification sequence still to implement
1. Select and contract a KYC provider and configure server-side credentials and signed webhook verification.
2. Create a verification session using the authenticated Fin3a user ID as the immutable provider reference.
3. Verify webhook signatures and provider event IDs server-side, then append the provider result through a service-role-only writer. Never trust browser callback claims.
4. Compare Flutterwave's server-resolved Nigerian bank account name against the latest non-expired verified legal name. Settings display_name remains an expected-name hint only.
5. Restore NGN withdrawals only after ownership matching is wired into the existing withdrawal reservation path and all existing payout safeguards pass isolated tests.
6. Verify each international Flutterwave country/currency/method corridor against merchant-account evidence and route-specific tests. No global route enablement.

## Deliberately not enabled
- NGN withdrawal creation remains locked.
- International withdrawal creation and the immutable database gate remain locked.
- No provider, webhook secret, merchant approval, verification result, or user identity is fabricated.
- Migration application and isolated database tests must be confirmed before treating this schema as live.

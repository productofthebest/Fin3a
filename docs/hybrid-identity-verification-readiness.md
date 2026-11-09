# Hybrid identity verification foundation

## Product decisions
- Initial account registration uses only full name, email address, phone number and password. Email and phone ownership must be verified.
- Do not require BVN, NIN, passport, face scan or a KYC-provider session merely to create an ordinary Fin3a account.
- The editable Settings display name is a profile value, not verified legal identity.
- Withdrawal eligibility is a separate, risk- and jurisdiction-based control. Before enabling a payout route, Fin3a must satisfy the identity, AML/CFT, safeguarding and customer-due-diligence requirements applicable to the product, customer, destination and regulated partners. Face verification alone must not be treated as legal identity or bank ownership proof.

## Scope of this foundation
- Adds an append-only, user-scoped identity-verification event table for a future trusted verification integration.
- A verified event requires a provider-supplied legal name, normalized comparison name, provider event reference and verification timestamp.
- Only the service role can insert provider outcomes. Authenticated users can read only their own status. No client-side or Settings write path can create or modify a verified identity.
- Events cannot be updated or deleted. Corrections must arrive as a new provider event.
- This migration does not collect identity documents, call a verification provider, or mark anyone verified.

## Nigerian bank withdrawal sequence still to implement
1. Confirm the exact customer identity checks required for Fin3a's Nigerian product, licence/partner model and customer tier. Do not assume a face scan replaces BVN/NIN or other applicable requirements.
2. Configure the approved verification provider and server-side credentials; verify signed callbacks and bind every session to the authenticated Fin3a user.
3. Store only the minimum permitted verification evidence. Do not store raw BVN/NIN or biometric templates unless expressly required, lawful, secured and approved.
4. Resolve the Nigerian bank account server-side through Flutterwave.
5. Compare the resolved account name against the current non-expired verified legal name using the exact normalized matcher. A Settings display name is never sufficient.
6. Wire the result into the existing NGN withdrawal reservation path and test limits, risk controls, idempotency, webhook authenticity, settlement, failure and reversal handling.
7. Keep NGN withdrawal creation locked until the above checks and independent review pass.

## International payout corridor policy
- Fin3a may offer only the countries, currencies, payout methods and beneficiary types explicitly enabled for TOP FLOOR LIMITED in its Flutterwave merchant dashboard and confirmed by current provider/merchant evidence.
- A country appearing in generic Flutterwave API documentation is not proof that this merchant account is approved for that corridor.
- Every enabled corridor must have an explicit server-side allowlist entry and validated country-specific schema, currency, bank/payment method, limits, fees/FX disclosure, beneficiary checks, settlement and reconciliation tests.
- Countries/currencies/methods absent from the merchant-approved allowlist must remain unavailable. Never fall back to a global international-withdrawals switch or infer approval from a neighbouring country.
- The exact dashboard-approved corridor list has not yet been supplied to or independently verified by the implementation team. Do not populate guessed countries or enable any international route until the list and evidence are recorded.
- International withdrawals remain locked until non-NGN reservations are integrated with every balance-consuming path and corridor-specific provider settlement/reversal tests pass.

## Deliberately not enabled
- NGN withdrawal creation remains locked.
- International withdrawal creation and the immutable database gate remain locked.
- No provider, webhook secret, merchant approval, verification result, corridor approval or user identity is fabricated.
- Migration application and isolated database tests must be confirmed before treating this schema as live.

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
- Events cannot be updated. Corrections must arrive as a new provider event.
- Verification events are linked to their owning auth account with `ON DELETE CASCADE`. Deleting an account therefore removes its associated identity-verification evidence instead of being blocked by a restrictive foreign key. This is the deletion exception to the append-only event history.
- Account deletion must still follow the applicable legal, regulatory and partner retention policy. If a specific record must be retained, the lawful basis, retention period, access restrictions and deletion/anonymisation workflow must be documented before account deletion is processed; do not silently retain identity data indefinitely.
- The service role has SELECT and INSERT grants only; ordinary application roles are not granted direct DELETE access.
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
- Fin3a may offer only the countries, currencies, payout methods and beneficiary types explicitly enabled for TOP FLOOR LIMITED for **outbound transfers/payouts**, confirmed by current provider/merchant evidence.
- Do not treat Flutterwave's **Payment Methods** settings as proof of outbound payout approval. The supplied screenshots show inbound/customer payment configuration: Bank Transfer—Nigeria enabled; Bank Transfer—Ghana requests access; Pay With Bank—Nigeria and UK/EU enabled; Pay With Bank—South Africa requests access; Mobile Money—Ghana, Rwanda and Uganda enabled. Apple Pay, eNaira, USSD and NQR are also shown as enabled payment methods. These are recorded as payment-acceptance settings only, not as withdrawal corridors.
- A country appearing in generic Flutterwave API documentation, or in the Payment Methods screen, is not proof that this merchant account is approved to send payouts there.
- Every enabled outbound corridor must have an explicit server-side allowlist entry and validated country-specific schema, currency, bank/payment method, limits, fees/FX disclosure, beneficiary checks, settlement and reconciliation tests.
- Countries/currencies/methods absent from the merchant-approved payout allowlist must remain unavailable. Never fall back to a global international-withdrawals switch or infer approval from inbound payment methods.
- The exact outbound payout country/currency/method list has not yet been supplied or independently verified. Obtain the Flutterwave Transfers/Payouts dashboard evidence or written merchant confirmation before populating the allowlist or enabling any international route.
- International withdrawals remain locked until non-NGN reservations are integrated with every balance-consuming path and corridor-specific provider settlement/reversal tests pass.

## Deliberately not enabled
- NGN withdrawal creation remains locked.
- International withdrawal creation and the immutable database gate remain locked.
- No provider, webhook secret, merchant approval, verification result, corridor approval or user identity is fabricated.
- Migration application and isolated database tests must be confirmed before treating this schema as live.

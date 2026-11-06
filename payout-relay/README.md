# Fin3a Flutterwave relay: payouts and hosted collections

This is a fixed-destination server-to-server relay for Fin3a. It is **not** a client-side integration and must not be exposed without HTTPS, a strong shared token, secret storage, and hosting/network controls.

## API surface

### Outgoing payouts

- `POST /v1/flutterwave/transfers`
- `GET /v1/flutterwave/transfers/{numeric-transfer-id}`
- `GET /v1/flutterwave/transfers?reference=F3W-...`

The relay forwards only to Flutterwave V3 `/transfers` endpoints. It supports the documented bank-payout currency families: NGN, GHS, KES, MWK, TZS, UGX, USD, EUR, GBP, XAF, XOF, and ZAR. The international USD/GBP/EUR flow validates the bank routing/SWIFT and currency-specific beneficiary metadata documented by Flutterwave. Local bank payouts still require the destination bank's Flutterwave bank code.

Mobile-money payouts are accepted only for a documented currency/operator pairing: KES (Safaricom, T-Kash, Airtel, M-Pesa/MPS), GHS (AirtelTigo, MTN, Telecel, Vodafone), XOF (FMM, Moov, Orange Money, Wave, Free Money), RWF (MPS, MTN), UGX (Airtel, MPS, MTN), and EGP (EGP wallets). Provider account permissions and current country availability still apply. The recipient phone number must include its country code.

The relay rejects unsupported currencies/operators, malformed beneficiary data, unknown routes, unauthenticated requests, oversized bodies, redirects, and invalid requests. It does not retry a transfer POST. A timeout is an unknown outcome: reconcile by the unique transfer reference before considering any retry.

### Incoming payments / account funding

The Fin3a application must authenticate Flutterwave V3 webhook deliveries by exact comparison of the `verif-hash` header with the configured webhook secret hash before parsing or processing the event. The webhook handler must then load the matching pending deposit from server-side storage, call the transaction verification route, compare the provider transaction ID, reference, exact amount, currency and final successful status, and pass verified evidence to a single idempotent database settlement operation. A valid webhook hash alone is not payment evidence. Never credit from browser redirects or webhook body fields alone.


- `POST /v1/flutterwave/payments`

This route creates a Flutterwave-hosted checkout session. It accepts only an allowlisted country/currency combination and a customer email/name, then returns the provider response containing the hosted checkout link. It does **not** accept or process raw card numbers, CVV, PIN, or expiry data; card entry and authentication stay on Flutterwave's hosted checkout.

The currently configured payment-method matrix is:
- Nigeria (NGN): card, bank transfer
- Ghana (GHS): card, mobile money
- Kenya (KES): card, M-Pesa
- UK (GBP), US (USD), and configured SEPA countries (EUR): card and bank-account payment
- South Africa (ZAR): card and bank account
- Malawi (MWK), Uganda (UGX), Rwanda (RWF), Tanzania (TZS), Côte d'Ivoire/Senegal (XOF), and Cameroon (XAF): card and the corresponding documented mobile-money option

Flutterwave account-level enablement and regional restrictions determine which methods are actually available at checkout. The `PAYMENT_REDIRECT_URL` environment variable must be an HTTPS Fin3a callback. The callback must verify the payment server-side using Flutterwave's transaction verification API before crediting a Fin3a balance. A browser redirect alone is never proof of payment.

## Railway deployment

Create a separate Railway service from this GitHub repository and select the branch containing this PR. Set the service **Root Directory** to `/payout-relay`; Railway will detect the Dockerfile there. Set healthcheck path to `/health`. The service listens on Railway's injected `PORT` (local fallback 8080). Configure secrets through Railway Variables, never Git. Deploy initially with placeholder credentials only.

The health response reports `ready` for the payout relay and `payments_ready` only when the HTTPS payment callback is configured. Health readiness does not prove Flutterwave connectivity, merchant permissions, static egress, or settlement.

## Run locally (mock/admission tests only)

Requires Node.js 20 or newer.

```sh
cd payout-relay
cp .env.example .env
npm test
npm start
```

Tests validate local request admission only. They do not call Flutterwave or prove card authorization, bank payout capability, or settlement.

## Required deployment configuration

Set values in the hosting platform's secret manager, not in Git:

- `RELAY_SHARED_TOKEN`: cryptographically random, at least 32 characters. Store the same value as Fin3a's `FLW_PAYOUT_RELAY_TOKEN`.
- `FLW_SECRET_KEY`: Flutterwave secret key for relay API calls. The main Fin3a server may also need a key for existing bank lookup/account-resolution functions; do not assume Flutterwave issues separate scoped keys unless the merchant dashboard/provider confirms it.
- `PAYMENT_REDIRECT_URL`: HTTPS Fin3a callback that verifies payment server-side before crediting the ledger. Leave unset until that callback exists and is reviewed.
- `PORT`: supplied by the hosting platform.
- `RELAY_ALLOWED_SOURCE_IPS`: optional exact source IPs if the host can reliably expose the actual Fin3a caller peer IP. Do not trust arbitrary forwarded-IP headers.

The relay host must provide:
1. HTTPS ingress with a valid certificate and no public plain-HTTP route.
2. A dedicated, documented **static outbound IPv4** address.
3. Firewall/ingress rate limits and request-size limits.
4. Secret storage, log redaction, access controls, health monitoring, and incident rotation.
5. A deployment region and uptime policy suitable for financial requests.

Add the relay's static outbound IP to Flutterwave's payout IP allowlist in the merchant dashboard. Configure Fin3a's outbound IP allowlist on the relay only if the relay host can authenticate the actual peer address safely. These are separate controls.

## Fin3a application secrets

Configure through the secure server-side secrets interface only:

- `FLW_PAYOUT_RELAY_URL=https://<your-relay-host>/` (origin only; no path/query)
- `FLW_PAYOUT_RELAY_TOKEN=<same random relay token>`
- `PAYMENT_REDIRECT_URL=https://<your-fin3a-callback>/...` (must match the relay variable)
- `FLW_PAYOUT_ENVIRONMENT=production`
- `FLW_STATIC_EGRESS_VERIFIED=true` only after the hosting provider confirms the relay's static egress IP
- `FLW_IP_WHITELIST_VERIFIED=true` only after Flutterwave confirms that exact IP is allowlisted
- `FLW_PRODUCTION_VERIFIED=true` only after account permissions, production credentials, and merchant funding are independently checked
- `FLW_WEBHOOK_HASH=<V3 webhook secret hash>` stored identically in Fin3a and Flutterwave

Keep `FLW_WITHDRAWALS_ENABLED` unset/false until all payout gates pass. Never put the Flutterwave secret key in the Fin3a browser bundle or Git repository. Do not set verification flags merely to make the UI enable.

## Safe promotion checklist

- [ ] Confirm Flutterwave has enabled the required collection methods and payout destinations for the merchant account.
- [ ] Choose a relay host that explicitly supports static outbound IP; verify with the provider.
- [ ] Deploy to a dedicated relay environment and verify `GET /health` over HTTPS.
- [ ] Confirm invalid token → 401, unknown route → 404, malformed payout → 400, oversized body → 413.
- [ ] Confirm there is no general-purpose proxy, arbitrary URL, arbitrary HTTP method, or redirect-following behavior.
- [ ] Add the relay's static outbound IP to Flutterwave's allowlist and obtain confirmation.
- [ ] Implement and test the Fin3a payment callback: verify transaction ID/status/amount/currency/reference with Flutterwave before ledger credit.
- [ ] Configure production credentials and V3 webhook hash in secure secret managers.
- [ ] Verify webhook signatures, duplicate delivery, delayed status, and polling/reconciliation.
- [ ] Run only provider-approved low-value test payouts with an explicitly authorized test account and owner approval; reconcile provider transfer ID, reference, amount, currency, wallet reservation, and final bank receipt.
- [ ] Test international bank metadata, mobile operator/currency combinations, provider rejection, timeout/unknown outcome, and reversal handling.
- [ ] Review logs for absence of account numbers, tokens, keys, card data, and full payloads.
- [ ] Obtain separate explicit owner approval before setting `FLW_WITHDRAWALS_ENABLED=true`.

## Operational warning

A successful response from Flutterwave may mean a transfer was accepted/queued, not that the beneficiary bank or mobile wallet received funds. Fin3a must verify transfer status and settle its ledger only from a verified final status. An unknown result must remain pending/reserved for reconciliation; never retry a transfer blindly after a timeout.

A successful payment initiation only creates a checkout session. Fin3a must verify the completed payment directly with Flutterwave before crediting the user's balance. Never credit on the basis of a redirect or unverified webhook alone.

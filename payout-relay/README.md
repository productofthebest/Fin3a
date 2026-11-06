# Fin3a Flutterwave payout relay

This is a small, fixed-destination HTTPS relay for the Fin3a server. It is **not** a client-side integration and it must not be exposed without TLS, a strong shared token, and hosting/network controls.

## What it does

- Accepts only the three payout operations used by Fin3a:
  - `POST /v1/flutterwave/transfers`
  - `GET /v1/flutterwave/transfers/{numeric-transfer-id}`
  - `GET /v1/flutterwave/transfers?reference=F3W-...`
- Forwards only to the hard-coded Flutterwave V3 API origin.
- Holds the Flutterwave secret key on the relay host.
- Rejects unrecognized paths, methods, currencies, payloads, oversized bodies, redirects and unauthenticated requests.
- Does not retry a transfer POST. A timeout is an unknown outcome; Fin3a must reconcile by the unique transfer reference before any retry.
- Returns a minimal health/readiness response at `GET /health`.

## Run locally (mock-only)

Requires Node.js 20 or newer.

```sh
cd payout-relay
cp .env.example .env
# Set local-only placeholder values; never use production credentials locally.
npm test
npm start
```

The tests validate local admission only. They do not contact Flutterwave or prove bank payout capability.

## Required deployment configuration

Set these values in the relay host's secret manager, not in Git:

- `RELAY_SHARED_TOKEN`: cryptographically random, at least 32 characters. Store the same value as Fin3a's `FLW_PAYOUT_RELAY_TOKEN`.
- `FLW_SECRET_KEY`: Flutterwave **production** secret key, held only by the relay.
- `PORT`: supplied by the hosting platform.
- `RELAY_ALLOWED_SOURCE_IPS`: optional comma-separated exact source IPs if the platform can reliably expose the Fin3a caller's source IP. Do not trust arbitrary forwarded-IP headers.

The relay host must provide:
1. HTTPS ingress with valid certificate and no public plain-HTTP route.
2. A dedicated, documented **static outbound IPv4** address.
3. Firewall/ingress rate limits and request-size limits.
4. Secret storage, log redaction, access controls, health monitoring and incident rotation.
5. A deployment region and uptime policy suitable for financial requests.

Add the relay's static outbound IP to Flutterwave's payout IP allowlist in the merchant dashboard. Configure Fin3a's outbound IP allowlist on the relay only if the relay host can authenticate the actual peer address safely. The Flutterwave allowlist is not the same as the relay's inbound source-IP restriction.

## Fin3a application secrets

Configure through the secure server-side secrets interface only:

- `FLW_PAYOUT_RELAY_URL=https://<your-relay-host>/` (origin only; no path/query)
- `FLW_PAYOUT_RELAY_TOKEN=<same random relay token>`
- `FLW_PAYOUT_ENVIRONMENT=production`
- `FLW_STATIC_EGRESS_VERIFIED=true` only after the hosting provider confirms the relay's static egress IP
- `FLW_IP_WHITELIST_VERIFIED=true` only after Flutterwave confirms that exact IP is allowlisted
- `FLW_PRODUCTION_VERIFIED=true` only after account permissions, production credentials and merchant funding are independently checked
- `FLW_WEBHOOK_HASH=<V3 webhook secret hash>` stored identically in Fin3a and Flutterwave

Keep `FLW_WITHDRAWALS_ENABLED` unset/false until all gates pass. Never put the Flutterwave secret key in the Fin3a browser bundle or Git repository. Do not set verification flags merely to make the UI enable.

## Safe promotion checklist

- [ ] Choose a relay host that explicitly supports static outbound IP; verify with the provider.
- [ ] Deploy this service to a dedicated relay environment; verify `GET /health` reports ready over HTTPS.
- [ ] Confirm invalid token → 401, unknown route → 404, malformed transfer → 400, oversized body → 413.
- [ ] Confirm the relay has no general-purpose proxy, arbitrary URL, arbitrary HTTP method, or redirect-following behavior.
- [ ] Add the relay's static outbound IP to Flutterwave's allowlist; obtain confirmation.
- [ ] Configure production credentials and V3 webhook hash in secure secret managers.
- [ ] Verify webhook signature and retry delivery using Flutterwave's approved test procedure.
- [ ] Run only provider-approved low-value test payouts with an explicitly authorized test account and owner approval; reconcile provider transfer ID, reference, amount, currency, wallet reservation and final bank receipt.
- [ ] Verify duplicate notification, delayed status, timeout/unknown outcome, provider rejection and refund/reversal handling.
- [ ] Review logs for absence of account numbers, tokens, keys and full payloads.
- [ ] Obtain a separate explicit owner approval before setting `FLW_WITHDRAWALS_ENABLED=true`.

## Operational warning

A relay response of `status: success` from Flutterwave means the API accepted/created a transfer, not that the beneficiary bank has received funds. Fin3a must continue to verify transfer status directly with Flutterwave and settle its ledger only from verified final status. An unknown result must remain pending/reserved for reconciliation; never release or charge funds based solely on a timeout or unverified webhook.

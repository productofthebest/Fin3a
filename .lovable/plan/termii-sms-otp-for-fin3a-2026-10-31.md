# Termii SMS OTP for Fin3a

## Goal
Phone sign-up and sign-in on the existing /auth page, with the codes sent by Termii. Email/password, Google and Lovable sign-in stay as they are. Both methods still land on the same dashboard.

## Approach
The built-in sign-in system stays in charge of codes, sessions and accounts. Termii is only the delivery channel, so there is no second login system to secure.

```text
/auth (phone tab, +234 default)
   -> sign-in service creates the 6-digit code, expiry and attempt limits
   -> "Send SMS" hook -> our secure server endpoint -> Termii API (TERMII_API_KEY, server only)
   -> user enters code -> sign-in service verifies it -> /dashboard
```

## Steps
1. **Check first:** confirm the backend lets an SMS-sending hook point at our endpoint. If it doesn't, stop and come back to you with the fallback below before building anything.
2. **Secure endpoint** `/api/public/sms-hook`: checks the signature on every request (a shared hook secret), rejects unsigned calls, sends the code through Termii's OTP/SMS API with your sender ID, and never logs the code or the key.
3. **Delivery errors:** turn Termii failures (bad number, low balance, sender ID not approved, timeout) into a short, clear message on the code screen, with a "Try again" or "Use email instead" option.
4. **Limits:** code expires in 10 minutes. Resend after 60 seconds. At most 5 codes per number per hour and 5 wrong tries per code. The backend's built-in SMS limits apply, plus a per-number check in the endpoint backed by a small send-log table (only the number and the time are stored).
5. **UI tweaks on /auth:** Nigeria (+234) stays the default, and 080… is accepted and turned into +234 format. Show countdown, expiry and lockout messages. Sign-up asks for full name, and sign-in only works for numbers that are already verified (no account is created on sign-in).
6. **Tests:** Nigerian number formatting, expiry and resend timing, rate-limit decisions, signature rejection, and mapping Termii errors to messages. Then a live test sending a real SMS to your number.

## Fallback (only if step 1 fails)
A separate code store kept in the server, with hashed codes, expiry and attempt counters. This goes against the current rule of having a single OTP system, so I'll only build it with your OK.

## Needed from you
- Your Termii **sender ID** (approved name, or "N-Alert"/DND route).
- A phone number to receive the live test code.

## Technical details
- Hook secret is generated and stored as a secret. TERMII_API_KEY is read only inside the server handler.
- Send-log table has RLS on and is reachable only by the server role. GRANTs are added in the same migration.
- Termii endpoint: `POST https://api.ng.termii.com/api/sms/send`, channel `dnd` or `generic`, built with fetch (works on the edge runtime).
- Existing `signInWithOtp` / `verifyOtp` calls in auth.tsx stay. Only the messages and options change.

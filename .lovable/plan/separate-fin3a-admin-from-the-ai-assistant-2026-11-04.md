# Separate Fin3a Admin from the AI assistant

## Requested result
- Admin is for user management, revenue, fees and operational monitoring—not an AI assistant.
- AI can explain the signed-in user's own records, but cannot access Admin information, edit users or change NGN/USD balances.

## Changes
1. Remove AI usage cards, tables and links from Admin Overview and the Admin sidebar, preserving existing user management, revenue, split-bill and QR monitoring.
2. Make the existing `/admin` entry open Admin Overview instead of the AI usage screen. Keep the old address working; do not delete usage history or turn off existing budget, quota and emergency-stop protections.
3. Remove Admin's return link to the assistant; use Accounts as the explicit return to the personal workspace. Point the customer workspace's Admin link at Admin Overview.
4. Verify all personal AI entry points are limited to the authenticated user's aggregate records. Keep models without Admin, user-edit, transfer, swap, withdrawal or balance-adjustment tools. Add explicit read-only instructions, without treating instructions as a security boundary.
5. Add regression checks for these access boundaries and test signed-in Admin navigation and personal account help. Use no paid AI calls or financial changes during verification.

## Technical details
- Preserve existing database role checks, immutable audit history, two-admin balance adjustments, currency separation and provider settlement gates.
- Test the AI execution configuration and data-access boundaries, not just wording or hidden buttons. Any permission weakness discovered needs a targeted fix and separate isolated security verification.
- Admin-role holders may still use their own personal assistant outside Admin; their role must never grant the model broader access.
- No database migrations, provider activation, publication or customer financial-record changes are planned.

## Verification and limits
- Run relevant tests and the full regression suite; check the current build result.
- Check signed-in Admin on desktop and phone, the old Admin address, and the unchanged Accounts workspace.
- Report implementation and observed verification separately; do not claim full security certification or funded payment verification.
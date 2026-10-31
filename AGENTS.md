<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- AI assistant streams from `src/routes/api/chat.ts` (server route, bearer-verified) using the user's own OPENAI_API_KEY; the model only receives aggregate totals from `assistant-context.server.ts`, never descriptions/notes — keeps personal data minimal.
- Phone sign-in is a custom server OTP (`phone-otp.server.ts`, rules in `phone-otp.ts`) delivered by Termii because Cloud Auth's SMS can't use Termii; codes are HMAC-hashed in `phone_otps` (service-role only), phone→account mapping lives in `phone_identities`, and verified codes mint a Cloud Auth session via an admin magic-link token so email/Google/Lovable accounts stay untouched. Never link a phone without a verified code. Shared auth validation lives in `auth-options.ts` and field controls in `auth-fields.tsx`.
- Shared content-route metadata uses `page-meta.ts` to give each financial page its own title and description without changing page functionality.

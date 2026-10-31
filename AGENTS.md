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
- Authentication stays in Cloud Auth: phone OTP and email/password share `/auth` and the existing dashboard destination; never implement a second OTP system or merge unverified identities. Shared auth validation lives in `auth-options.ts` and field controls in `auth-fields.tsx` to keep both flows consistent.
- Shared content-route metadata uses `page-meta.ts` to give each financial page its own title and description without changing page functionality.

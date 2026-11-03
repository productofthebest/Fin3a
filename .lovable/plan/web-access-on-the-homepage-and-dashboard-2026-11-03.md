# Web access on the homepage and Dashboard

## Current state
- Dashboard already has an OpenAI web-search tool, but live search has not been verified.
- Neither guest nor signed-in homepage answers currently have web access.
- Existing spending records count tokens, not search fees. Guest reservations currently cover text-only answers.

## Proposed changes
1. Enable current-public-information searches on both homepage modes and preserve Dashboard web access, using the existing private OpenAI key.
2. Show clickable sources and distinguish public web information from the signed-in user's financial figures. Guests must never read private records.
3. Keep private financial context out of search generation through a separate public-information search step; do not rely solely on instructions to the model. Treat retrieved pages as untrusted evidence, not instructions.
4. Verify official tool pricing and supported limits, bound paid searches per answer, and reserve/account for search fees plus tokens before enabling the new tools. Preserve existing guest caps and shutdown checks; do not represent the broader account-budget concurrency issue as solved unless verified.
5. Run all existing tests plus focused privacy, source and fee-accounting tests. Check both pages on desktop and phone.
6. Update the master checklist with implementation, automated checks, real-use evidence and remaining dependencies separately.

## Approval and verification scope
Your standing rule requires a proposed-change report and explicit approval before production changes. Staging was deleted. **Approving this plan authorizes a scoped direct-live exception for these web-access application changes, additive AI-usage accounting changes, and a small number of paid public-information test questions on guest homepage, signed-in homepage and Dashboard.** Dashboard testing may save a test conversation; no financial records, users, keys or existing conversations will be changed or deleted. Test questions must contain no personal financial details.

No publication, financial-data migration, auth redesign or unrelated feature work is included. If supported tool limits/pricing cannot ensure the stated guest spending safeguards, keep homepage search disabled and report the blocker rather than weakening the caps.

## Technical approach
Preserve the current OpenAI Responses integration and models. Add a server-only bounded public-search path, retain bearer verification for personal answers and atomic guest admission for visitors, extend additive usage accounting to include search charges, and adapt homepage streaming to render citations safely. Inspect all content-route metadata without changing unrelated page behavior.
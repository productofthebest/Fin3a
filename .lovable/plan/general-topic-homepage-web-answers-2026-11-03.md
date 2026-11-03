# General-topic homepage web answers

## What changes
- Let homepage visitors ask about general public topics such as science, technology, sports, history, travel and current events—not just finance.
- Keep clickable sources, dates and uncertainty disclosures.
- Preserve signed-in personal answers and every existing spending limit. Leave Dashboard behavior unchanged.

## Costs
You selected AI web answers after the fee explanation. OpenAI search and model usage fees still apply; this does not make web search free. Keep existing one-search-per-answer limits, reservations, shutdown checks and usage recording. No new provider or subscription.

## Privacy and safety
The current search uses fixed topic templates. General-topic searching instead needs the user's public question. Reject searches containing obvious credentials, account identifiers or sensitive personal details; do not send stored records, account identity or prior conversation history to the search step. Explain rejected requests and ask for a public-topic rewording. Automatic detection cannot guarantee that a user never types personal information, so avoid claiming complete anonymisation.

Keep existing prohibited financial-product guidance and ordinary safety restrictions. “All web access” means broader public information, not bypassing logins, paywalls, private websites or spending limits.

## Approval scope
Approving authorizes a scoped direct-live change to homepage query handling and answer instructions, with no staging environment available, plus a small number of paid public-topic checks. No financial records, accounts, prices or keys will be changed; no publication. This replaces the homepage-only fixed-topic restriction, not the Dashboard's privacy policy.

## Verification
- Add tests for non-financial public topics, sensitive-input rejection and homepage-only scope.
- Run the full existing automated suite.
- Verify real guest and signed-in homepage general-topic answers with sources; check phone and desktop display.
- Record implementation, automated evidence, real-use evidence and remaining limits separately in the master checklist.

## Technical details
Add a dedicated browser-safe homepage query validator shared by the guest and protected homepage endpoints. Keep the separate server-only research step, existing model, output limits, reservations and source validation. Pass no financial snapshot to research. Dashboard retains its current query selector. Update architecture guidance to distinguish homepage public-query handling from Dashboard templates.
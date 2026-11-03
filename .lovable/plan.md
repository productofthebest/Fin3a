# General-topic web answers on Dashboard

## Proposed changes
- Extend Dashboard web research beyond finance to public topics such as science, technology, travel, sports and current events.
- Reuse the homepage's public-question privacy checks. Questions about the user's own records stay private and are not sent to web research.
- Keep clickable sources in replies and saved conversations.
- Preserve existing financial functionality, model, search fees, spending reservations, limits and shutdown controls. No financial records, database changes or publication.

## Technical details
- Replace Dashboard's fixed search templates with the existing bounded public-question validator and general-topic research mode.
- Validate the question before paid admission or conversation writes; keep financial snapshots and conversation history out of research.
- Update automated coverage, architecture notes and the master checklist; run the full regression suite.

## Verification and approval
Approval authorizes these scoped live application changes and one signed-in public-topic Dashboard question to verify an answer and clickable sources, including its normal AI/search fee and saved test conversation. No financial-record writes are authorized.

Check sources after reload and record automated versus real-use evidence separately. Existing conversation-history trust, account-budget concurrency and broader cost-limit verification remain outside this change and must not be declared resolved.
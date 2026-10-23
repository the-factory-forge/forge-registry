## Context

`forge-registry/src/routes/index.tsx` owns the homepage list. Counts, search and
category filters derive from that list. Existing browser tests enter the three
basic demos through their homepage cards; item documentation already links them.

## Decision

Delete the three list entries and make those tests open their existing URLs.
Use the existing homepage browser test to verify exclusion under All and Component.
Update the listing rule in the shared contract and local contributor guidance.
No new filtering abstraction, route, dependency or consumer migration is needed.

## Verification

Run registry formatting, lint, unit tests, type checks and build. Check homepage
filtering and retained demos in a browser, including narrow and desktop layouts.
Validate OpenSpec and review the task diff before transfer to the original checkouts.

# Tasks and evidence

## Completed

- [x] forge-registry: implement the bounded behavior on `codex/intranet-auth`.
- [x] forge-registry: update module guides, showroom, tests, manifest and generated distribution.
- [x] forge-registry: pass formatting, lint/type checks, production build, 88 unit tests and 9 distinct Chromium scenarios.
- [x] forge-registry: install the module independently with shadcn and pass strict consumer TypeScript checking.
- [x] forge-registry: resolve standards and contract cross-review findings; test the combined branches without merge conflicts, with 92 unit tests passing.
- [x] forge-spec: isolate this module's main requirements and matching delta from the combined promotion.

These are the implementation checks from 21 October 2026, not a new application
test run while splitting documentation. The initial implementation was checked at `37e54e8`; the showroom follow-up is recorded below.
The owner reports email delivery working in Seebach. Live provider delivery and
production S3 were not independently tested by the agent during that review.

## Acceptance

- [x] Record owner acceptance of the specification and Auth preview on 22 October 2026.
- [x] Reconcile the opt-in Employees showroom simulation and remove the Customer example tab in Registry `5208ddf`; 10 targeted browser tests, type checking and production build passed on 21 October.
- [x] Verify main/delta equality, validate this change and archive before the specification PR.

Other websites require scoped adoption and host integration checks. A Registry
merge or OpenSpec archive does not update them automatically.

The showroom follow-up changes no shared Auth requirement. The owner approved
publication of the four separate specification PRs; the former combined branch
remains historical and must not also be merged.

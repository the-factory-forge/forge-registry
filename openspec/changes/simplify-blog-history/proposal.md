# Proposal

## Why

Blogs keeps eight drafts per language, parallel reprise paths and historical returns that can delete later publications. Simplify this workflow while preserving the editor features that already work.

## What Changes

- **BREAKING:** keep one latest draft per article language. Ordinary saves replace it without a warning.
- Keep five publications, including the live version, plus the optional draft. Replace branches with a chronological list.
- Resume a publication into the draft, confirming replacement of an existing draft. Live content changes only after Publish succeeds.
- **BREAKING:** publish resumed content as a new publication instead of deleting the publications after its source. Keep confirmation for removals caused by the five-publication limit.
- Preserve the detailed comparator and existing safeguards. Update the showroom's examples and options to match.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugins`: simplify Blogs retention, resumption, publication and history presentation; preserve comparison and update showroom coverage.

## Impact

- Update `@forge/blogs`, `@forge/blogs-storage`, their mock and showroom together; regenerate `public/r/`. Preserve page props and ordinary client operations; document necessary history-origin adjustments.
- [tasks.md](tasks.md) lists the affected guides, glossary, ADR-0009, surface brief, tests and disposable consumer-install checks.
- No new dependency or historical-data migration. The owner confirmed this workflow has no existing data requiring migration.
- The inventory records Blogs source in L’Aspic and Osthoepathie Seebach; Forge Template does not install it by default. Customer adoption, data operations, release work and deployment remain outside this change.

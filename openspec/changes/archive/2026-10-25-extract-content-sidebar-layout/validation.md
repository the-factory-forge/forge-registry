# Validation

Verified on 2026-10-25 in the isolated task worktree and again after transferring the incremental change to the original `main` checkout.

- Official shadcn registry generation, registry JSON checks, formatting, lint, TypeScript and production build passed.
- All 108 unit tests passed.
- The six new layout browser checks passed: desktop and mobile in both themes, preserved fields when toggling, long panel keyboard access, homepage discovery and a host without a header offset.
- All 23 blog-history browser checks passed in the worktree. On the original checkout, 21 passed initially; the two mobile action checks passed after updating test setup to open the newly collapsed showroom Settings after reload. No production change was needed for these two checks.
- A disposable consumer installed `@forge/blogs` through shadcn, including the new layout dependency, and passed its TypeScript check.
- Inspected the standalone layout and migrated blog editor visually. The toolbar sticks with the panel beneath the header, and mobile uses normal stacked flow.
- Reconciled and strictly validated the owning layout specification. Verified that transferred task files match the worktree, unrelated tracked files remain unchanged and the original index is preserved.

Customer sites were not updated or deployed. Existing unrelated publication-validation failures from the preceding blog fix are outside this extraction and were not rerun here. The task worktree remains attached because Codex identifies it as the primary checkout and refused archival.

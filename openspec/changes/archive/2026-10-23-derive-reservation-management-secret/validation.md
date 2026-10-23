# Validation

Checked on 11 October 2026 against registry base `a070c8071586aa550fedeb16fad3dbd99d3a44c5` and Forge Spec base `5e716a8a1a8c4a69d18dd0d8089170e9cd2fad2b`.

## Registry

- Format and lint fixes completed. The reviewed diff contains only the helper, server export, guide, tests and generated `reservations-storage` JSON.
- `vpr registry:sync` and `vpr registry:check` passed. The existing manifest already declares both changed source files; no package or item dependency changed.
- `vpr test`: 81 tests passed, including stable derivation, raw/different-root rejection, short-root validation and the existing direct-key checks.
- `vpr test:reservations-storage`: two tests passed against the dedicated local `reservations_test` PostgreSQL container, including appointment/stay management and email links using a derived key.
- `vpr typecheck`, `vpr check` and `vpr build` passed. Existing lint and bundler warnings remain.

## Disposable consumer

The official shadcn CLI installed `@forge/reservations-storage` and all declared registry dependencies from `http://127.0.0.1:3100/r/{name}.json`, creating 26 files in a disposable Vite consumer. The exact original namespace was restored afterward. Installed server exports passed assertions for the fixed derivation vector, valid signatures, raw/different-root rejection and short-root validation. The installed source also passed TypeScript checks.

The first install attempt exposed an incorrect Vite package name in the disposable fixture. The retry used this repository's actual `npm:@voidzero-dev/vite-plus-core@1.0.0` alias. Adding the normal `vite/client` types resolved the fixture's CSS declaration error. Neither correction changed distributed source.

## Contracts and consumers

The new change passes strict OpenSpec validation. Full strict validation reports 9 passed and 12 failed items. The same 12 failures occur on the untouched Forge Spec baseline, primarily requirement-length warnings and existing change/spec reconciliation notices. No unrelated specification cleanup is included.

L'Aspic already implements the same derivation in its host adapter. Its clean source at `d5cc3286c19e7933e1039527af58de289c108ad5` includes the previously verified booking flow. Its server links and index match the recorded `3b8d283` baseline after alias and extension transformations. The rest of the plugin has customer adaptations and is not claimed as fully synchronized. No L'Aspic files changed during this promotion.

Forge Template at `bc76107ea5df26af49acc053a9d16e5960de8ee2`, including its pre-existing README edits, has optional setup guidance but no Reservations installation. No other Reservations consumer is recorded; unlisted consumers remain uninspected. Source adoption and deployment remain separate.

## Limits

No browser UI changed, so showroom browser tests were not rerun. No production database, secrets, email service or deployment was used. The helper requires an explicit host secret and provides no legacy-key fallback. Switching keys invalidates previous links. Registry and Forge Spec changes remain uncommitted and unpublished.

## Original checkout verification

The six registry files and nine Forge Spec files were transferred to their original `main` checkouts with byte-for-byte checks. Unrelated Forge Spec edits and both Git indexes were preserved. Registry `registry:check`, all 81 unit tests and `check` passed again in the original checkout; `check` reported zero errors and 194 existing warnings. The new OpenSpec change passed strict validation there, and both diffs passed whitespace checks. The disposable PostgreSQL container and network were removed. No files were staged or committed.

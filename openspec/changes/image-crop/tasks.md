## Implementation

- [x] Ship the crop dialog, shared geometry/export helper and manifest dependencies.
- [x] Integrate optional Blog thumbnail/banner dimensions and translated crop labels.
- [x] Add helper and Blog showroom examples and document host adoption.
- [x] Format/lint, generate distribution and validate registry, unit tests, types and build.
- [x] Verify crop/cancel/retry/encoding, Blog uploads, keyboard controls and responsive themes.
- [x] Verify a disposable shadcn install and OpenSpec structure.
- [x] Transfer only the task diff to the original checkout and recheck.

## Verification

### Blog upload follow-up

The screenshot's Thumbnail and Banner upload fields now crop by default in the
showroom, using host-supplied 1200 × 675 dimensions. The preview toggle still
demonstrates uploads without dimensions. A new consecutive-upload check exposed
notifications covering the second crop dialog; its backdrop and popup now sit
above those notifications.

The isolated worktree reused the archived implementation as its baseline, matching
the original checkout's existing uncommitted files. Formatting, lint fixes,
registry generation/check, TypeScript, combined check, build and 88 unit tests
passed. The broader browser run passed 16 of 18 checks initially: one unrelated
navigation timeout and the notification overlap failed. All four crop checks
passed after the fix, and the timed-out deletion check passed separately.

### Initial implementation

- Transferred only this task's diff to the unchanged original `main` checkout,
  leaving it unstaged and uncommitted. Registry/source equivalence, 88 unit tests,
  TypeScript, the combined check and production build passed there too.

- Original checkout: `forge-registry`, clean `main` at
  `2fdb57ee6e79869fafca385ba440a02b009a34ec`. Work performed on the isolated
  `codex/issue-7-image-crop` branch from that commit.
- Pinned pnpm 12.8.1: format, lint fixes, registry generation/check, 88 unit
  tests, standalone TypeScript, combined check and production build passed.
  Existing repository lint/build warnings remain; no crop-specific lint warnings.
- All 18 crop and Blogs browser checks passed, including on the production build.
  After the packaging/helper rename and feedback-height fix, the four focused
  crop checks passed again, including dragging, exact WebP bytes/dimensions,
  cancellation, focus restoration, pending dismissal protection, corrupt input,
  unsupported encoder, mobile error stability and retry File reuse.
- Official shadcn 4.21.1 installed `@forge/image-crop`, then `@forge/blogs`, into
  a disposable consumer through the local namespace. Installed source passed
  strict TypeScript. Distinct component/helper basenames prevent shadcn import
  rewriting from introducing a self-import.
- Strict OpenSpec validation and diff checks passed. Desktop light and 320px
  dark screenshots were reviewed; the mobile error-space finding was resolved
  and the focused review returned ship. Mechanical UI detector returned no findings.
  The existing design system was preserved; its pre-existing stale sidecar remains
  outside this feature.
- L'Aspic `d288e2b` uses `src/intranet/blogs/admin-page.tsx`; Osthoepathie Seebach
  `8d8618c` uses `src/intranet/routes/_auth/$lang/intranet/blogs/$id.tsx`.
  Neither supplies image dimensions yet. Preserve their localized adapters when
  separately adopting this feature. The template has no Blog editor integration.
  Unknown external consumers were not inspected; no customer files were changed.
- Browser verification used Chromium. Safari/Firefox, live storage and deployment
  were not exercised; storage code and API payload shape are unchanged.

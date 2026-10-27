# Validation

- Registry formatting, lint, type checking, `registry:check`, 81 unit tests and
  production build pass. Existing repository lint warnings remain.
- Two focused production showroom tests pass: booking/back/reschedule/cancel and
  English/French return from invalid direct management links. The keyboard check
  uses Tab/Shift+Tab, consistent with the shared tooltip's keyboard modality.
- Official shadcn installation of `@forge/reservations` from local generated
  `/r/{name}.json` into a fresh consumer created 21 files. The installed source
  and a caller using backHref type-check. The original namespace was restored
  byte-for-byte. No new manifest dependency was needed.
- L’Aspic type-aware lint and its production-built booking browser journey pass.
  Return works with Enter and after revocation; the destination has no token.
  Reviewed 1280px/390px screenshots in light/dark with visible focus and tooltip.
  The design detector reports no deterministic issues. Existing open-stay edits
  remain separate from the promoted heading change.
- The owning OpenSpec change passes strict validation. Full validation still
  reports the same 15 existing failures present in the checked-out baseline,
  mostly long requirement warnings. The original checkout has one additional
  existing change (`show-employee-website-visibility`) that also fails;
  none of these findings belongs to this navigation change.
- Diff whitespace and changed documentation links reviewed. Task changes are
  transferred to the original checkouts uncommitted, with checks repeated there.

Source and generated registry output are local and unpublished. No deployment,
production database operation, or update of unknown consumers was performed.

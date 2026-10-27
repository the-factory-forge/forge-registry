## Decision

Use the existing `backHref`, `parentId` and `onRenameSpace` values to retain headers with navigation or editing purpose. Otherwise the root sidebar supplies the name and actions. Preserve all host authorization, routes, themes, translations and storage behavior.

`drive` ships `registry/components/plugins/drive/index.tsx` to `@components/plugins/drive/index.tsx`. Reverse dependencies are `drive-storage`, `menus` and `menus-storage`. SiniGest relocates this source under `src/intranet/components/forge/plugins/drive`; its customer route embeds the browser without a back link or rename callback.

Registry work started from clean affected source at d323a725683cc4aaaa5fc2a19227dd2ff86b28fc in an isolated worktree. Existing registry auth documentation edits were not copied. SiniGest's pre-existing uncommitted Drive/Customers installation and concurrent customer Drive wiring were preserved; only the heading condition was backported. No full plugin reconciliation or release revision is claimed.

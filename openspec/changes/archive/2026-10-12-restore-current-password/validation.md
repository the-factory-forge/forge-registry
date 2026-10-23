# Validation

Registry checks use the pinned native pnpm 12.8.1 runner after the default
worktree wrapper failed with ENOEXEC. Source formatting/lint fixes, Auth generation,
JSON validation, TypeScript and production build pass. All 84 unit tests and 36
selected production browser/smoke tests pass. Browser coverage verifies missing
current passwords, retained failures, duplicate locks, successful clearing,
independent visibility, keyboard tooltips, recovery and the removed route's 404.

The 390px/1440px Account Security form was inspected in light and dark themes.
The Impeccable detector reports no findings. Shadcn 4.21.1 updated Auth into a
copied disposable consumer; its TypeScript check passes and the installed source
passes currentPassword and newPassword. The namespace was restored afterward.

OpenSpec 1.13.0 strict validation passes all 23 worktree items. Existing informational
messages concern long requirements and already-synced unrelated deltas.

No live authentication, provider email, storage/database or customer deployment
was tested. Server authorization and actual password verification remain host
responsibilities; no host server code is part of this registry. The full browser
suite was omitted in favor of the affected source and route regressions.

Existing dirty plugins/spec.md and consumers/sites.yaml were copied as baselines.
Only this task's delta was transferred; unrelated edits and staging remain.
Original-checkout OpenSpec validation passes all 27 items before archiving and all
26 remaining items afterward. The registry transfer
matched all 15 tested files byte for byte, including the removed route.

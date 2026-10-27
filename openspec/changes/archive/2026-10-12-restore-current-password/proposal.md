# Restore current-password verification

## Why

Before RC3, the user restored current-password verification for signed-in changes
and removed the standalone showroom change-password route. Account Security and
email recovery from sign-in are the two supported showroom paths.

## What changes

Restore the `{ currentPassword, newPassword }` Auth callback and required current
password with its own visibility control. Keep recovery and the single-entry new
password. Remove the showroom route and navigation; retain the exported page
component for existing host compatibility. Update docs, generated Auth and tests.

## Capabilities

- Modified: `plugins` (Single-entry password forms).

## Impact

Owning root: `forge-spec/openspec/changes/restore-current-password`.
Implementation: `forge-registry`. No dependency, database or migration change.
This supersedes the current-password removal in the archived simplify-password-forms
change. Consumer adoption and deployment remain outside this registry release.

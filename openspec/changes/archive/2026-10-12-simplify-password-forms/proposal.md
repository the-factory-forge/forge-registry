# Simplify password forms

## Why

Password reset and change forms currently repeat the new password, and signed-in
changes also ask for the current password. The requested shared UI collects the
new password once; email recovery remains the fallback for a forgotten password.

## What changes

Remove both extra fields, obsolete labels and mismatch validation from Auth.
Change the callback to `{ newPassword }`, document the required server migration,
and retain length validation, pending locks, failure drafts and success clearing.

## Capabilities

- Modified capability: `plugins` (Auth password forms).

## Impact

Owning change root: `forge-spec/openspec/changes/simplify-password-forms`.
Implementation: `forge-registry` source, generated Auth item, demos, docs and tests.
Forge Template and customer websites, including L'Aspic, are follow-ups only:
the user explicitly requested shared-registry work and deferred propagation.
No provider, database, dependency or schema is added.

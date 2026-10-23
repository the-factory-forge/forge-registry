# Promote the account page into Auth

## Why

The template profile and new Security page duplicated presentation outside the
registry. The user explicitly requested moving the account page into the existing
Auth plugin and backporting it into forge-template. This is reusable self-service
account UI; TC customer/project import rules remain site-specific.

## What Changes

- Extend `@forge/auth` with profile, key and account-security UI using host data/callbacks.
- Reconcile the account components into the template, retaining encryption, persistence,
  session authorization, localization and the removable intranet boundary.
- Record other consumers for optional adoption without updating them.

## Capabilities

### Modified Capabilities

- `plugins`: Auth includes the self-service account page and security presentation contract.

## Impact

Owning OpenSpec root: forge-registry. Implementation repositories: forge-registry and
forge-template. No new provider, server companion, dependency version, production
migration or deployment. Existing registry Auth exports stay compatible.

The authorized TC follow-up adopts the shared account page while preserving its
five profile routes, custom fields, avatar flow, HR confirmation and permissions.
Portable header/content composition and independent key-creation capability support
that integration; customer-specific workflows remain in TC.

The account follow-up adds optional host-supplied tabs and email-change requests
for any host-authorized account. About and plugin drafts remain mounted across
tab changes; delivery, confirmation and permission policy remain host-owned.
This follow-up changes registry source and its plugin spec; consumer adoption is
separate from source distribution. The original forge-spec records moved here
with the plugin contract.

## Specification destinations

- `plugins` → [forge-registry/openspec/specs/plugins/spec.md](../../specs/plugins/spec.md).

Reconcile the delta into the local plugin spec and validate this root before
archiving. Consumer integration work does not change the contract's ownership.

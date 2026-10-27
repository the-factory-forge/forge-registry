# Replace temporary passwords with single-use invitations

## Why

Administrators currently choose and share temporary passwords. The requested flow
lets each invited person choose their own password using a single-use link.

## What Changes

- Employees and Customers creation accept their existing identity/contact fields, with no password.
- The host issues and sends an expiring invitation; failed delivery preserves a resendable account.
- Acceptance sets the password once, verifies the invited email, clears pending onboarding, signs the recipient in automatically and preserves access rules. A failed sign-in leaves ordinary login available.
- Reconcile every known installed Forge consumer and TC's custom equivalent.

## Capabilities

### Modified Capabilities

- `plugins`: invitation-based employee onboarding and host responsibilities.

## Impact

The owning OpenSpec root is forge-registry. Implementation repositories: forge-registry,
forge-template, l-aspic, osthoepathie-seebach, sinigest, soleva, terminal60 and
TC website. Public-only inventory entries have no account onboarding to update.
The callback change is intentional and requires matching host adapters. No new
package, schema migration, bulk account change or deployment is required.

## Specification destinations

- `plugins` → [forge-registry/openspec/specs/plugins/spec.md](../../../specs/plugins/spec.md).

Reconcile the delta into the local plugin spec and validate this root before
archiving. Consumer integration work does not change the contract's ownership.

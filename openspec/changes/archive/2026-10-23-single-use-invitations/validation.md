# Validation — 2026-10-12

## Result

Invitation onboarding is reconciled in the registry, template, all five installed
customer sites and TC's custom account flow. Source changes remain uncommitted and
unpublished. No deployment, production mail, credential reset or live migration was
performed. All seven disposable test databases, their role and the registry worktree
were removed after verification. Existing unrelated local edits remain intact.

## Shared distribution

- Items changed: Employees, Employees Server and Customers. Projects is a reverse
  dependency of Customers; its unchanged contact/display interfaces remain compatible.
- Real `shadcn add @forge/employees @forge/employees-server @forge/customers` installation
  passed against locally generated output in a disposable consumer. The namespace of
  each real site was left unchanged. `distribution.json` records source/install hashes.
- Registry generation, manifest check, format/lint/type checks and production build pass.
- 10 focused source/service tests pass. 13 Employees/Customers/password browser tests
  plus 2 employee keyboard/optimistic tests pass. Desktop and mobile invitation forms
  were inspected. Customer UI checks also cover both themes and offline contacts.
- The 25 task files were transferred without overlap with the registry's seven existing
  dirty files. Relevant checks were repeated in the original checkout before cleanup.
  Lint reports existing warnings and no errors.

## Forge application checks

All six applications pass scoped formatting and lint/type checks. Production browser
runs use their own migration histories, isolated local databases and intercepted mail.
The scenarios cover creation without credentials, recipient-chosen passwords, both
roles, failed delivery, resending without duplicate creation, invalid/expired/replaced
links, concurrent use of one token, administrator edits invalidating links, neutral
public recovery, authorization, session revocation and legacy profile/password guards.

| Application | Final affected browser coverage |
| --- | --- |
| forge-template | 9 passed; Google case skipped without provider credentials |
| l-aspic | 11 passed across employee, recovery, invitation and profile runs; Google skipped |
| osthoepathie-seebach | 10 passed after updating the changed button selector; Google skipped |
| sinigest | 9 passed; Google skipped |
| soleva | 10 passed after adapting the test to its retained confirmation field; Google skipped |
| terminal60 | 11 passed; Google skipped |

Per-site `docs/registry-sync/2026-10-12-invitations.json` records the partial source
reconciliation and installed paths. No whole-plugin or full-template revision is claimed.

## TC custom flow

- Required formatting and lint/type checks pass.
- Unit suite passed (184 assertions, 9 unrelated skips before deleting the obsolete
  password generator/input tests). Final focused invitation/schema/UI tests pass (3),
  and the retained password-policy test passes.
- Invitation transactions were exercised on real PostgreSQL: replacement, expiry,
  wrong token, recipient email/role changes, disabled accounts, legacy token rejection,
  password hashing, session revocation and concurrent acceptance.
- Both production browser journeys pass (2): customer invitation/password recovery
  and employee creation/acceptance. They verify creation without a password, anonymous
  issuance denial, expired/replaced links, activation, replay rejection, preserved
  customer data, revoked old sessions and the employee invitation card/role.
- HR email uses the same acceptance path. Live email-provider delivery was not exercised.

TC's previously issued invitations requiring a temporary password must be reissued
when this code is deployed. Existing activated users keep their passwords and roles.

## Specification and scope

OpenSpec strict validation passes for all 27 items. The consumer inventory parses as
YAML. Public-only sites (artisanatvertical, cafe-des-promeneurs, raphaelbalet) have no
installed account onboarding. Source search under the local Forge and general roots
found no further integrated copies; unknown external consumers remain pending review.

The file list in `files.json` identifies this task's scope. Some template and spec files
also had earlier uncommitted changes; stage only invitation-related hunks in those files.

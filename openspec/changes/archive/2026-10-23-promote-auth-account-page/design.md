# Design

Follow [portable UI and host adapters](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/portable-ui-and-host-adapters.md).
TC's `e68819b9644439ed54cf18941039c90e34d8dcc7` implementation was custom source;
template profile/security then lived in host routes and `src/intranet/security`.
The original extraction used registry base `a8b2fa207f4cbd9b66e2956103fb20f18cdece9f`.

Extend the existing Auth manifest with `AccountPage`, `AccountSecurity`, `AgentKeys`
and their labels/styles. Use existing Base UI, Lucide, cn, icon-tooltip and action-toast;
no router, query, auth, database or environment imports are distributed. The account
component accepts a Security node; security accepts key and password-form nodes.
This composes existing host adapters without duplicating password-change cache logic.

The template retains its server RPCs, encrypted-key verifier, incremental migration,
translations and older-session fix. Rename its older `plugins/login` location to
`plugins/auth`, preserve existing auth screens, and add only the reviewed account
files and required helpers from a real local shadcn installation. Its prior pristine
installed baseline is unknown; this is a bounded reconciliation, not a full refresh.

Reverse dependency closure is Auth → intranet-sidebar → intranet-shell. Existing
callers retain their APIs. Other sites require explicit review/adoption; template
adoption cannot update their installed source. Generated item JSON is rebuilt,
not edited. No additional schema changes are needed for this extraction.

## TC adoption follow-up

The user subsequently requested TC adoption while retaining profile tabs, custom
fields and permissions. That adoption used registry base
`616c5850b847b020b7526c476c50a69622d6c116`; TC started clean on `main` at
`e68819b9644439ed54cf18941039c90e34d8dcc7`.
The shared page adds optional header/content composition; its existing default API
is unchanged. Key creation becomes optional independently of list/delete, and
revoked metadata retains the host's existing status. No TC fields or role rules
enter registry source.

TC adopts only the account subset from a real shadcn 4.21.0 local-namespace install.
`SelfServiceAccountPage` supplies its summary/avatar action, five routed tabs and
existing forms. Security/key adapters retain TC queries and server permissions.
The old custom source is the comparison baseline; no whole-Auth currency is claimed.
TC records paths, transformations and install evidence in `docs/registry-sync.md`.
No new dependency, environment requirement or database migration is introduced.
The template needs no follow-up change for these optional props. Other consumers
retain their previously recorded review status; this adoption does not deploy them.

## Account tabs and email requests

The account tabs and email follow-up is merged into registry `main` at
`f051fbb9b1027f7b39bae87fb65bfa625b9f9e97` (PR 18). It provides an optional
tab/callback API, immediate mounting and repeat requests after a successful send.
Eligibility is host-owned for all roles. Security keeps its existing unmount boundary. No new
provider, persistent pending-email state or plugin registration system is added.
The showroom reuses the existing account Name field and records requested email
arguments; browser checks exercise simultaneous submissions, draft retention, plugin panel lifetimes,
keyboard navigation and required-field semantics. Auth owns the changed source;
reverse dependencies remain intranet-sidebar and intranet-shell. Existing hosts
remain compatible and require separate adoption and provider checks.

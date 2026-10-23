## Context

Customers, Projects, Employees and Blogs receive records through props. Drive,
Menus and Reservations read through supplied clients. Existing hosts own query
keys, server authorization, navigation and transport. Some actions require IDs,
availability, tokens or credentials that the browser cannot predict.

## Decisions

Preserve [ADR-0002's host adapter boundary](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/portable-ui-and-host-adapters.md)
and [ADR-0003's host-owned Query data](https://github.com/the-factory-forge/forge-template/blob/main/concepts/adr/router-lifecycle-and-query-owned-server-state.md).
The new mutations control the pending UI; hosts retain authoritative records and cache keys.

Use TanStack Query's UI mutation pattern. A shared hook overlays a pure update
while pending, removes it on rejection and accepts new host data on reconciliation.
This avoids copying host records into a second authoritative query cache or
replacing an entire list on rollback. Existing providers are reused; standalone
instances get an instance-local client. Writes are guarded per view, without
automatic retries, offline queues or browser persistence.

Keep dialogs mounted when an optimistic deletion hides their table row. Retain
form drafts after rejection. Preview rescheduling from server-provided slot
endpoints and accept the final server response. Authentication, email, files,
new booking receipts and navigation needing server-issued IDs remain confirmed.

Ship the utility and TanStack Query dependency through the manifest. Existing
props remain compatible; hosts must reject callback errors and reconcile their
source data. Existing deployments change only after reviewed source installation.

## Verification

Delayed mock browser tests verify the pre-response view and rollback. Existing
plugin journeys cover successful reconciliation, permission boundaries, drafts,
keyboard interactions and mobile/themes. Registry generation, clean installation,
unit tests, type checks and build cover source distribution and application use.

## Context

The table hook exposed low-level mutation coordination to TableBulkDelete while
Auth repeated the batch loop. Drive adds a second adapter with preview tokens;
ordinary Employees deletion and retention deletion have different contracts.

## Goals / Non-Goals

Give each deletion session one owner and verify it through rendered table/Auth
interfaces. Preserve plugin props, server authorization, request IDs and labels.
Do not unify Employee retention transactions, move persistence into UI, add a batch
server API or upgrade customer source.

## Decisions

The hook owns session state and exposes open, confirm, close and lifecycle cleanup.
Adapters display targets, details and errors, and supply preparation and deletion
callbacks. An active session identity rejects stale async completions. Scope changes
invalidate unconfirmed sessions; a submitted batch retains its original callbacks
across refreshes and stops starting requests after disposal. Already sent requests
are not cancelable. Partial failure retains original request IDs and reruns previews.
If the view changed during submission, retry retains the original callbacks too;
failures remain visible and cannot target a different resource.

Auth uses the same mutation utility but renders host-supplied key metadata until
the host removes it. A Query provider is optional. Drive additionally guards its
token-map writes by preparation generation because ignoring a returned preview
does not undo an adapter's external ref assignment.

Keeping coordination methods would leave the two-owner convention possible, so
they are retired with the accepted source compatibility break. Keeping the batch
loop in a dialog would leave Auth duplicating it. Existing styles, token names,
toast provider and framework-neutral imports are retained.

## Risks / Trade-offs

Custom helper callers must migrate atomically with the helper. Auth installations
gain table-selection and optimistic-action dependencies, including TanStack Query.
The manifest and real shadcn installation verify this closure. No CSS or server
dependencies are newly introduced. Source adoption does not update running sites.

## Migration Plan

Rebuild generated items, verify lifecycle/browser and repository checks, and record
consumer handoffs before transfer. Existing sites remain unchanged. Resolve a
verified publication SHA for later reviewed installs and preserve host adapters.
Rollback requires restoring the helper and its callers together.

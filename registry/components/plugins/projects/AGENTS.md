# Projects

Projects supplies customer-owned project lists and basic editing. Read the
[integration guide](../../../../docs/projects.md) and
[Projects requirements](../../../../openspec/specs/plugins/spec.md#requirement-projects-plugin).

## Logic and ownership

- `index.tsx` composes the full directory, embedded `ProjectsList`, creation and
  detail pages. It reuses Customers UI and accepts host-provided Drive content.
- `project-form.tsx` submits only name, status and description. Customer ownership
  is resolved by the host at creation; an ordinary edit preserves owner, assignee
  and other host metadata. Status badges update status without saving unrelated
  name/description drafts.
- `server/schema.ts` relates each project to a customer profile with deletion
  restrictions. `server/service.server.ts` authorizes the persisted owner inside
  locked update/delete transactions; browser-provided ownership is not authority.
- Server listing is bounded and owner-scoped, with per-record authorization.
  Like Customers, it may return an empty page with a continuation cursor. The UI
  renders the supplied rows; host adapters own server paging and URL state.

## Change boundaries

Keep assignment controls and customer selection in the host. Embedded lists filter
by their supplied customer context and omit its redundant owner column. They still
require server authorization. Single deletion uses `record-deletion`; bulk deletion
uses `table-selection`, including embedded lists.

Inspect Customers imports when changing shared UI. The optional
[Projects–Drive connector](../../../../docs/projects-drive.md) owns that composition;
project persistence does not by itself grant file access or cascade file deletion.

## Checks

Use [project tests](../../../../tests/projects.test.mjs),
[browser tests](../../../../tests/projects.browser.mjs) and
[customer/project transaction tests](../../../../tests/persistence/customers-projects.integration.mjs).
Inspect both `src/showroom/projects-preview.tsx` and the customer detail composition
when changing list, section or navigation contracts.

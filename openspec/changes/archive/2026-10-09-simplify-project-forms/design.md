## Context

Projects supplies the form linked from Customers. ProjectForm is used by both
ProjectNewPage and ProjectDetailPage. Its old payload and directory props couple
basic editing to customer and assignee lookup. The screenshot requests removal
of Website URL, Owner and Assignee. ADR-0002 and ADR-0005 retain host integration
and authorization outside portable UI.

## Decision

Delete the form inputs, unused person picker and related labels. Submit only
name, status and description. Retain existing project metadata and list display
contracts, safe-link checks, validation for the remaining fields, failure recovery
and delete confirmation. Do not add field visibility flags or extension APIs.

The showroom demonstrates host ownership: customer routes already provide context;
a standalone create route chooses a customer in host-owned UI. Updates merge form
fields into the existing record. Host callbacks validate ownership; browser checks
never replace server authorization in a consumer.

## Compatibility and migration

ProjectFormValues no longer includes url, ownerId or assigneeId. Form pages no
longer accept ProjectDirectoryProps. Consumers remove these props and obsolete
label overrides, add the authorized owner during creation, and preserve stored
metadata when updating. No database migration, data clearing or automatic consumer
update occurs. AGENTS.md asks once when reusable scope is unclear, reusing an
explicit decision already made for the task.

## Validation

Run registry formatting, linting, unit tests, type checks, build, generated
registry checks and focused Projects/Customers browser tests. Check desktop and
mobile in both themes. Verify a temporary shadcn consumer install and its callback
contract. Validate shared OpenSpec files and transferred diffs in both originals.

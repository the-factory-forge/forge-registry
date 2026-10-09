# Projects

`@forge/projects` provides a project directory, an embeddable list, creation,
and Details/Drive pages. It installs source at `@components/plugins/projects`
and requires `@forge/customers`. Installing customers alone does not install
projects. Neither plugin contains backend or authentication code.

## Install and update

Configure the `@forge` namespace as described in [README](../README.md), then:

```bash
pnpm dlx shadcn@4.21.1 add @forge/projects
```

The item includes customers, cn, Link shims, Base UI, and Lucide. React and a
Tailwind 4 setup with semantic shadcn tokens are host prerequisites. It uses no
showroom CSS helpers, router, query client, form library, or notification service.
Updates copy source; review changes and keep host adapters outside managed
plugin directories. Updates do not synchronize deployed websites automatically.

## Components and host responsibilities

| Export              | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `ProjectsPage`      | Page wrapper around the searchable directory            |
| `ProjectsList`      | Directory card suitable for a customer Projects section |
| `ProjectDetailPage` | Project summary, Details form and Drive content         |
| `ProjectNewPage`    | Creation heading and shared form                        |

Props, `Project`, `ProjectFormValues`, `ProjectAssignee`, `ProjectStatus`,
`ProjectSection`, and `ProjectsLabels` are exported from the plugin entrypoint.
Every component accepts `className`, partial English `labels` overrides, and a
stable `linkComponent` implementing `LinkProps` from `@/components/link`.
Destinations are supplied by the host, including locale and customer context.
Framework route files are not shipped.

The directory receives `projects`, `customers`, optional `assignees`, controlled
`search`/`onSearchChange`, `loading`/`error`, optional `createHref`, required
`getProjectHref`, optional `getCustomerHref`, and optional `onDelete(id)`.
The host searches/fetches records. `customerId` additionally scopes the supplied
projects and hides Owner. Missing create/delete props hide those controls.
Customer company names take precedence over contact names.

Detail receives `project`, `backHref`, `sectionHrefs: { details, drive }`,
`section` (default `details`), `onSave(values)`, optional `onDelete(id)`, and
optional `driveContent`. Drive is empty by default. Images are display-only;
there is no upload or cropping workflow. Creation takes `backHref` and
`onCreate(values)` and has no summary, section navigation, or deletion.

All mutation callbacks return `Promise<void>`: resolve after success, reject on
failure. Check SDK error-return objects and throw in the adapter if necessary.
The plugin prevents duplicate submissions and reports overridable generic
feedback. The host owns persistence, access checks, reloading data, and
navigation after creation/deletion. Hiding an action is not authorization.

## Customer composition

```tsx
import { CustomerDetailPage } from "@/components/plugins/customers";
import { ProjectsList } from "@/components/plugins/projects";

// Inside the host customer route. Data, callbacks, and URLs come from the host.
<CustomerDetailPage
  {...customerPageProps}
  section="projects"
  projectsContent={
    <ProjectsList
      projects={projects}
      customers={customers}
      assignees={assignees}
      customerId={customer.id}
      search={search}
      onSearchChange={setSearch}
      createHref={`/projects/new?customerId=${encodeURIComponent(customer.id)}`}
      getProjectHref={(project) =>
        `/projects/${encodeURIComponent(project.id)}?customerId=${encodeURIComponent(customer.id)}`
      }
      onDelete={deleteProject}
    />
  }
/>;
```

This composition belongs to the host. The customers plugin never imports
projects. The optional [Drive plugin](./drive.md) similarly supplies `driveContent` from
the host; there is no Drive dependency today.

## Form and ownership contract

`Project` requires `id`, `name`, `ownerId`, and `status`; nullable optional fields
are `description`, `url`, `posterImage`, and `assigneeId`. Status values are
`requested`, `prospect`, `under-construction`, and `production`, with creation
defaulting to `requested`. All status labels are overridable.

Both shared forms edit only Name, Status, and Description. Website URL, Owner,
and Assignee controls are site-specific and belong in host-owned UI when needed.
The forms need no customer or assignee directories. The existing directory and
summary may still display metadata supplied by the host.

When creating from a customer, take its ID from authorized host context and add
it in `onCreate`. A standalone creation route must collect or resolve that context
outside the shared form. For updates, merge the three submitted fields into the
existing record so ownership, URL and assignment are preserved. Never infer a
reassignment from a customer query parameter.

The host must enforce customer ownership again on every server write. An
`ownerId` is not proof of authorization or an existing customer. Use database
referential integrity and a deletion policy that never leaves orphaned
projects. The showroom rejects customer deletion while projects remain. No
migrations or database entries are created by this plugin.

`ProjectFormValues` contains `name`, `status`, and `description`. Name is trimmed
and required; description is trimmed and limited to 5,000 characters. Empty
descriptions submit as empty strings; translate to database null in the host if
needed. Persisted website URLs retain the existing safe-link checks for display.

### Updating existing hosts

This narrows the form callback contract. Stop reading `url`, `ownerId` and
`assigneeId` from `onCreate` or `onSave` values. Remove `ProjectDirectoryProps` and
the former directory props, including `defaultOwnerId` and `lockOwner`, from form
page adapters. Supply ownership in the host create callback and preserve existing
metadata on update. Remove obsolete picker/field label overrides. No database
migration or stored-data deletion is part of this change.

Drafts survive same-project rerenders and failed saves. Switching project ID
resets the form. For creation, the host can change the page key when its customer
context changes. Leaving Details discards its draft.
To reload a form deliberately from refreshed server values, remount the page
with a host-controlled React key. Pending mutations disable form controls;
deletion requires confirmation and supports Escape/cancellation focus return.

## Showroom and validation

Visit `/en/projects`, `/en/projects/new`, `/en/projects/website`, and
`/en/projects/website/drive`. Enable **Projects integration** on the customer
preview to embed a real list. It is disabled initially to demonstrate the
independent customers plugin. Shared mock state survives client navigation
between both directories and resets on reload; passwords are never stored.

Controls simulate list loading/failures, mutation failures, action visibility,
and host Drive content. Standalone creation demonstrates a host-owned customer
selector; creation from Customers already has that context. The preview enforces
customer ownership in its callbacks. It has no real storage or services.

Run `pnpm test` and `pnpm test:browser` against a running showroom (override
`TEST_BASE_URL` when needed), plus the standard contributor checks. Verify a
local-registry shadcn install and consumer typecheck, and check that installing
customers alone does not install projects. TC migration remains a separate task.

## Action confirmations

Successful updates use the shared [action toast](./action-toast.md). Errors stay
with the form. The dependency installs automatically; wrap the persistent host
layout in `ActionToastProvider` to retain confirmations across navigation and
translate its Close label. Existing callback and label props are unchanged.

## Optimistic updates

See the [optimistic action contract](./optimistic-actions.md) for immediate UI
changes, rollback, server-confirmed operations and host callback requirements.
The plugin installs its TanStack Query dependency through `@forge/optimistic-action`.

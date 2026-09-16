# Projects

`@forge/projects` provides a project directory, an embeddable list, creation,
and Details/Drive pages. It installs source at `@components/plugins/projects`
and requires `@forge/customers`. Installing customers alone does not install
projects. Neither plugin contains backend or authentication code.

## Install and update

Configure the `@forge` namespace as described in [README](../README.md), then:

```bash
pnpm dlx shadcn@4.19.1 add @forge/projects
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

Both forms receive `customers`, optional `assignees`, each directory's
`Loading`/`Error` props (`customersLoading`, `customersError`, etc.), and optional
`createCustomerHref`. Supply the current owner and assignee in these directories,
including when loading an existing project. Owner is required; Assignee can be
cleared. Searchable selectors use supplied records with no built-in role rules.
A missing owner blocks submission; directory loading/errors cannot masquerade
as an empty successful result. With no customers, creation is disabled and the
form can link to customer creation.

Use `defaultOwnerId` plus `lockOwner` when creating from a customer. In editing,
`lockOwner` always locks the project's existing owner, ignoring `defaultOwnerId`.
Validate customer URL context against the project's current owner before
locking it or selecting the return URL. Global editing permits reassignment.

The host must enforce customer ownership again on every server write. An
`ownerId` is not proof of authorization or an existing customer. Use database
referential integrity and a deletion policy that never leaves orphaned
projects; the showroom rejects customer deletion until projects are reassigned
or deleted. No migrations or database entries are created by this plugin.

`ProjectFormValues` contains the six editable fields. Name is trimmed and
required; description is trimmed and limited to 5,000 characters. Website is
trimmed and limited to 2,048 characters: HTTP(S) URLs or local paths starting
with a single `/`. Unsafe schemes, protocol-relative URLs, backslashes,
whitespace, and credential-bearing URLs are rejected. Encode spaces in URLs.
Unsafe persisted URLs are not rendered as links either. Optional fields submit
as empty strings; translate those to database nulls in the host if needed.

Drafts survive same-project rerenders and failed saves. Switching project ID or
creation's default owner resets the form. Leaving Details discards its draft.
To reload a form deliberately from refreshed server values, remount the page
with a host-controlled React key. Pending mutations disable form controls;
deletion requires confirmation and supports Escape/cancellation focus return.

## Showroom and validation

Visit `/en/projects`, `/en/projects/new`, `/en/projects/website`, and
`/en/projects/website/drive`. Enable **Projects integration** on the customer
preview to embed a real list. It is disabled initially to demonstrate the
independent customers plugin. Shared mock state survives client navigation
between both directories and resets on reload; passwords are never stored.

Controls simulate directory loading/failures, absent owners, mutation failures,
action visibility, and host Drive content. The preview enforces customer
ownership in callbacks as well as forms. It has no real storage or services.

Run `pnpm test` and `pnpm test:browser` against a running showroom (override
`TEST_BASE_URL` when needed), plus the standard contributor checks. Verify a
local-registry shadcn install and consumer typecheck, and check that installing
customers alone does not install projects. TC migration remains a separate task.

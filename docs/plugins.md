# Forge plugins

A Forge plugin is an optional application feature installed as editable source
through `@forge`. It groups related pages/components, types, labels and host
integration contracts. Shared UI is a starting skeleton for website generation.
Site-specific fields and workflows belong in the consuming website. Project
forms, for example, edit only name, status and description; host adapters own
ownership and assignment.

A server companion implements persistence or server operations for the same
feature. Hosts own routing, authorization, data, branding,
translations and transport; installation does not enable routes or apply migrations.

The shared [Plugins specification](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/plugins/spec.md)
defines each feature and its boundaries. The [registry manifest](../registry/registry.json)
is authoritative for files and dependencies.

| Plugin         | Purpose                                                                                                                             | Optional server item   | Guide                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| `auth`         | Sign-in/out, recovery, password changes and access-denied UI                                                                        | Host auth provider     | [Auth](./intranet-auth.md)                  |
| `employees`    | Admin-only employee accounts, editing, verification and host-supplied website visibility                                            | `employees-server`     | [Employees](./intranet-auth.md#employee-ui) |
| `customers`    | Customer contact/company records, editable verification badges and composition of Projects/Sync                                     | Host callbacks         | [Customers](./customers.md)                 |
| `projects`     | Basic project forms, editable status badges, host-owned customer relationships and Details/Drive views                              | Host callbacks         | [Projects](./projects.md)                   |
| `drive`        | Scoped file browser, breadcrumb navigation, host-owned space renaming, uploads/downloads and opt-in trash/restoration               | `drive-storage`        | [Drive](./drive.md)                         |
| `blogs`        | Multilingual Markdown articles, publishing, categories, automatic public search and confirmed post deletion                         | `blogs-storage`        | [Blogs](./blogs.md)                         |
| `menus`        | Restaurant menus, draggable order with previews, sizes, translations, images, editable label icons, spice levels and A4/A5 printing | `menus-storage`        | [Menus](./menus.md)                         |
| `reservations` | Appointments or overnight stays, policies and calendars                                                                             | `reservations-storage` | [Reservations](./reservations.md)           |

Drive uses the shared [subpage sidebar](./subpage-sidebar.md) for All files, an
expandable folder tree and optional Trash. The tree uses the existing scoped
client reads; navigation does not grant access or change storage semantics.

## Shared presentation

Plugins follow the [Shared UI contract](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/shared-ui/spec.md).
Primary detail statuses sit at the top right, opposite the title; table statuses
stay in their columns. Enabled controls ship pointer cursors, disabled controls
retain disabled behavior, and adjacent actions keep visible gaps. Refresh,
settings, create, edit and delete use the shared Lucide conventions. Icon-only
buttons and action links use [`@forge/icon-tooltip`](./icon-tooltip.md) with their
translated accessible names, including edit/delete and close controls. Existing
confirmations, disabled states and visible action labels remain in place.

Customer, Project, Employee, Blog, Menu and Drive tables share header styling
and right-aligned row actions with 8px gaps. Action buttons stay on one line;
columns stay pinned on desktop and scroll with the row on mobile so they do not
cover record names or statuses. Menus exposes `labels.actions` for its action
column heading. The reservation year grid shares table typography and header
spacing while retaining its date cells, sticky month labels and keyboard navigation.

Paginated plugin tables share [`@forge/table-pagination`](./table-pagination.md).
Blogs and Employees supply totals and page numbers. Drive shows the current page
and uses Previous/Next with cursor history, without inventing totals. Customers,
Projects and Menus render their supplied lists without pagination. Reservations
uses calendar navigation. Labels and data callbacks stay host-owned.

Table headers and their surrounding panels stay visible during loading, empty
results and errors. Feedback belongs in a spanning table row; background loading
retains supplied rows, announces progress and disables mutations and pagination.
Hosts using controlled lists must keep their last loaded rows while fetching.
Employee tables still render nothing without an authenticated admin role.

Customer verification and project lifecycle badges open an accessible status menu
when the host supplies the corresponding mutation callback. Project details can
also use their existing save callback. Other statuses remain informational.

Single-choice form dropdowns share `@forge/native-select`, which keeps a 12px chevron inset
and reserves space between the selected text and arrow. Its native control preserves
keyboard selection, labels, validation and disabled states. The dependency ships
with affected plugins; see the [native select guide](./native-select.md).

Create/edit modal forms support Cmd+Enter on macOS and Ctrl+Enter on Windows/Linux.
The shortcut activates the existing submit button, preserving validation, disabled
states and failure handling. It stays inside the active dialog and does not add
a shortcut to destructive confirmations or standalone page forms. The
`@forge/dialog-submit` utility ships with Drive, Employees, Menus and Reservations;
their existing showroom examples demonstrate it.

Default action and field labels use sentence case, such as **Create customer**
and **Save changes**. Employee account actions use **employee** consistently.
Success messages name the completed action without an added “successfully”.
Brief save, update and action confirmations use fixed, dismissible
[`@forge/action-toast`](./action-toast.md) notifications. Validation errors and
persistent instructions remain beside their controls. Plugin entrypoints provide
a queue automatically; a host-level provider preserves it across navigation.
Drive retains its upload and recovery toasts.
Hosts can still override labels through the existing props.

Administrative form fields and text buttons use a 40px minimum height with lg
corners. Existing icon actions retain their compact hit areas. Customer, project,
blog and Drive panels follow the table panels' xl corners and 24px padding.
Authentication and public signup forms retain larger controls for their context.
These styles ship in each item's existing files and require no new dependency.

Hosts must supply all semantic status background/foreground pairs and Tailwind
mappings described in [Design tokens](../CONTRIBUTING.md#design-tokens), including
`status-success`, `status-pending`, `status-not-started`, `status-canceled` and
`status-info`. The showroom's stylesheet is not installed with a plugin.

| Plugin state                                                   | Semantic status                                 |
| -------------------------------------------------------------- | ----------------------------------------------- |
| Project requested / prospect / under construction / production | Not started / informational / pending / success |
| Customer or employee verified / unverified                     | Success / pending                               |
| Employee active                                                | Success                                         |
| Employee visible / hidden on website                           | Success / not started                           |
| Employee or customer disabled                                  | Canceled                                        |
| Blog published / unpublished changes / draft                   | Success / pending / not started                 |
| Menu visible / hidden, available / sold out                    | Success / not started, success / pending        |
| Reservation confirmed / pending / rejected or cancelled        | Success / pending / canceled                    |

Errors retain destructive tokens. Status badges keep readable translated text,
so meaning does not depend on color. Theme values remain host-owned.

Standalone item editors (Blogs, Menus, Customers and Projects) share
`@forge/editor-form`. Save/publish actions stick to the bottom of the viewport
within their form, wrap on narrow screens and respect the device safe area.
Submission scrolls and focuses the first invalid field, with destructive styling
and an associated inline message. Editing clears that field’s message; the next
submission checks the remaining fields. Translation errors reveal the applicable
language. Client feedback supplements existing server validation and keeps drafts.
Blog publication requirements appear only beside fields after a publish attempt;
incomplete drafts remain saveable. Hosts can reuse the helper for their own editors.

## Optimistic actions

Plugins use TanStack Query mutations through [`@forge/optimistic-action`](./optimistic-actions.md).
Predictable changes appear before the request completes and revert on rejection.
Forms retain drafts, confirmations retain recovery controls, and success toasts wait
for server confirmation. Hosts keep their existing data and transport callbacks.

## Updates

Install only the required items, keep adapters outside managed files, and review
the generated source diff. A companion may install its parent's UI and declared
feature dependencies; it still needs explicit server setup. Each guide describes
those dependencies and any migrations. Validate the host's themes, permissions,
locale routing and workflows before deploying an updated consumer.

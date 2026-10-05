# Forge plugins

A Forge plugin is an optional application feature installed as editable source
through `@forge`. It groups related pages/components, types, labels and host
integration contracts. A server companion implements persistence or server
operations for the same feature. Hosts own routing, authorization, data, branding,
translations and transport; installation does not enable routes or apply migrations.

The shared [Plugins specification](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/plugins/spec.md)
defines each feature and its boundaries. The [registry manifest](../registry/registry.json)
is authoritative for files and dependencies.

| Plugin         | Purpose                                                                                               | Optional server item   | Guide                                       |
| -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| `auth`         | Sign-in/out, recovery, password changes and access-denied UI                                          | Host auth provider     | [Auth](./intranet-auth.md)                  |
| `employees`    | Admin-only employee accounts, editing and verification                                                | `employees-server`     | [Employees](./intranet-auth.md#employee-ui) |
| `customers`    | Customer contact/company records and composition of Projects/Sync                                     | Host callbacks         | [Customers](./customers.md)                 |
| `projects`     | Customer-owned project records, assignment and Details/Drive views                                    | Host callbacks         | [Projects](./projects.md)                   |
| `drive`        | Scoped file spaces, folders, upload/download and file management                                      | `drive-storage`        | [Drive](./drive.md)                         |
| `blogs`        | Multilingual Markdown articles, publishing and categories                                             | `blogs-storage`        | [Blogs](./blogs.md)                         |
| `menus`        | Restaurant menus, draggable order, sizes, translations, images, editable label icons and spice levels | `menus-storage`        | [Menus](./menus.md)                         |
| `reservations` | Appointments or overnight stays, policies and calendars                                               | `reservations-storage` | [Reservations](./reservations.md)           |

## Shared presentation

Plugins follow the [Shared UI contract](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/shared-ui/spec.md).
Primary detail statuses sit at the top right, opposite the title; table statuses
stay in their columns. Enabled controls ship pointer cursors, disabled controls
retain disabled behavior, and adjacent actions keep visible gaps. Refresh,
settings, create, edit and delete use the shared Lucide conventions.

Hosts must supply all semantic status background/foreground pairs and Tailwind
mappings described in [Design tokens](../CONTRIBUTING.md#design-tokens), including
`status-success`, `status-pending`, `status-not-started`, `status-canceled` and
`status-info`. The showroom's stylesheet is not installed with a plugin.

| Plugin state                                                   | Semantic status                                 |
| -------------------------------------------------------------- | ----------------------------------------------- |
| Project requested / prospect / under construction / production | Not started / informational / pending / success |
| Customer or employee verified / unverified                     | Success / pending                               |
| Employee active                                                | Success                                         |
| Employee or customer disabled                                  | Canceled                                        |
| Blog published / unpublished changes / draft                   | Success / pending / not started                 |
| Menu visible / hidden, available / sold out                    | Success / not started, success / pending        |
| Reservation confirmed / pending / rejected or cancelled        | Success / pending / canceled                    |

Errors retain destructive tokens. Status badges keep readable translated text,
so meaning does not depend on color. Theme values remain host-owned.

## Updates

Install only the required items, keep adapters outside managed files, and review
the generated source diff. A companion may install its parent's UI and declared
feature dependencies; it still needs explicit server setup. Each guide describes
those dependencies and any migrations. Validate the host's themes, permissions,
locale routing and workflows before deploying an updated consumer.

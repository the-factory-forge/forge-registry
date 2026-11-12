# Forge connectors

A **connector** is optional editable source that makes a specific pair of
capabilities work together: a Forge plugin and another plugin, library or
external service. An **adapter** implements one of the connector's interfaces
for its provider or host. Connectors install through `@forge`, like plugins;
there is no runtime loader or universal synchronization protocol.

| Item                                         | Connects                            | Example                                                                  | Guide                         |
| -------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ----------------------------- |
| `customers-bexio`                            | Customers and the Bexio contact API | [Showcase](https://registry.the-corner.swiss/connectors/customers-bexio) | [Setup](./customers-bexio.md) |
| `projects-drive`                             | Projects and Forge Drive            | [Showcase](https://registry.the-corner.swiss/connectors/projects-drive)  | [Setup](./projects-drive.md)  |
| `supports-github` / `supports-github-server` | Supports and private GitHub issues  | [Showcase](https://registry.the-corner.swiss/connectors/supports-github) | [Setup](./supports-github.md) |

Install only the relationship needed by a website. The connector declares both
its own files and the existing items it uses. Base plugins do not acquire a
reverse dependency. Browser source lives at `@components/connectors/{name}`;
server operations use a separate `server` entrypoint and companion item.

The connector owns reusable mapping, composition and its shipped persistence
guarantees. Customers–Bexio includes unique link storage and transactional account
provisioning. The host owns credentials, sessions, routes, authorization, database
configuration, migrations and business policies.
Keep host adapters outside registry-managed files. Installation does not activate
connections, grant permissions or migrate deployed data. A folder scope or hidden
button never grants access.

The showroom's **Connector** category and search list the three examples. Their
**Adapters and installation** sections identify each interface and its role.
Browser-only in-memory adapters demonstrate actions, read-only behavior and
repeatable failures; they do not implement production authorization or access
live Bexio/GitHub/S3 services. Demo controls remain showroom code.

These connectors add no template configuration or shared host contract. Their
behavior and specification belong to this repository. They do not change the
existing TC Bexio installation or any deployed project's storage.

## Agents connectors

The seven `agents-{plugin}-server` items connect Agents to existing Blogs,
Employees, Customers, Projects, Drive, Menus and Reservations services. They are
server-only relationships, documented with the [Agents plugin](./agents.md), and
share its showroom rather than adding seven independent UI demos. Install only
the relationships used by the host; the base plugins do not depend on Agents.

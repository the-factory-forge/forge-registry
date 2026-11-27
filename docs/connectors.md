# Forge connectors

A **connector** is optional editable source that makes a specific pair of
capabilities work together: a Forge plugin and another plugin, library or
external service. An **adapter** implements one of the connector's interfaces
for its provider or host. Connectors install through `@forge`, like plugins;
there is no runtime loader or universal synchronization protocol.

| Item                                         | Connects                                 | Example                                                                  | Guide                            |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `customers-bexio`                            | Customers and the Bexio contact API      | [Showcase](https://registry.the-corner.swiss/connectors/customers-bexio) | [Setup](./customers-bexio.md)    |
| `offers-products`                            | Offers and Products                      | [Showcase](/connectors/offers-products)                                  | [Setup](./offers.md)             |
| `offers-mailing`                             | Offers and Mailing                       | [Showcase](/connectors/offers-mailing)                                   | [Setup](./offers.md)             |
| `projects-drive`                             | Projects and Forge Drive                 | [Showcase](https://registry.the-corner.swiss/connectors/projects-drive)  | [Setup](./projects-drive.md)     |
| `supports-github` / `supports-github-server` | Supports and private GitHub issues       | [Showcase](https://registry.the-corner.swiss/connectors/supports-github) | [Setup](./supports-github.md)    |
| `agents-webmcp` / `agents-webmcp-server`     | Browser assistants and Agents operations | Installed plugin admin previews                                          | [Setup and testing](./webmcp.md) |

WebMCP is a site-wide browser integration, packaged as an optional connector to
Agents operations. Hosts can mount its browser adapter once in the authenticated
layout to expose the installed operations permitted for the current user. Its
packaging does not require a separate showroom card for each plugin.

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

The showroom's **Connector** category and search list Customers–Bexio,
Projects–Drive and Supports–GitHub. WebMCP has no standalone catalog entry;
its tools are demonstrated inside supported plugin admin previews. The three
listed examples' **Adapters and installation** sections identify each interface
and its role.
Browser-only in-memory adapters demonstrate actions, read-only behavior and
repeatable failures; they do not implement production authorization or access
live Bexio/GitHub/S3 services. Demo controls remain showroom code.

The connectors' reusable behavior belongs to this repository. WebMCP also follows
Forge Specs' shared agent-access guarantees; its [guide](./webmcp.md) describes
the host integration. Installation changes no Template configuration, existing
TC Bexio connection or deployed project's storage.

## Agents connectors

The eight `agents-{plugin}-server` items connect Agents to existing Blogs,
Employees, Customers, Projects, Drive, Menus, Reservations and Supports services.
`agents-conversations-server` separately exposes the current user's private
conversation tools to MCP and WebMCP. These server-only relationships are
documented with the [Agents plugin](./agents.md) and share its showroom. Install
only the relationships used by the host; the base plugins do not depend on Agents.

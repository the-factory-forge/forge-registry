# WebMCP

`agents-webmcp` exposes a signed-in page's explicit context and existing Agents
operations to a compatible browser assistant. `agents-webmcp-server` reuses the
durable Agents executor without a model provider. Remote MCP remains a separate
entry point for assistants outside the browser.

## Browser setup

Enable `chrome://flags/#enable-webmcp-testing` in a supported Chrome and relaunch.
WebMCP requires HTTPS or localhost. The ordinary page remains usable without it.
The tools are mounted in the plugin previews below; there is no separate WebMCP
showroom page or marketplace entry. Template adoption is still required before
new Forge websites receive this integration automatically.

Use the [current native API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
when changing browser registration. This implementation uses
`document.modelContext.registerTool` with abort-scoped registration.

## Test the plugin previews without AI

In Chrome DevTools, open **Application → WebMCP → Available Tools**, select a
tool, enter its arguments and click **Run tool**. **Invoked Tools** shows its input,
output and status. This [native panel](https://developer.chrome.com/docs/devtools/application/webmcp)
needs no extension or AI key. The inspector extension remains an alternative
when the browser does not provide this panel.
`website_context` reports the current page and selected record; Drive also reports
its folder and selection. The preview controls stay available in the sidebar.

| Plugin       | Preview path                | Start with                                           |
| ------------ | --------------------------- | ---------------------------------------------------- |
| Blogs        | `/en/admin/blogs`           | `blogs_list` with `{"locale":"en"}`                  |
| Customers    | `/en/customers`             | `customers_list` with `{}`                           |
| Employees    | `/en/employees`             | `employees_list` with `{}`                           |
| Projects     | `/en/projects`              | `projects_list` with `{"ownerId":"acme","query":{}}` |
| Drive        | `/en/drive/project/website` | `drive_list_spaces` with `{}`                        |
| Menus        | `/en/admin/menus`           | `menus_list_cards` with `{}`                         |
| Reservations | `/en/admin/reservations`    | `reservations_configuration` with `{}`               |
| Supports     | `/en/intranet/supports`     | `supports_list` with `{}`                            |
| Agents       | `/en/agents`                | `conversations_operations` with `{}`                 |

For Blogs, start with `{"locale":"en","page":1,"pageSize":12}` and omit optional
filters. If a generated input includes a sample `search` value such as `"string"`,
remove it. `items: []` with `total: 0` means no matching records; compare the
invocation's exact input and the preview's sample state before treating it as an
integration failure.

For a first write, open Blogs and call `blogs_create`:

```json
{ "input": { "title": "WebMCP review", "locale": "en" }, "requestId": "blogs-review-1" }
```

Reject the proposal: no article appears. Repeat with a new request ID and approve:
the article appears in the list. Read again to verify it. The inspector's schema
lists the required arguments for each tool; writes wrap them in `input` and use a
unique `requestId`. Repeating the same ID returns its recorded outcome.

Tools include creation, deletion and business actions, not only reads and updates.
For example, Blogs exposes publication and history; Drive exposes folders,
duplication and trash. The installed connector and host adapters determine the
actual catalog. Do not infer complete UI parity from a successful sample call.
The tool descriptions, argument schemas and `website_context` explain these
actions to the browser assistant. Repository `AGENTS.md` files guide contributors;
WebMCP does not automatically load them. Keep runtime guidance with the operation
and tool definitions rather than maintaining a second plugin manual.

These previews reuse the distributed business connectors and common executor.
Their clients modify sample records only. Customers, Projects and Drive share a
preview workspace. Other plugins keep their existing demo stores. Page reloads
reset these samples, except Agents conversations kept in browser-session storage.
No provider is called, email sent, or customer account accessed. Optional tools
require their corresponding host adapter; discovery does not grant permission.

## Test remote MCP from Agents Settings

The public showroom displays both Settings tabs with an interactive simulation.
Its example URL and one-hour `demo_` tokens cannot connect an external client.
For a real local MCP test, use the development fixture below.

1. Run `pnpm dev` for Registry, then
   `SHOWROOM_ORIGIN=https://forge-registry.localhost pnpm demo:mcp` in another terminal.
   Use the exact origin printed by Portless if your configuration changes it.
2. Open `/en/agents`, then **Settings → External assistant**.
3. Create a temporary key. Supply the URL and key in your local client's MCP connection settings.
4. Test `blogs_list`, then create, update and delete your own disposable article.
   Revoke the key when finished.

This real connection is development-only. It uses the actual MCP handler, Blogs connector
and review engine with disposable server-side records, separate from browser
previews. The key expires after one hour. Creating another key invalidates the
previous one immediately; closing Settings clears the displayed secret.
Restarting the server clears keys and sample data. No model provider is contacted.
Management requests require the exact configured local showroom origin. MCP
requests require the current Bearer token and remain restricted to sample Blogs.
The server listens only on loopback; another computer or a cloud assistant cannot
reach this URL. This is not the customer account/OAuth flow.

`SHOWROOM_ORIGIN` accepts HTTP or HTTPS origins on `localhost`, `127.0.0.1` or a
`.localhost` domain; management still requires that exact origin. For direct HTTP
tests, the default showroom origin is `http://127.0.0.1:3218`. The MCP server uses
port 3222 by default; set its `PORT` and Registry's `VITE_MCP_DEMO_URL` together
when changing it. Never publish or tunnel this disposable key-management fixture.

A standard client such as the [reference MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
can connect with **Streamable HTTP**, the displayed URL and Bearer token.
Each mutation returns a pending proposal; review its full `preview`, then send
`agents_execute` with its `proposalId` and that unchanged preview as `review`.
Use `agents_reject` to reject it. Repeat `blogs_get` or `blogs_list` to verify.
The copied prompt covers creation, title/content changes and deletion of only the
new test article. `blogs_list` reads a collection; `blogs_get` reads one article
by ID. Both belong to the same Blogs plugin.

After deletion, `blogs_get` returns `isError: true` with the text `NOT_FOUND`.
Check `isError` before parsing a successful result as JSON. MCP text content can
also be plain text, as described in the [tool result contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-result).

For Codex CLI, the locally verified command accepts a token environment variable:

```sh
codex mcp add forge-registry-demo --url http://127.0.0.1:3222/mcp --bearer-token-env-var FORGE_REGISTRY_DEMO_KEY
```

Set that variable in the environment of the client you launch; this command alone
does not supply a key to an already running desktop app. Alternatively, give the
local agent the endpoint and temporary key for a direct protocol test.

MCP and WebMCP expose uploads when the host supplies private attachment storage.
Inline staging is capped at 512 KiB. The Drive connector also exposes
`drive_read_file` when the host supplies its authorized `readFile` adapter.
Download metadata alone does not provide file bytes.

## Install and wire the host

```sh
pnpm dlx shadcn add @forge/agents-webmcp @forge/agents-webmcp-server
```

Install the required `agents-{plugin}-server` business connectors separately.
The host supplies the same store, service adapters and private attachment storage
as [Agents](./agents.md). No new WebMCP database schema or AI-provider secret is
needed; an older Agents installation still needs its documented migrations.

```ts
import { createAgentsWebMcp } from "@/components/connectors/agents-webmcp/server";

const webmcp = createAgentsWebMcp({
  store,
  operations, // Explicit installed operations, using the host's existing services.
  attachments: privateAgentObjects, // Optional; absent storage hides file uploads.
  actor: async (context) => {
    const session = await resolveFreshSession(context);
    return session
      ? { id: session.user.id, connection: { id: session.id, clientId: "webmcp" } }
      : null;
  },
});
// Authenticated host endpoints delegate to webmcp.client(trustedContext).
```

Expose the typed `catalog`, `call`, `proposal` and `decide` methods through the
host's authenticated transport. Resolve the session afresh on every request;
never accept an owner or session ID from tool arguments. Keep responses private
with `Cache-Control: no-store`; apply the host's origin/CSRF checks, request limits
and rate limits. Map server failures to `AgentsError` codes. Pass cancellation to
reads/proposals, but allow an approved write to record its outcome.

```tsx
<AgentsWebMcp
  key={session.id}
  client={stableAuthenticatedClient}
  contextKey={`${page.id}:${permissionsRevision}`}
  getContext={() => ({ page: page.id, recordId: selectedRecordId })}
  onChange={() => refreshPluginData()}
/>
```

Mount once inside the authenticated layout and unmount on logout. Keep `client`
stable; replace it when its identity changes. The host chooses the safe context
fields: current page, record, folder and selection. Do not return credentials,
arbitrary DOM/form contents or hidden records. `getContext` is read anew on each
call; changing `contextKey` replaces tools and cancels unapproved reviews.
Drive's optional `onViewChange` and `refreshVersion` props support this wiring.

The connector does not infer actions from HTML. It registers installed operation
tools and their schemas, plus `website_context` and `webmcp_proposal`. Optional
per-tool `authorize` checks narrow operation permissions during discovery and
execution. Account-security actions stay in the host's Security interface.

Writes open the shared visible review and execute only the stored input after
fresh permission and snapshot checks. Retries return the recorded outcome;
unknown outcomes need trusted reconciliation. Navigation can cancel an unapproved
request, but cannot undo an approved write. A host must keep `decide` under the
same authenticated transport protections as its ordinary UI actions.

## Files and acceptance boundaries

With private storage and an authorized upload operation, `webmcp_stage_file`
stages a nonempty file up to 512 KiB. The upload tool's description supplies its
`operationId`; repeat a `requestId` only for identical bytes and metadata. The
subsequent plugin upload still requires its own visible review. Staged files are
bound to the user and browser session and checked for integrity before use.

The supplied Drizzle store reclaims abandoned staging older than 24 hours on the
owner's next upload. Custom stores can implement `expiredStaging` or provide
their own cleanup; existing stores remain compatible. Account deletion must call
the existing `removeOwner` cleanup. Larger deposits use the normal plugin UI.
Downloads retain the registered business tool's behavior: installing this
connector alone does not turn a metadata-only download tool into a byte transfer.

Source evidence: the SiniGest pilot at `e71ae67`. The portable server tests cover
session isolation, authorization changes, reviewed writes, retries and staged
bytes. Native Chromium browser tests cover discovery, context, approval/rejection,
navigation and the unavailable-API fallback. A real assistant, provider and
production deployment remain separate acceptance checks.

Local verification on 2026-11-20: 198 unit tests, eight existing Agents browser
tests, two native WebMCP browser tests and the PostgreSQL/S3 persistence test
pass. Formatting, lint, types, registry generation and the showroom build pass;
the bundler reports its existing dependency `use client` warnings. A real shadcn
4.22.1 installation of both items into a disposable consumer passes strict
TypeScript. Desktop/light and mobile/dark reviews were inspected.
The Vite-only host fixture in `tests/drive-context.browser.mjs` also verifies
selection reporting into React state, external refresh and unmount cleanup.

The existing embedded Drive-in-Menus browser test times out waiting for its table
on both this branch and unchanged `main` at `92087ac`. This promotion does not fix
that separate preview failure.
The Drive loading-state test also failed once in the full run, then passed in
isolation on both revisions. Keep that timing-sensitive result visible when
reviewing the full suite; it is not an all-green browser run.

Local verification on 2026-11-24: all nine plugin journeys pass native tool
discovery, reads and reviewed changes. The targeted browser suite also checks
Drive uploads, public routes, unavailable WebMCP and preserved Agents drafts.
205 unit tests, format/lint/types, generated distribution and build pass.
An official shadcn consumer install passes TypeScript. The reference MCP Inspector
CLI discovers tools, prepares and approves a Blogs creation, then reads it back.
No real model/provider or customer website was used.

Review corrections on 2026-11-24: eight delayed-response cases cover approval and
rejection, success and failure, and context/client replacement. Upload reviews
show stored file identity and destination before approval; chat previews remain
compatible. The 31 targeted browser checks, 205 unit tests, code checks, build and
updated shadcn consumer installation pass. This does not cover SiniGest adoption,
CI execution or real-assistant acceptance.

Temporary-key demo verification on 2026-11-24: a key created in Agents Settings
passes remote MCP discovery, read, reviewed creation, title/content update and
deletion. Existing articles remain unchanged. Rotation, expiry and revocation
reject the old key; browser storage contains no key. All 206 unit tests and 30
targeted browser tests pass, with format/lint/types, build and a shadcn consumer
installation. Desktop and mobile were inspected. The production build omits the
temporary-key panel. A real local assistant remains a separate acceptance check.

## Local adoption check — 25 November 2026

The reusable source through `53d81487c71ceba6c0da59bd08150f2f00bd99cc` is adopted
on local Template and SiniGest branches. This includes remote private-file staging,
Drive byte reads, shared WebMCP and reviewed Support priority changes. The temporary
prompt/test-record blocks were removed from showroom Settings; local MCP URL/key
controls remain. WebMCP remains absent from marketplace Connector listings.

Registry checks pass: 215 unit tests, generated distribution, formatting/types,
Structures (seven rules), production build, clean shadcn installation and consumer
TypeScript. The 22 targeted browser scenarios cover native tools across the nine
plugin previews and the temporary-key MCP Blogs cycle. The later Support priority
addition is covered by its unit test and Template's native/remote host test.

Template verifies OAuth, personal keys, Employees and Support, including private
image bytes and a French approval/rejection dialog. SiniGest verifies those access
paths for its installed Employees, Customers, Drive, Profile and Agents operations.
See each site's `docs/registry-sync.md` for exact source, migrations and checks.
No provider keys, real customer data, publication or deployment were used. Actual
assistant-app acceptance and HTTPS production storage remain separate checks.

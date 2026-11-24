# WebMCP

`agents-webmcp` exposes a signed-in page's explicit context and existing Agents
operations to a compatible browser assistant. `agents-webmcp-server` reuses the
durable Agents executor without a model provider. Remote MCP remains a separate
entry point for assistants outside the browser.

## Try the example

WebMCP is planned as a shared website capability, so its demo is absent from the
marketplace catalog and search. The direct URL below remains available for review;
automatic host installation still requires Template adoption.

1. Start Registry with `PORTLESS=0 pnpm dev --host 127.0.0.1 --port 3218`.
2. In Chrome, enable `chrome://flags/#enable-webmcp-testing` and relaunch.
3. Open `http://127.0.0.1:3218/connectors/agents-webmcp`.
4. Use **Read page context** and **Read sample record**. Both should match the
   selection and saved name. Switch the selected record and compare again.
5. Enter a different name and **Propose sample change**. Reject it: the saved
   name stays unchanged. Propose again and approve: the saved name changes.
6. Use **Read last decision** to check `rejected` or `succeeded`. This also works
   for a proposal made by an external assistant while the page stays open.

The buttons call native `document.modelContext`, using fictional browser-session
records. No AI subscription or provider key is needed. They verify the website's
tools, not an assistant's ability to plan a task. For a conversational test, use
the inspector/assistant extensions described in the
[Chrome guide](https://developer.chrome.com/docs/ai/webmcp). Ask the assistant to
read the selected record, propose a new name and wait for the site's approval.
Record the browser and assistant versions separately from native API results.

The business previews below also mount WebMCP. Public Blog, Menu and Reservation
pages expose no administration tools. The extension chat is separate from Forge's Agents chat. The page's
**Help & assistant prompt** section provides a prompt and recovery steps.
An inspector trace containing `parameter 1 is not of type 'Tool'` remains a failed
invocation even if its final AI response sounds successful. Repeated calls through
the installed inspector 1.9.21 content script passed in isolated Chrome 158.0.8127.38
checks; the reported live-extension failure has not been reproduced or resolved.
On 2026-11-24, the user's Inspector chat trace confirmed context and record reads,
followed by a successful rename reflected on the page. The model version was not
recorded. This validates that showroom journey, not other plugins or production.

WebMCP is experimental and requires a supported browser and a secure context
(HTTPS or localhost). An unavailable API leaves the ordinary page usable. See
the [current imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
before changing the native boundary; this implementation uses
`document.modelContext.registerTool` and abort-scoped registration.

## Test the plugin previews without AI

Keep the inspector open, select a tool, enter its JSON arguments, then execute.
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

For a first write, open Blogs and call `blogs_create`:

```json
{ "input": { "title": "WebMCP review", "locale": "en" }, "requestId": "blogs-review-1" }
```

Reject the proposal: no article appears. Repeat with a new request ID and approve:
the article appears in the list. Read again to verify it. The inspector's schema
lists the required arguments for each tool; writes wrap them in `input` and use a
unique `requestId`. Repeating the same ID returns its recorded outcome.

These previews reuse the distributed business connectors and common executor.
Their clients modify sample records only. Customers, Projects and Drive share a
preview workspace. Other plugins keep their existing demo stores. Page reloads
reset these samples, except Agents conversations kept in browser-session storage.
No provider is called, email sent, or customer account accessed. Optional tools
require their corresponding host adapter; discovery does not grant permission.

## Test remote MCP separately

Run `pnpm demo:mcp` in Registry. It prints a local `/mcp` URL and a temporary
Bearer token. Open the [reference MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
with `npx @modelcontextprotocol/inspector`, using a Node version supported by its
current documentation. Select **Streamable HTTP**, enter the printed URL and
Bearer token, then connect and list tools. No model key is needed.

1. Call `blogs_list` with `{"locale":"en"}`.
2. Call `blogs_create` with the JSON above. It returns a pending proposal.
3. Inspect the complete `preview`. Call `agents_execute` with its `proposalId`
   and that unchanged `preview` as `review`, or `agents_reject` to reject it.
4. Call `blogs_list` again to verify the result.

This local fixture uses the actual MCP handler, Blogs connector and review engine.
Its sample data is separate from browser tabs and resets on restart. It listens
only on loopback and is not a production endpoint. Remote MCP currently excludes
attachment-dependent tools; native WebMCP supports small staged uploads. Neither
transport automatically turns download metadata into file bytes.

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

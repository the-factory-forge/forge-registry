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

Only this route mounts WebMCP in the showroom; other plugin previews expose no
WebMCP tools. The extension chat is separate from Forge's Agents chat. The page's
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

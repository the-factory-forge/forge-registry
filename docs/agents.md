# Agents

`@forge/agents` supplies an operation-first staff chat page. Conversations belong
to one user and one operation. `@forge/agents-server` supplies provider-independent
orchestration and PostgreSQL/Drizzle persistence. The host supplies fresh staff
sessions, transport and private object storage. It can supply its own model runtime
or use the optional website connection for OpenAI, Anthropic or DeepSeek.

[Try the deterministic showroom](https://registry.the-corner.swiss/en/agents).
Its browser-session mock is not production storage or authorization.

## Installation and composition

```sh
pnpm dlx shadcn@4.22.1 add @forge/agents @forge/agents-server @forge/agents-blogs-server
```

Install only the required connectors. Neither Agents item installs the
business plugins automatically. Connectors are server-only source; their
dependencies include the existing plugin contracts and service schemas.

| Connector                     | Factory                             | Host integration                                                                                                                                                   |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agents-blogs-server`         | `createBlogsAgentOperation`         | An authenticated `BlogsClient`, including history when enabled                                                                                                     |
| `agents-employees-server`     | `createEmployeesAgentOperation`     | A fresh admin employee service, authorized exact lookup, trusted invitation/verification URLs; optional deletion-retention, photo and website-publication adapters |
| `agents-customers-server`     | `createCustomersAgentOperation`     | The existing Customers service client                                                                                                                              |
| `agents-projects-server`      | `createProjectsAgentOperation`      | The existing Projects service client; customer ownership remains required                                                                                          |
| `agents-drive-server`         | `createDriveAgentOperation`         | The scoped Drive client and authorized exact entry lookup; optional space-name adapters                                                                            |
| `agents-menus-server`         | `createMenusAgentOperation`         | The Menus client; optional composed-menu client and image upload through the existing menu-item Drive scope                                                        |
| `agents-reservations-server`  | `createReservationsAgentOperation`  | The staff Reservations client and authorized exact lookup without management secrets                                                                               |
| `agents-supports-server`      | `createSupportsAgentOperation`      | The staff Supports client, retaining ticket visibility and attachment ownership                                                                                    |
| `agents-conversations-server` | `createAgentConversationsOperation` | The current user's Agents client and a required target-operation permission/scope check                                                                            |

Each factory takes `client(context)` and `authorize(context)`. Resolve current
permissions in these callbacks; a cached role or a browser capability is not
authority. Employee access remains admin-only. Plugin services retain their
existing input validation, self-deletion protection, identity transactions,
versions, publication rules, deletion previews and failure recovery. Optional
media, trash, history and host-specific actions require their existing adapters.

```ts
// Host server module. db, runtime, blogs and resolveStaff are host-owned.
const agents = createAgentsService({
  store: createAgentsStore(db),
  runtime,
  actor: resolveStaff, // fresh staff session, or null
  operations: [
    createBlogsAgentOperation({
      authorize: canReadBlogs,
      client: (context) => blogs.client(context),
    }),
  ],
  attachments: privateAgentObjects,
});

// Inside an authenticated host request:
const client = agents.client(requestContext);
```

Export `agentsConversations` and `agentsAttachments` from the host's composed
Drizzle schema. Generate, review and apply an additive migration through that
project's existing journal. Installation never applies migrations. Conversations
store structured messages and approval records in JSONB; uploaded bytes never go
into PostgreSQL. The store locks each conversation row for state transitions and
does not hold a transaction open while calling a model or business service.

## Runtime and transport

Implement `AgentRuntime.stream({ instructions, messages, tools, signal })` on the
server. It yields `{ type: "text", text }` and
`{ type: "tool", name, input }`. Each tool has a name, description and JSON input
schema. Map these to the chosen provider; do not give the provider direct mutation
callbacks. Runtime tool events may supply `callId`; otherwise the service creates
one. Saved tool messages include `tool: { callId, name, input }`, allowing the
adapter to reconstruct the matching assistant tool call and tool-result pair,
including after approval or rejection in a later request. Treat all record text, file
metadata and tool results as untrusted content. Provider credentials, context
budget, rate limits, request timeouts and model selection stay in the host.

`AgentsClient` is the browser's authenticated transport contract. Bind its
operations/list/create/get/remove/decide methods to host endpoints. Stream `send`
events over the host's streaming transport and forward cancellation. The service
accepts only user text, attachment references, a request ID, an optional interface locale and an optional resume
flag. It builds history from the database; submitted assistant/system messages or
replacement action arguments cannot establish authority. Keep provider errors
and credentials out of public responses.

Supply the selected page language as `locale` in each `send` request, including
continuations. The service validates the language tag and uses it as the default
for ambiguous greetings or test text. Clear user language or an explicit language
request takes precedence. Hosts should restrict the locale to their installed
languages and supply their site's default when older clients omit it.

`send` emits incremental text and an initial durable conversation. Always reload
`get` after completion, cancellation or failure to obtain final messages and
proposals. Use a fresh request ID for a deliberate retry; repeated IDs do not
start another turn. Set `resume: true`, empty text and no attachment IDs to
continue a failed/stopped turn or a completed approval without inventing a user
message. The page exposes this as Continue/Retry.

Keep `AgentsClient` identity stable while its authenticated scope is unchanged.
Keep the optional settings client stable too. Replacing either client clears drafts
and aborts old UI requests, including pending settings results. By default, changing
operation or chat aborts the departed stream; late results cannot update the new view.

A host that keeps working during intranet navigation owns the generation outside
the selected chat view. Pass its snapshot through `AgentsPage.generation` with
`conversationId`, accumulated `text`, `running`, optional `error` and `stop()`.
The host drains `AgentsClient.send` independently; departing views detach without
aborting that owner. Pass `active={false}` when hiding a retained page so its
settings, crop and deletion dialogs close. Neither prop installs a background worker.
Reset the owner on sign-out/account changes, expose a return-to-chat link and
explicit Stop, and prevent concurrent sends while another generation is running.
Reloading or closing the tab can still interrupt this tab-owned work. Existing
stored approvals, permission checks and uncertain-write recovery remain required.

The saved model runtime supplies its configured provider and API model ID in
trusted instructions, without the key. It explains that installed tools reach
site data with current employee permissions, including on local hosts, while
screen access, unsaved forms and a general browser are not implied. Hosts may add
their site's name; API aliases do not establish an underlying model version.

## Administrator-managed model connection

Hosts may supply `AgentsPage.connectionSettings` to place their assistant access
controls in the same Settings dialog. The content and its authenticated transport
remain host-owned; model settings keep their existing administrator restriction.
Settings is available when either connection controls or a model-settings client
is supplied. With connection controls alone, the external-assistant tab remains
usable and the model tab is disabled with an administrator-only explanation.
The model form is not mounted and no model-settings request is made for that user.
Pressing the unavailable tab keeps the external-assistant tab selected and uses
the existing informational notification to explain that an administrator must
change the shared model. The same explanation remains visible below the tabs.
Registry uses this slot only in development for its [temporary MCP demo](./webmcp.md#test-remote-mcp-from-agents-settings).
It does not create production account keys or change the Auth plugin's Security UI.

Pass an `AgentsSettingsClient` as `AgentsPage.settings` only for website
administrators. The header Settings button opens a provider, API key and model
form. Following [VS Code’s bring-your-own-key flow](https://code.visualstudio.com/docs/agent-customization/language-models),
choose OpenAI, Anthropic or DeepSeek, enter the provider key, load its available
models, select one and Save. One active connection serves the website's staff;
this is not a per-user key collection. Existing chats keep their operations and
approval records. Saved settings are used on subsequent model requests.

`@forge/agents-server` exports `deriveModelEncryptionKey`, `createAgentsModelConnection`,
`createAgentsConnectionStore` and the additive `agentsModelConnection` table.
Compose that table into the host schema and generate/review its migration before
enabling settings. Each website must use its own database, as with the other
plugin tables. Derive the encryption key from the host's existing random server
secret with `deriveModelEncryptionKey`, using `BETTER_AUTH_SECRET` for Better Auth
hosts. This requires no additional environment variable or Better Auth dependency.
The helper requires at least 32 bytes and uses HKDF-SHA256 with the context
`forge/agents-model-connection/v1`. Keep the root secret stable and stored separately
from PostgreSQL. Replacing it requires re-entering the provider key or explicitly
re-encrypting the credentials first; conversations are not encrypted by this key.
Existing hosts may keep passing their separate 32-byte `encryptionKey`. Switching
from `AGENTS_ENCRYPTION_KEY` to derivation requires re-entering the provider key once;
removing that variable alone does not migrate existing ciphertext. Stored API keys
use AES-256-GCM, bound to the provider and model. They are never returned by settings
reads or stored in chat history.

```ts
// Server only: resolve fresh administrator access, never a browser role flag.
const connection = createAgentsModelConnection({
  store: createAgentsConnectionStore(db),
  encryptionKey: deriveModelEncryptionKey(env.BETTER_AUTH_SECRET),
  authorize: async (context) => (await resolveStaff(context))?.role === "admin",
});
const agents = createAgentsService({
  store: createAgentsStore(db),
  runtime: connection.runtime,
  actor: resolveStaff,
  operations,
  attachments: privateAgentObjects,
});

// Bind both clients to authenticated host endpoints; do not pass server objects
// or credentials into a browser bundle.
const chatServer = agents.client(requestContext);
const settingsServer = connection.client(requestContext);
```

Expose `get`, `models`, `save` and `remove` through the host's authenticated
settings transport. Use POST bodies for key submissions, retain CSRF protection,
redact request bodies from logs, and apply the host's quotas/rate limits. All four
methods recheck administrator access on the server, independently of button
visibility. Save verifies the key and selected model against the provider's model
list before replacing the saved connection. An omitted key keeps the current key
only when the provider is unchanged. Disconnect deletes the connection without
removing chats. Failed requests preserve the previous configuration and return
sanitized errors. Settings reads return only provider and model.

The supplied runtime calls fixed provider endpoints on the server, streams text,
and reconstructs tool-call/result history through the existing Agents service.
It never invokes mutation tools directly: individual approvals remain required.
Models are discovered from the account rather than a hardcoded catalog; select a
text model supporting tool calls. Model listing does not certify that every listed
model supports this protocol. Unsupported models or exhausted provider accounts
produce a retryable chat error. Provider calls have a 90-second timeout; model
listing has a 15-second timeout. DeepSeek thinking is disabled because this
baseline history does not persist reasoning blocks. Files retain the existing
metadata-only model contract; image inference is not added.

The adapters use [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[Anthropic Messages streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
and [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).
Hosts may continue supplying a custom `AgentRuntime` instead. Adoption does not
configure hosting secrets, apply migrations, publish routes or deploy a website.

The showroom accepts only the literal sample key `demo` and persists only sample
provider/model metadata in browser-session storage. Its next scripted response
names that sample model; it never calls providers or saves real API keys.
Failed sample requests explain the demo key and simulated-failure controls while
preserving the saved sample connection.

Both Settings tabs remain visible in the public showroom. **Model settings**
demonstrates the shared intranet connection. **External assistant** simulates
creating, copying, replacing, expiring and revoking a one-hour token. Its example
URL and `demo_` token do not authenticate a real MCP client. Only the expiry is
stored in the browser session; closing the dialog clears the displayed token.
The development-only [local MCP fixture](./webmcp.md#test-remote-mcp-from-agents-settings)
still provides a real protocol test with disposable Blogs records.

## Page and navigation

`AgentsPage` accepts an optional `refreshVersion` to reload externally changed conversations without discarding drafts, plus `client`, controlled `operationId` and `conversationId`,
`onSelectionChange`, translated `labels`, optional administrator-only `settings`,
`cropLabels` and `className`. Settings sits beside the page title and opens its
existing dialog; the conversation has no additional header. Domain cards appear only in empty chats. Hosts validate selection in the URL and restore it on
reload and Back/Forward. Unknown or unauthorized selections show unavailable feedback.
The first Send creates the saved chat and submits the draft once. Enter sends;
Shift+Enter inserts a newline. Cmd+Enter and Ctrl+Enter remain supported. Empty
drafts, disabled/pending controls, repeated keys and composing input do not send.
These shortcuts never approve an agent proposal. One New conversation action opens
an unsaved draft, retains drafts for each operation and is disabled in an unsaved chat.
Explicit file selection may create a chat to stage private attachments before
its first message, preserving the typed draft through upload and crop recovery.
A conversation's operation cannot be changed. Its plugin icon identifies each
chat in the history. Selecting an operation in an empty chat never changes a saved
conversation's operation. Message text, files, credentials and approval payloads never belong in
the URL. Refresh does not create another history entry.

The history always combines the current user's chats from all accessible operations,
most recent first, with plugin labels and date groups. Selection changes retain the
list while it refreshes. On mobile, Conversations switches between full-height history and chat views.
Opening a chat restores its operation and conversation in the URL. User messages
align right with the host's primary tint; agent replies use a neutral surface on the left.
The transcript and composer share a centered 64rem maximum width. Give the page
a sized flex/grid parent or an explicit height through `className`; it fills that
space and scrolls messages and history independently. The host shell owns the
available viewport height.
The scroll target spans the full conversation panel, including the space beside
the centered messages. Keep every host wrapper in the bounded flex/grid height
chain so wheel input scrolls the conversation while the header and composer stay
in place. Ordinary intranet pages retain their normal page scrolling.
The page uses the existing authenticated `operations()` and `list(operationId)`
methods; hosts do not need an additional history endpoint.

The page provides conversation creation/deletion, streamed replies, cancellation,
retry, action approvals and attachments. Chats are private; shared conversations
and agent-key authentication are not included. The current history list shows
the latest 100 chats per operation; older chats remain reachable by their direct
URL. Add cursor paging in hosts needing larger histories.

## Links to completed records

Completed actions show an Open record icon when the host returns a destination
from `createAgentsService`'s optional `resultHref(context, action)` callback.
`action` contains `operationId`, `tool`, normalized `input` and the actual service
`result`, including any newly created ID. Return a host-local path, or omit it for
actions such as deletion. The callback runs only after a successful approved write;
its result is saved with the action and survives reload. A missing, invalid or
failed route callback never repeats the completed write. The browser cannot
supply a result link through an approval or model response.

```ts
resultHref: (_context, { tool, result }) => {
  if (tool !== "blogs_create" || !result || typeof result !== "object" ||
      !("id" in result) || typeof result.id !== "string") return;
  return `/intranet/blogs/${encodeURIComponent(result.id)}`;
},
```

Use the host's actual record route and retain its normal authorization checks.
The deterministic showroom links to its own saved sample-record view.
`labels.allOperations` and `labels.openRecord` provide the translated controls.

## Approvals and recovery

Reads use existing authenticated plugin services. Every write or notification
first creates a stored proposal with the target, requested values, current-record
snapshot, attachment references and side effects. Approval accepts the action ID
and a boolean; it cannot substitute the tool, target or payload. The server
rechecks ownership, current operation access, schema and preview before execution.
Only one turn or approval executes in a conversation at a time. Success and
rejection remain in history; repeated approval never repeats the operation.

Preparing a proposal does not execute it. Runtime guidance asks for genuinely
missing required information or consequential ambiguity, then calls the write
tool without an extra chat confirmation. The displayed action remains the
approval boundary. For an explicitly fictitious Support ticket, the tool permits
labelled sample title/description and a neutral support type; priority is optional
and no requested files means an empty attachment list.

The existing business services remain authoritative for atomic version checks.
Connectors compare previews before execution, but do not add optimistic versions
to services that do not already support them. Hosts needing stronger concurrent
edit guarantees must provide transaction-bound adapters for those services.

Reads and proposal preparation preserve compatible plugin errors (`NOT_FOUND`,
`FORBIDDEN`, `INVALID`, `STORAGE`) across chat, MCP and WebMCP. Other failures become
`RUNTIME` without exposing internal messages. Missing records are expected after
deletion; a failed read does not mean the preceding deletion failed.

A validation or authorization rejection before execution expires the proposal.
Once execution starts, any thrown error becomes `unresolved`, blocks further turns and cannot
be automatically replayed. A lost request older than two minutes is recovered on
the next read; an executing mutation becomes unresolved. Configure provider and
upload deadlines below that recovery window. Stopping generation never claims
to roll back a write already started by approval.

After inspecting actual plugin/provider state, trusted host code calls
`agents.reconcile(ownerId, conversationId, actionId, result)`. Its result records
what happened, including when no change occurred; reconciliation itself never
replays the write. Do not expose this method as a browser-callable endpoint.
Before account deletion, disable its access and call `agents.removeOwner(id)`;
reconcile in-flight writes first. This removes chats and their private files even
if the original operation has since been disabled.

## Private attachments

Implement `AgentAttachmentStore` with `keyPrefix: "<site>/agents/"` and private
`put`, `get` and idempotent `remove` operations. Use the host's existing S3 client;
keep the bucket private and apply bounded upload/read timeouts. Keys are generated
under unique conversation/file directories using the shared filename convention.
Inspect abandoned uploading/cleanup records in host maintenance and retain
cleanup records until failed object deletion is retried. Adapters that stage
objects must configure lifecycle cleanup for their staging prefix. No database-byte fallback
or public object URL is permitted.

The browser adapter converts `File` to the service's
`attach({ conversationId, name, contentType, bytes })` request. Convert
`attachment(conversationId, id)` bytes back into a Blob for authorized previews.
Attachments default to 25 MiB, ten per message. Hosts can set
`maxAttachmentBytes`; the destination plugin still enforces its own limits. The service verifies stored byte length and SHA-256
before returning or using a file. Staging is explicitly initiated by file
selection. Publishing or associating the file with a plugin record remains a
separately approved action with that plugin's own byte validation.

Blogs exposes its existing 1200×900 thumbnail and 1600×900 banner crops plus
uncropped article images. Employees uses the existing 512×512 photo crop. Other
operations retain their existing upload rules. The final proposal displays the
cropped attachment and destination. File bytes are retrieved only by approved
tools; the runtime receives file metadata and IDs. OCR, indexing and multimodal
model inference are not provided.

Drive downloads keep stable tool references in conversation history and resolve
fresh authorized URLs only when the user presses Download; signed URLs are not
stored as canonical file references or sent to the model. Host folder/archive
downloads can use the existing Drive archive UI through a host download adapter.

Failed uploads retain cleanup metadata; `client.cleanup(conversationId)` retries
their object removal. Failed chat deletion keeps the chat marked for deletion,
blocks new changes and can be retried. Deleting a chat never deletes files already
adopted by another plugin.

## Custom operations

Compose an `AgentServerOperation` with a stable ID, labels, trusted instructions,
a fresh `authorize` callback and an explicit list of `AgentTool` objects. Existing
connector tools can be combined into one host-defined operation. Keep tools
read-only or approval-gated according to their actual side effects. The
`agentTools` helpers build schema-validated reads and action previews; custom tool
schemas must round-trip normalized arguments when proposals are revalidated.
Write tools receive the freshly revalidated prepared snapshot as the final `run`
argument. Pass its reviewed deletion/retention token to the domain service;
obtaining a replacement preview inside `run` would bypass the approved scope.
Instructions, business fields and customer/Factory workflow choices stay in the
host, outside registry-managed files. There is no workflow graph builder,
scheduler, runtime plugin discovery or background job engine.

## Verification

Run `node --test tests/agents.test.mjs tests/agents-connectors.test.mjs tests/agents-models.test.mjs` for the
core and connector contracts. With the existing Drive PostgreSQL/MinIO test
containers running, use `node --test tests/agents/storage.integration.mjs` for
generated migrations, durable approvals, concurrent clients and private files.
`tests/agents.browser.mjs` covers the deterministic showroom. A host must separately
verify its real provider, session/transport protection, quotas, migrations, S3
privacy/lifecycle rules and adopted domain adapters before deployment.

## External assistants (optional MCP)

For assistants using the current browser session and page context, install the
separate [WebMCP connector](./webmcp.md). Both adapters reuse the same executor;
WebMCP adds a visible website review and optional private staging.

Install `@forge/agents-mcp-server` and the installed business connectors. It uses
the official TypeScript MCP SDK's Streamable HTTP transport, including stateless
legacy-client compatibility. The host supplies OAuth and fresh account/grant
checks; passing a caller-supplied user ID is not authentication. See the shared
[contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/agent-access/spec.md)
and [approval decision](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0018-external-intranet-agents.md).

The adapter leaves the `Connection` response header to the HTTP server. This
prevents a proxy from reusing a connection that the client requested to close.
Keep `Cache-Control: no-store` and `Vary: Authorization` on MCP responses.

```ts
import { createAgentsMcpHandler } from "@/components/plugins/agents/server/mcp.server";

const gateway = createAgentsMcpHandler({
  resource: "https://intranet.example/api/mcp",
  store,
  operations, // Explicit installed connector registrations and existing host adapters.
  actor: async (context) => {
    // Verify issuer/audience, then re-read the active grant, user and permissions.
    return resolveCurrentConnection(context);
    // { id: userId, connection: { id: grantId, clientId }, scopes: [...] } or null.
  },
  audit: (_context, event) => logMetadata(event), // tool + outcome, no private payloads
});
// After OAuth validation and host rate limiting:
return gateway.handle(request, trustedContext);
```

Scope names are `agents:<operation-id>:read` and `agents:<operation-id>:write`.
Discovery and execution intersect these with each connector's current `authorize`
and service checks. Employee administration still requires an administrator.
Missing connectors and optional adapters produce no corresponding tools.
Attachment-dependent tools are excluded; Drive download preparation retains its
existing metadata behavior and does not send signed storage URLs to the model.

Reads use normal named connector tools. Write tools accept `{ input, requestId }`
and prepare a 30-minute proposal without changing business records. Keep the same
request ID only for an identical retry. Show the complete returned `preview`, then
call `agents_execute({ proposalId, review: preview })` or `agents_reject` with that
unchanged review. `agents_proposal` retrieves the recorded outcome. Another grant
or user cannot access it. A changed snapshot invalidates execution. Repeating an
execution cannot replay a write; `unresolved` requires the existing trusted
`reconcile` host procedure. Operation side effects, including mailing, remain in
existing services.

Execution tools have `readOnlyHint: false`. Matching review arguments are an
integrity check, **not evidence of a separate human approval**. Claude/ChatGPT
confirmation settings may allow unattended writes. OAuth consent authorizes the
connection; it does not approve every subsequent action. Returned information is
processed by the assistant provider.

The shared `createAgentsService` also exposes a trusted `external(context)` API and
makes `runtime` optional. Sending a chat message without a runtime reports
`NOT_CONFIGURED`; external calls require no model settings. Chat calls already use
the extracted execution module directly and keep their existing approval UI.
External proposals have a connection binding and `source=mcp`; private WebMCP
staging uses `source=staging`. No transcript is
synchronized. Existing rows need an additive host migration for the `source`
column with default `chat`. Stores must implement insert-only `create`, including
under concurrent retries. Do not replace stored proposals on ID conflict.

The template reference implementation owns Better Auth, `/api/mcp`, discovery,
consent, account Security and migrations. Installation makes it available; it registers only
its installed Employees connector. Registry publication and installation into
other customer sites are separate actions; no customer is enabled by this source
change. The local client fixtures are not live Claude/ChatGPT acceptance tests.

Conversation tools can list, read, create and remove the current user's chats,
send a message, attach a staged file and decide a stored business proposal.
Decisions show the inner proposal's full target, changes and effects before
execution. Sending uses the host model and its billing; the showroom uses a mock.
Supports tools reuse the staff queue's create/comment/status/upload operations;
they add no ticket editing, deletion or notification system.

`createAgentConversationsOperation` requires `authorizeOperation(context, id, kind)`.
For MCP, intersect the connection's `agents:<id>:read/write` scopes with current
website permissions. Conversations always need read access to their operation;
changes also need write access. An `agents:agents:*` grant alone gives no access
to Blogs or another plugin through saved chats.

## External file transfers

Provide private `attachments` to `createAgentsMcpHandler` to expose upload tools
and `agents_stage_file`. Inline staging accepts up to 512 KiB and binds the bytes
to the current owner, connection and request ID. `agents_discard_file` removes an
unused staged file. No staging call writes into a business plugin: that requires
a separate proposal and execution with its unchanged review, including file metadata.
For larger files, a host-owned authenticated binary endpoint can call the gateway's
`stageFile(context, input)` with its own bounded body reader and rate limit.

Pass `readFile(context, { scope, entryId })` to the Drive connector to enable
`drive_read_file`. The adapter must authorize the exact entry, enforce its byte
limit and return `{ name, contentType, bytes }`. Results contain 48 KiB chunks and
a SHA-256 version. Send that version with subsequent offsets so an edit cannot
mix different file versions. Signed storage URLs stay on the server. The existing
`drive_download` still prepares a user-click download.

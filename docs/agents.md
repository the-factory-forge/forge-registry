# Agents

`@forge/agents` supplies an operation-first staff chat page. Conversations belong
to one user and one operation. `@forge/agents-server` supplies provider-independent
orchestration and PostgreSQL/Drizzle persistence. The host supplies fresh staff
sessions, transport and private object storage. It can supply its own model runtime
or use the optional website connection for OpenAI, Anthropic or DeepSeek.

[Try the deterministic showroom](https://registry.the-corner.io/en/agents).
Its browser-session mock is not production storage or authorization.

## Installation and composition

```sh
pnpm dlx shadcn@4.22.1 add @forge/agents @forge/agents-server @forge/agents-blogs-server
```

Install only the required connectors. Neither Agents item installs the seven
business plugins automatically. Connectors are server-only source; their
dependencies include the existing plugin contracts and service schemas.

| Connector                    | Factory                            | Host integration                                                                                                                                                   |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agents-blogs-server`        | `createBlogsAgentOperation`        | An authenticated `BlogsClient`, including history when enabled                                                                                                     |
| `agents-employees-server`    | `createEmployeesAgentOperation`    | A fresh admin employee service, authorized exact lookup, trusted invitation/verification URLs; optional deletion-retention, photo and website-publication adapters |
| `agents-customers-server`    | `createCustomersAgentOperation`    | The existing Customers service client                                                                                                                              |
| `agents-projects-server`     | `createProjectsAgentOperation`     | The existing Projects service client; customer ownership remains required                                                                                          |
| `agents-drive-server`        | `createDriveAgentOperation`        | The scoped Drive client and authorized exact entry lookup; optional space-name adapters                                                                            |
| `agents-menus-server`        | `createMenusAgentOperation`        | The Menus client; optional image upload through the existing menu-item Drive scope                                                                                 |
| `agents-reservations-server` | `createReservationsAgentOperation` | The staff Reservations client and authorized exact lookup without management secrets                                                                               |

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
accepts only user text, attachment references, a request ID and an optional resume
flag. It builds history from the database; submitted assistant/system messages or
replacement action arguments cannot establish authority. Keep provider errors
and credentials out of public responses.

`send` emits incremental text and an initial durable conversation. Always reload
`get` after completion, cancellation or failure to obtain final messages and
proposals. Use a fresh request ID for a deliberate retry; repeated IDs do not
start another turn. Set `resume: true`, empty text and no attachment IDs to
continue a failed/stopped turn or a completed approval without inventing a user
message. The page exposes this as Continue/Retry.

Keep `AgentsClient` identity stable while its authenticated scope is unchanged.
Keep the optional settings client stable too. Replacing either client clears drafts
and aborts old UI requests, including pending settings results. Changing operation or chat
aborts the departed stream; late results cannot update the new view.

## Administrator-managed model connection

Pass an `AgentsSettingsClient` as `AgentsPage.settings` only for website
administrators. The header Settings button opens a provider, API key and model
form. Following [VS Code’s bring-your-own-key flow](https://code.visualstudio.com/docs/agent-customization/language-models),
choose OpenAI, Anthropic or DeepSeek, enter the provider key, load its available
models, select one and Save. One active connection serves the website's staff;
this is not a per-user key collection. Existing chats keep their operations and
approval records. Saved settings are used on subsequent model requests.

`@forge/agents-server` exports `createAgentsModelConnection`,
`createAgentsConnectionStore` and the additive `agentsModelConnection` table.
Compose that table into the host schema and generate/review its migration before
enabling settings. Each website must use its own database, as with the other
plugin tables. Set a stable, random 32-byte encryption key in server-only secret
configuration, separate from PostgreSQL. Do not regenerate it on process startup;
back it up with the deployment's secrets. Losing or replacing it requires entering
the provider key again. Stored API keys use AES-256-GCM, bound to the provider and
model. They are never returned by settings reads or stored in chat history.

```ts
// Server only: resolve fresh administrator access, never a browser role flag.
const connection = createAgentsModelConnection({
  store: createAgentsConnectionStore(db),
  encryptionKey: Buffer.from(env.AGENTS_ENCRYPTION_KEY, "base64"),
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

## Page and navigation

`AgentsPage` accepts `client`, controlled `operationId` and `conversationId`,
`onSelectionChange`, translated `labels`, optional administrator-only `settings`,
`cropLabels` and `className`. Settings replaces the former header operation selector;
operation cards and All operations retain selection and navigation.
Hosts parse operation/conversation IDs at their route boundary and bind selections
to URL history. Missing selection shows selectable operation cards with titles
and descriptions. The cards also remain visible in new, empty chats, with the
current operation marked as selected. Unknown or unauthorized selections show
unavailable feedback. Once an operation is selected, staff can type and send
immediately. The first Send creates the saved chat and submits that message;
there is no separate Start action. Cmd+Enter (macOS) or Ctrl+Enter (Windows/Linux)
activates Send; Enter inserts a newline. The shortcut respects disabled and pending
states and never approves an agent proposal. New conversation opens an unsaved draft.
Explicit file selection may create a chat to stage private attachments before
its first message, preserving the typed draft through upload and crop recovery.
A conversation's operation cannot be changed. Its plugin icon identifies each
chat in the history. After the first message, All operations returns to the chooser.
Choosing a different card before then leaves the empty chat and selects the new
operation; it never changes the saved conversation's operation.
All operations leaves the current chat to choose another operation; it does not
change the saved chat's plugin. Reload and Back/Forward restore the same selected
operation and chat. Message text, files, credentials and approval payloads never belong in
the URL. Refresh does not create another history entry.

With no operation selected, the history combines the current user's chats from
all accessible operations, most recent first. Selecting an operation filters the
history. Opening a chat selects its saved operation and conversation in the URL.
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

The existing business services remain authoritative for atomic version checks.
Connectors compare previews before execution, but do not add optimistic versions
to services that do not already support them. Hosts needing stronger concurrent
edit guarantees must provide transaction-bound adapters for those services.

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
Attachments are limited to 25 MiB, ten per message; the destination plugin can
enforce a smaller limit. The service verifies stored byte length and SHA-256
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

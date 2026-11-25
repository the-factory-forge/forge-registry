# Supports–GitHub

Install `@forge/supports-github` and `@forge/supports-github-server` alongside
Supports. This connector sends staff website requests to one host-configured
private repository per site. New tickets queue for automatic issue creation.
If GitHub is unreachable or rejects the first delivery before an issue is created,
the ticket and subsequent replies stay local until staff select **Send to GitHub**.
Selecting Pending or Send to GitHub runs the existing delivery job and sends saved replies in order.
If GitHub may already have created the issue, marker reconciliation and operator
recovery apply. Tickets that predate the connector still require staff to confirm
their export. Installation performs no repository creation, export, migration or
network request.

The [showroom](https://registry.the-corner.swiss/connectors/supports-github) uses
in-memory data. The registry owns this implementation and its
[requirements](../openspec/specs/plugins/spec.md#requirement-supportsgithub-connector).
Production adoption remains a separate host change.

## Host wiring

Generate and review a migration containing the existing Supports tables and the
four exported `supportsGithub*` Drizzle tables. Use the same PostgreSQL database
and transaction implementation for both services. One database/schema belongs to
one site, as with Supports. Persist jobs, mappings and delivery receipts across
restarts; rebuilding them can duplicate remote content.

```ts
import { createSupportsGithub } from "@/components/connectors/supports-github/server";
import { createSupportsStorage } from "@/components/plugins/supports/server";

// Compose once on the server; no client call runs until both services exist.
const supports = createSupportsStorage<Context>({
  db,
  s3,
  bucket,
  keyPrefix: "site-id/supports/",
  resolveActor,
  authorize,
  onMutation: (transaction, event): Promise<void> => github.enqueue(transaction, event),
});
const github = createSupportsGithub<Context>({
  db,
  supports: supports.integration,
  repository: { id: repositoryId, installationId, botUserId, owner, name },
  getAccessToken: () => credentials.installationToken(installationId),
  webhookSecret,
  // Optional. Use the enabled issue types and single-select options from this organization.
  issueTypes: { bug: "Bug", feature: "Feature", support: "Task" },
  priorityField: {
    id: priorityFieldId,
    options: { P0: "Urgent", P1: "High", P2: "Medium", P3: "Low", P4: null },
  },
  ticketUrl: (id) => `https://site.example/intranet/supports/${encodeURIComponent(id)}`,
  authorizeOperator: async (context) => isTrustedMaintenanceOperator(context),
});
```

`Context`, credentials, sessions, database, S3 and authorization in this example
are host implementations. `ticketUrl` must be absolute HTTPS without query
credentials. It points to a route that checks staff access, never a signed image
URL. Keep secrets and both server entrypoints out of the browser bundle.

Forge template hosts fix `repository.owner` to `the-factory-forge`. They use
`SUPPORT_GITHUB_REPOSITORY` when supplied, otherwise `SITE_NAME`; no owner
environment variable is needed. Keep an explicit repository override when its
name differs from the site's infrastructure slug. Repository defaults alone do
not enable delivery: the dedicated App credentials, pinned IDs and webhook secret must all
be configured. See the [host setup guide](https://github.com/the-factory-forge/forge-template/blob/main/docs/supports.md).

Forge sites use a **dedicated GitHub App per customer**, installed only on that
customer's private repository. The existing host API signs requests using its own
App key, refreshes repository-scoped tokens and receives GitHub webhooks directly.
Its `webhookSecret` matches the dedicated App's webhook setting. No shared service,
service token, relay or separate deployment is required. Follow the
[customer setup guide](corner-support.md).

Use a GitHub App reserved for Support within the selected private repository with
**Issues: read and write** and repository metadata read access. Subscribe to
`issues` and `issue_comment`. The host obtains and refreshes its installation
access token; app private keys never enter connector persistence. Pin the numeric
installation, repository and App bot user IDs. Use that App only for this bridge
on each repository: its status actions are treated as connector echoes. Repository
labels, assignees, milestones and other automation remain host-owned. See GitHub's
[installation token guide](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).

For every browser request, reconstruct `github.client(context)` from the fresh
session. Expose only `get(ticketId)`, `exportTicket(ticketId)` and `retry(ticketId)`
through the host's authenticated transport and CSRF protection. To check GitHub
on an explicit refresh, expose a staff-read endpoint that calls `github.refresh(context, ticketId)`.
It verifies provider receipts and imports new remote activity. These operations
check Supports staff membership and host permissions. Historical export requires
read and comment permission; safe retry requires comment permission. Customers
and anonymous callers are rejected even if they have the same auth role as staff.

Mount the card through the generic slot, pass host translations through `labels`,
and refresh `revision` after a local mutation or host polling. Use the same
`pendingBadge(id)` callback for the queue's `renderStatus` and the discussion
below. Load connection state only for tickets the viewer may read.

```tsx
function pendingBadge(id: string) {
  const connection = connections.get(id);
  if (!connection || connection.issueUrl) return undefined;
  const historical = connection.state === "unlinked";
  return (
    <SupportGithubSendButton
      badge
      ticketId={id}
      client={githubTransport}
      action={historical ? "export" : "retry"}
      failed={Boolean(connection.failure)}
      canWrite={canComment && (historical || connection.canRetry)}
      onChanged={reload}
    />
  );
}

<SupportDetailPage
  {...detailProps}
  statusBadge={pendingBadge(ticket.id)}
  attachmentNote={supportsGithubLabels.images}
  integrationContent={
    <SupportGithubCard
      ticketId={ticket.id}
      client={githubTransport}
      revision={dataRevision}
      canWrite={canComment}
      onChanged={reload}
      onRefresh={() => refreshGithub(ticket.id)}
    />
  }
/>;
```

An unsent ticket shows a gray Pending badge. A failed attempt shows a disconnected
icon and an error toast. The attachment note appears beside actual images only.
A linked ticket shows its ordinary workflow status. `supports.integration` is a
trusted server port, not a browser transport: validated imports bypass ordinary
staff authorship but never generate outbound mutations. `onMutation` runs inside
the local transaction. An enqueue failure rolls back content, attachment claims
and mutation receipts; the existing composer retains its draft. Provider requests
run later, so GitHub downtime does not prevent local saves.

## Request-driven delivery

After a local mutation commits, a host can call the server-only `github.send(ticketId)`
to deliver that ticket's eligible outbound jobs. A failed first creation still requires
staff retry. Set `processWebhookOnReceipt: true` to import a verified webhook before
acknowledging it. An explicit staff refresh reconciles the linked issue and applies
pending inbound replies without sending local drafts. These operations use the same
durable jobs and ticket leases as the scheduled workers.

## Webhooks and workers

Read the unparsed request bytes, then call:

```ts
await github.receiveWebhook({
  body: new Uint8Array(await request.arrayBuffer()),
  signature: request.headers.get("x-hub-signature-256") ?? "",
  deliveryId: request.headers.get("x-github-delivery") ?? "",
  event: request.headers.get("x-github-event") ?? "",
});
```

Apply a 1 MiB host request-body limit before buffering. A successful return may be
acknowledged with 2xx; accepted work and its receipt commit before return. Map
`SupportsGithubError` codes `INVALID` to 400, `FORBIDDEN` to 403, `CONFLICT` to 409,
and storage/delivery failure to 503. Return safe codes only. HMAC uses raw bytes
and constant-time comparison. The signed payload must match the configured
installation and private repository. Unsupported events, edits, deletions of
comments and unrelated issues do not import history. Duplicate delivery IDs with
a different body are rejected. Persisted receipts contain a digest, not raw bodies.

Schedule `github.process(20)` each minute and `github.reconcile(20)` every fifteen
minutes. Each call examines at most 50 bindings; `process` performs at most the
requested number of jobs, one per ticket. Five-minute fenced leases serialize
workers, reconciliation and operator recovery. Expired in-flight writes become
uncertain. Comment reconciliation checkpoints 100 records at a time and restarts
a complete pass after the last page; deletions cannot permanently hide shifted
records. Provider scans used for status and uncertain-write recovery have a
90-second deadline and fail explicitly rather than return partial results.

These intervals are defaults, not delivery guarantees. Backlogs, rate limits and
outages delay work. Run schedulers with time to finish a batch; inspect returned
`examined`, `pending`, `failed` and `blocked` counts and `github.health()`.
Counts include blocked jobs and broken bindings and can overlap. Alert routing
belongs to the host. Alert on worker exceptions, sustained backlog, failures and
blocked work; safe read failures during reconciliation also become visible.

Each delivery verifies repository ID, exact configured owner/name, private
visibility, issue access and issue identity. Public or archived repositories,
transferred/deleted issues, missing access and changed repository IDs stop
synchronization while preserving local content and queued work. Restore access
and use a permitted retry, or the operator procedure below.

## Content and status

An export includes the original description, every saved reply and historical
status entry with author attribution, then the current status. The snapshot and
binding are locked with local mutations; concurrent replies appear exactly once.
Type is always included in the issue body. With `issueTypes` configured, the
connector also sets the native GitHub issue type once. Later GitHub triage takes
precedence. With `priorityField` configured, setting or clearing priority updates
only that native issue field. A null option clears the assignment. Both mappings
are optional and belong to the host. Repository labels are independent.
See [GitHub issue field values](https://docs.github.com/en/rest/issues/issue-field-values).

New replies are comments in both directions. All
imported comments are visible to all authorized site staff, including comments
from repository collaborators who are not site staff.

Images stay at their source. Forward filenames/alt text with the authenticated
ticket or original GitHub comment link and explicit “image not copied” wording.
No image fetching, raw HTML rendering or signed-URL persistence is included.
Image-only replies remain meaningful. Local composers retain the 5,000-character
limit; imports allow 65,536 characters, including their converted representation.
Larger replies create a visible failure notice and original link, plus a blocked
job; no truncated excerpt is substituted. Operator remediation can mark that
acknowledged inbound job done after staff have access to the original; retain its
message mapping. It does not block later replies.

Mentions remain active and may notify people or invoke repository bots. Code
fences retain literal text. See [GitHub mention behavior](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#mentioning-people-and-teams).
Edits and deletions on GitHub do not change previously imported history.

| Supports | GitHub               |
| -------- | -------------------- |
| open     | open                 |
| closed   | closed / completed   |
| canceled | closed / not-planned |

Incoming not-planned or duplicate closures become canceled; other closures become
closed. Changing an already closed ticket between completed and canceled briefly
reopens and recloses the issue, because GitHub only guarantees applying a new
reason with a state change. This can trigger repository automation; the connector
rechecks for newer external intent between those writes. See [Update an issue](https://docs.github.com/en/rest/issues/issues#update-an-issue).
A merge may close a ticket before deployment. Status webhooks trigger a
fresh provider read, so reordered deliveries do not roll back current status.
A newer confirmed external transition supersedes older queued local intent and
shows a warning; staff must act again. GitHub offers no atomic compare-and-set
across the two systems: a change arriving after the final read is observed on
the next webhook/reconciliation pass.

## Operator recovery

Keep `recover`, `resume`, scheduler methods and direct tables outside browser
transport. `authorizeOperator` must verify a separate trusted operator identity.
Pause the site's workers before manual database maintenance and wait for active
leases to expire. Back up affected rows and record the operator decision in the
host's protected audit system without copying disclosed content.

For `UNCERTAIN`, first inspect the job and repository. Successful issue/comment
writes carry `<!-- forge-supports:JOB_UUID -->` at the end of the body. Recovery
requires the configured App bot author and exact marker. The worker searches provider
records after a lost acknowledgement. Staff can retry to repeat that lookup.
An unknown create or comment stays blocked until its receipt is found or an
operator verifies the outcome. A native field assignment reads its current
value before another write.

- If an issue exists, call `recover(context, {ticketId, jobId,
  resolution: "delivered", remoteId: issueNumber})`. For comments, `remoteId` is
  the numeric **comment ID**. The connector verifies the result before binding.
- If no matching write exists, inspect the entire relevant provider history and
  confirm the request cannot still complete. Then call `recover(context,
  {ticketId, jobId, resolution: "unsent"})`. This allows a new attempt only after
  another marker check. Multiple matches or a failed scan cannot authorize resend.
- An uncertain status is never replayed automatically. A delivered resolution
  adopts confirmed remote status; an unsent resolution permits rechecking the
  queued intent against newer external transitions.
- After restoring a private repository or original issue, call
  `resume(context, ticketId)`. It verifies the same configured binding, acknowledges
  the missing-issue event and releases safe pending work. It cannot relocate a
  binding or clear an uncertain write.

For repository changes, first restore the old configuration to drain/reconcile
and record every ticket/issue binding. Stop workers and webhook ingestion, resolve
uncertain jobs, and choose explicitly whether to keep the old discussion or move
it using GitHub's operator tools. For an approved move, verify the destination is
private, its App installation and each resulting issue ID/number. In one reviewed
host migration, update affected binding identity/URL, reset comment scan cursors,
and review pending payloads, source URLs and status revisions for that destination.
Retain message IDs, tombstones and receipt history. Test the mapping against a
private staging repository before resuming. A configuration edit alone never
exports or moves existing tickets; this manual migration is outside registry v1.

### Removing accidentally disclosed content

Stop workers and webhook ingestion; confirm no write is still in flight. Identify
the original ticket/activity, outbound jobs (including historical export), remote
issue/comment IDs and inbound mappings. Remove the content from GitHub with an
authorized operator and from the local activity/description and attachments with
a reviewed host operation. A source image may require removal in its source
system too. In the same database maintenance transaction:

1. Replace affected saved bodies with a neutral removal notice or remove the
   affected activity and private attachment metadata/objects as appropriate.
2. Set affected jobs to `redacted`, erase their JSON payloads, and retain their IDs
   and source keys. Erase matching Supports mutation fingerprint content while
   retaining request tombstones so old requests cannot recreate the message.
3. Insert/retain `supportsGithubMessages` tombstones for every known provider
   issue/comment/status key, set `redacted = 1`, and retain remote IDs. For an
   uncertain outbound write retain its marker job tombstone too: later discovery
   recognizes its echo without importing the content.
4. Remove copies from host logs, dead-letter payloads, exports and backups under
   the host's retention process. Delivery receipt digests contain no raw payload.

Never delete the connector's replay keys as a cleanup shortcut. If an issue body
is removed, keep the binding blocked instead of making it unlinked; automatic
creation would disclose it again. Reconcile in a controlled test and prove the
removed content stays absent before restarting the schedulers.

## Validation and production acceptance

Run the unit/browser suites and `pnpm test:supports-github` against the disposable
PostgreSQL fixture described in [Supports](./supports.md#verification-and-adoption).
Tests cover transaction rollback, staff guards, private identity checks, signatures,
duplicates, reordered events, competing workers, lost responses and DB finalization,
echoes, stale status, concurrent historical export, long/image-only replies,
pagination, broken bindings and redaction replay prevention.

Before production, the host must apply migrations, configure credentials and raw
webhooks, schedule both workers, connect monitoring and perform a private-repository
acceptance test covering actual App identity, permissions, notification behavior,
rate limits, closed-state reasons, lost responses and source-image access. Registry
validation uses mocked HTTP and never writes to a live GitHub repository.

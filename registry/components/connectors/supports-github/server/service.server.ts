import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { and, asc, desc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import type {
  SupportsGithubClient,
  SupportsGithubConnection,
  SupportsGithubFailure,
} from "@/components/connectors/supports-github/contracts";
import {
  createGithubClient,
  SupportsGithubError,
  fromGithubStatus,
  githubComment,
  githubIssue,
  issueHref,
  marker,
  hasMarker,
  repositoryConfig,
  type GithubRepository,
  type GithubIssue,
  type GithubComment,
  type GithubEvent,
} from "@/components/connectors/supports-github/server/github.server";
import {
  IMPORT_LIMIT,
  markdownText,
  sourceMarkdown,
} from "@/components/connectors/supports-github/server/markdown";
import {
  supportsGithubBindings as bindings,
  supportsGithubJobs as jobs,
  supportsGithubMessages as messages,
  supportsGithubDeliveries as deliveries,
  type GithubBinding,
  type GithubJob,
  type GithubJobPayload,
} from "@/components/connectors/supports-github/server/schema";
import { SupportsError, supportIdSchema } from "@/components/plugins/supports/schema";
import type {
  SupportMutation,
  SupportsIntegration,
} from "@/components/plugins/supports/server/integration";
import type { DatabaseTransaction, PluginDatabase } from "@/components/utils/database";

export interface SupportsGithubOptions<Context> {
  db: PluginDatabase;
  supports: SupportsIntegration<Context>;
  repository: GithubRepository;
  getAccessToken(): Promise<string>;
  webhookSecret: string;
  ticketUrl(ticketId: string): string;
  /** Trusted operator identity; separate from ordinary staff browser permissions. */
  authorizeOperator(context: Context): Promise<boolean>;
  request?: typeof fetch;
}
const leaseMs = 5 * 60 * 1000;
const activeStates = ["pending", "sending", "failed", "blocked"] as const;
const retryable = (failure: SupportsGithubFailure | null) =>
  failure === "DELIVERY" || failure === "ACCESS";
const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const limitSchema = z.number().int().min(1).max(50);
const actor = (user: GithubComment["user"]) => ({
  id: `github:${user?.id ?? "deleted"}`,
  name: user?.login ?? "Deleted GitHub user",
});

export function createSupportsGithub<Context>(options: SupportsGithubOptions<Context>) {
  const { db, supports } = options;
  const repository = repositoryConfig.parse(options.repository);
  const secret = z.string().min(20).parse(options.webhookSecret);
  const github = createGithubClient({ ...options, repository });
  const localUrl = (id: string) => {
    const url = new URL(options.ticketUrl(id));
    if (url.protocol !== "https:" || url.username || url.password || url.search)
      throw new SupportsGithubError("INVALID");
    return url.href;
  };
  async function locked(tx: DatabaseTransaction, id: string) {
    supportIdSchema.parse(id);
    await supports.lock(tx, id);
    const [binding] = await tx
      .select()
      .from(bindings)
      .where(eq(bindings.ticketId, id))
      .for("update");
    return binding;
  }
  function configured(binding: GithubBinding) {
    if (
      binding.repositoryId !== repository.id ||
      binding.installationId !== repository.installationId
    )
      throw new SupportsGithubError("REPOSITORY");
  }
  async function add(
    tx: DatabaseTransaction,
    ticketId: string,
    key: string,
    direction: GithubJob["direction"],
    kind: GithubJob["kind"],
    payload: GithubJobPayload,
  ) {
    const [last] = await tx
      .select({ at: jobs.createdAt })
      .from(jobs)
      .where(eq(jobs.ticketId, ticketId))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    // Creation order is assigned under the ticket lock, independently of remote timestamps.
    const at = new Date(Math.max(Date.now(), (last?.at.getTime() ?? 0) + 1));
    await tx
      .insert(jobs)
      .values({
        id: randomUUID(),
        ticketId,
        sourceKey: key,
        direction,
        kind,
        payload,
        createdAt: at,
      })
      .onConflictDoNothing();
  }
  function outbound(
    body: string,
    author: string,
    source: string,
    attachments: readonly { name: string }[],
  ) {
    const images = attachments.length
      ? `\n\nImages were not copied. View the originals in Supports:\n${attachments.map((file) => `- [${markdownText(file.name)}](${source})`).join("\n")}`
      : "";
    return `${markdownText(author)} wrote in [Supports](${source}):\n\n${sourceMarkdown(body, source)}${images}`;
  }
  async function createBinding(tx: DatabaseTransaction, id: string) {
    await tx.insert(bindings).values({
      ticketId: id,
      repositoryId: repository.id,
      installationId: repository.installationId,
    });
    const { ticket, activity } = await supports.snapshot(tx, id);
    const source = localUrl(id);
    await add(tx, id, `local:create:${id}`, "outbound", "create", {
      title: ticket.title,
      body: `Type: ${ticket.type}\n\n${outbound(ticket.description, ticket.author.name, source, ticket.attachments)}`,
    });
    for (const entry of activity) {
      await add(tx, id, `local:${entry.id}`, "outbound", "comment", {
        body: outbound(
          entry.kind === "comment" ? entry.body : `Changed status to ${entry.status}.`,
          entry.author.name,
          source,
          entry.attachments,
        ),
      });
    }
    if (ticket.status !== "open")
      await add(tx, id, `local:initial-status:${id}`, "outbound", "status", {
        status: ticket.status,
        baseRevision: "",
      });
  }
  /** Attach to Supports onMutation. Only local database work is allowed in this transaction. */
  async function enqueue(tx: DatabaseTransaction, raw: SupportMutation) {
    const event = z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("create"), ticketId: supportIdSchema }),
        z.object({
          kind: z.enum(["comment", "status"]),
          ticketId: supportIdSchema,
          activityId: supportIdSchema,
        }),
      ])
      .parse(raw);
    const binding = await locked(tx, event.ticketId);
    if (!binding) {
      if (event.kind === "create") await createBinding(tx, event.ticketId);
      return; // Existing local-only tickets require an explicit export.
    }
    if (event.kind === "create") return;
    const { activity } = await supports.snapshot(tx, event.ticketId);
    const entry = activity.find((item) => item.id === event.activityId);
    if (!entry || entry.kind !== event.kind) throw new SupportsGithubError("INVALID");
    await add(
      tx,
      event.ticketId,
      `local:${entry.id}`,
      "outbound",
      entry.kind,
      entry.kind === "comment"
        ? {
            body: outbound(
              entry.body,
              entry.author.name,
              localUrl(event.ticketId),
              entry.attachments,
            ),
          }
        : { status: entry.status!, baseRevision: binding.externalRevision },
    );
  }
  function client(context: Context): SupportsGithubClient {
    return {
      async get(id) {
        supportIdSchema.parse(id);
        await supports.authorize(context, "read", id);
        const [binding] = await db.select().from(bindings).where(eq(bindings.ticketId, id));
        if (!binding)
          return { state: "unlinked", issueUrl: null, failure: null, pending: 0, canRetry: false };
        const work = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.ticketId, id), inArray(jobs.state, [...activeStates])));
        const [lastStatus] = await db
          .select()
          .from(jobs)
          .where(
            and(eq(jobs.ticketId, id), eq(jobs.direction, "outbound"), eq(jobs.kind, "status")),
          )
          .orderBy(desc(jobs.createdAt))
          .limit(1);
        const failure =
          binding.repositoryId !== repository.id ||
          binding.installationId !== repository.installationId
            ? "REPOSITORY"
            : (binding.failure ??
              work.find((job) => job.state === "blocked")?.failure ??
              work.find((job) => job.failure)?.failure ??
              (lastStatus?.failure === "STALE_STATUS" ? "STALE_STATUS" : null));
        const state: SupportsGithubConnection["state"] =
          binding.failure || failure === "REPOSITORY" || work.some((job) => job.state === "blocked")
            ? "blocked"
            : work.some((job) => job.state === "failed")
              ? "failed"
              : work.length
                ? "pending"
                : "synchronized";
        return {
          state,
          issueUrl: binding.issueUrl,
          failure,
          pending: work.length,
          canRetry:
            (state === "failed" || state === "blocked") &&
            retryable(failure) &&
            !work.some((job) => job.state === "blocked" && !retryable(job.failure)),
        };
      },
      async exportTicket(id) {
        supportIdSchema.parse(id);
        await supports.authorize(context, "read", id);
        await supports.authorize(context, "comment", id);
        await db.transaction(async (tx) => {
          const existing = await locked(tx, id);
          await supports.authorize(context, "comment", id);
          if (!existing) await createBinding(tx, id);
        });
      },
      async retry(id) {
        supportIdSchema.parse(id);
        await supports.authorize(context, "comment", id);
        await db.transaction(async (tx) => {
          const binding = await locked(tx, id);
          await supports.authorize(context, "comment", id);
          if (!binding) throw new SupportsGithubError("INVALID");
          configured(binding);
          if (binding.failure && !retryable(binding.failure))
            throw new SupportsGithubError("CONFLICT");
          const blocked = await tx
            .select()
            .from(jobs)
            .where(and(eq(jobs.ticketId, id), eq(jobs.state, "blocked")));
          if (blocked.some((job) => !retryable(job.failure)))
            throw new SupportsGithubError("CONFLICT");
          await tx.update(bindings).set({ failure: null }).where(eq(bindings.ticketId, id));
          await tx
            .update(jobs)
            .set({ state: "pending", failure: null, availableAt: new Date() })
            .where(
              and(
                eq(jobs.ticketId, id),
                eq(jobs.state, "failed"),
                inArray(jobs.failure, ["DELIVERY", "ACCESS"]),
              ),
            );
        });
      },
    };
  }
  async function verifyIssue(binding: GithubBinding) {
    configured(binding);
    await github.verify();
    if (!binding.issueNumber || !binding.issueId) throw new SupportsGithubError("MISSING");
    const issue = await github.issue(binding.issueNumber);
    if (issue.id !== binding.issueId) throw new SupportsGithubError("MISSING");
    return issue;
  }
  async function confirmedStatus(binding: GithubBinding) {
    await verifyIssue(binding);
    const before = await github.events(binding.issueNumber!);
    const issue = await github.issue(binding.issueNumber!);
    const events = await github.events(binding.issueNumber!);
    if (before.at(-1)?.id !== events.at(-1)?.id) throw new SupportsGithubError("DELIVERY");
    const latest = events.filter((event) => ["closed", "reopened"].includes(event.event)).at(-1);
    if (latest && (latest.event === "reopened") !== (issue.state === "open"))
      throw new SupportsGithubError("DELIVERY");
    return { issue, events };
  }
  async function importComment(
    tx: DatabaseTransaction,
    binding: GithubBinding,
    comment: GithubComment,
  ) {
    const key = `github:comment:${comment.id}`;
    const [seen] = await tx.select().from(messages).where(eq(messages.sourceKey, key));
    if (seen) return;
    const own = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.ticketId, binding.ticketId),
          eq(jobs.direction, "outbound"),
          eq(jobs.kind, "comment"),
        ),
      );
    const echo =
      comment.user?.id === repository.botUserId &&
      own.find((job) => hasMarker(comment.body, job.id));
    if (echo) {
      if (echo.state !== "redacted")
        await tx.update(jobs).set({ state: "done", failure: null }).where(eq(jobs.id, echo.id));
      await tx.insert(messages).values({
        sourceKey: key,
        ticketId: binding.ticketId,
        jobId: echo.id,
        remoteId: comment.id,
        redacted: echo.state === "redacted" ? 1 : 0,
      });
      return;
    }
    const sourceUrl = `${issueHref(repository, binding.issueNumber!)}#issuecomment-${comment.id}`;
    const body = sourceMarkdown(comment.body, sourceUrl);
    const tooLong = comment.body.length > IMPORT_LIMIT || body.length > IMPORT_LIMIT;
    await add(tx, binding.ticketId, key, "inbound", "comment", {
      body: tooLong ? "" : body,
      tooLong,
      author: actor(comment.user),
      sourceAt: comment.created_at,
      remoteId: comment.id,
      sourceUrl,
    });
  }
  async function observe(
    tx: DatabaseTransaction,
    binding: GithubBinding,
    issue: GithubIssue,
    events: GithubEvent[],
  ) {
    const transitions = events.filter((event) => ["closed", "reopened"].includes(event.event));
    const latest = transitions.at(-1);
    const external = transitions.filter((event) => event.actor?.id !== repository.botUserId).at(-1);
    const revision = latest ? String(latest.id) : "initial";
    const externalRevision = external ? String(external.id) : "";
    if (binding.remoteRevision !== revision && latest) {
      const key = `github:status:${issue.id}:${revision}`;
      const [seen] = await tx.select().from(messages).where(eq(messages.sourceKey, key));
      if (!seen && latest.actor?.id !== repository.botUserId) {
        const id = `github-status:${String(latest.id).padStart(20, "0")}`;
        await supports.apply(tx, binding.ticketId, {
          id,
          kind: "status",
          body: "",
          status: fromGithubStatus(issue),
          author: actor(latest.actor),
          createdAt: latest.created_at,
        });
        await tx.insert(messages).values({
          sourceKey: key,
          ticketId: binding.ticketId,
          activityId: id,
          remoteId: latest.id,
        });
      }
    }
    await tx
      .update(bindings)
      .set({ remoteRevision: revision, externalRevision })
      .where(eq(bindings.ticketId, binding.ticketId));
    return externalRevision;
  }
  /** Validates and durably accepts supported GitHub events. The host maps errors to HTTP responses. */
  async function receiveWebhook(input: {
    body: Uint8Array;
    signature: string;
    deliveryId: string;
    event: string;
  }) {
    if (!(input.body instanceof Uint8Array) || input.body.length > 1024 * 1024)
      throw new SupportsGithubError("INVALID");
    const signature = z
      .string()
      .regex(/^sha256=[a-f0-9]{64}$/)
      .safeParse(input.signature);
    if (!signature.success) throw new SupportsGithubError("FORBIDDEN");
    const expected = createHmac("sha256", secret).update(input.body).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.data.slice(7), "hex")))
      throw new SupportsGithubError("FORBIDDEN");
    const deliveryId = z.string().min(1).max(200).parse(input.deliveryId);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(input.body));
    } catch {
      throw new SupportsGithubError("INVALID");
    }
    if (!["issues", "issue_comment"].includes(input.event)) return { accepted: false };
    const payload = z
      .object({
        action: z.string(),
        installation: z.object({ id: z.number().int().positive() }),
        repository: z.object({ id: z.number().int().positive(), private: z.boolean() }),
        issue: githubIssue,
        comment: githubComment.optional(),
      })
      .parse(raw);
    if (
      payload.installation.id !== repository.installationId ||
      payload.repository.id !== repository.id ||
      !payload.repository.private
    )
      throw new SupportsGithubError("FORBIDDEN");
    if (
      payload.issue.pull_request !== undefined ||
      (input.event === "issue_comment"
        ? payload.action !== "created"
        : !["opened", "closed", "reopened", "deleted", "transferred"].includes(payload.action))
    )
      return { accepted: false };
    if (input.event === "issue_comment" && !payload.comment)
      throw new SupportsGithubError("INVALID");
    const hash = digest(input.body);
    return db.transaction(async (tx) => {
      const receipt = await tx
        .insert(deliveries)
        .values({ id: deliveryId, fingerprint: hash })
        .onConflictDoNothing()
        .returning();
      if (!receipt.length) {
        const [previous] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId));
        if (previous.fingerprint !== hash) throw new SupportsGithubError("CONFLICT");
        return { accepted: true };
      }
      const [found] = await tx
        .select()
        .from(bindings)
        .where(
          and(eq(bindings.repositoryId, repository.id), eq(bindings.issueId, payload.issue.id)),
        );
      // Unrelated issues are never imported; creation recovery discovers the original marker.
      if (!found) return { accepted: false };
      const binding = await locked(tx, found.ticketId);
      if (!binding) return { accepted: false };
      configured(binding);
      if (input.event === "issue_comment") await importComment(tx, binding, payload.comment!);
      else
        await add(
          tx,
          binding.ticketId,
          `webhook:${deliveryId}`,
          "inbound",
          ["deleted", "transferred"].includes(payload.action) ? "missing" : "status",
          {},
        );
      return { accepted: true };
    });
  }
  async function acquire(id: string) {
    return db.transaction(async (tx) => {
      const binding = await locked(tx, id);
      if (!binding || (binding.leaseUntil && binding.leaseUntil > new Date())) return null;
      if (binding.lease) {
        await tx
          .update(jobs)
          .set({ state: "blocked", failure: "UNCERTAIN" })
          .where(and(eq(jobs.ticketId, id), eq(jobs.state, "sending")));
      }
      const lease = randomUUID();
      await tx
        .update(bindings)
        .set({ lease, leaseUntil: new Date(Date.now() + leaseMs) })
        .where(eq(bindings.ticketId, id));
      return { ...binding, lease, leaseUntil: new Date(Date.now() + leaseMs) };
    });
  }
  async function fenced<T>(
    binding: GithubBinding,
    action: (tx: DatabaseTransaction, current: GithubBinding) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const current = await locked(tx, binding.ticketId);
      if (
        !current ||
        current.lease !== binding.lease ||
        !current.leaseUntil ||
        current.leaseUntil <= new Date()
      )
        throw new SupportsGithubError("CONFLICT");
      return action(tx, current);
    });
  }
  async function release(binding: GithubBinding) {
    await db
      .update(bindings)
      .set({ lease: null, leaseUntil: null })
      .where(and(eq(bindings.ticketId, binding.ticketId), eq(bindings.lease, binding.lease!)));
  }
  async function fail(binding: GithubBinding, job: GithubJob | null, error: unknown) {
    const failure =
      error instanceof SupportsGithubError ? error : new SupportsGithubError("DELIVERY");
    if (failure.code === "CONFLICT") return;
    const reason: SupportsGithubFailure =
      failure.uncertain || job?.failure === "UNCERTAIN" || job?.state === "sending"
        ? "UNCERTAIN"
        : ["ACCESS", "REPOSITORY", "MISSING", "TOO_LONG"].includes(failure.code)
          ? (failure.code as SupportsGithubFailure)
          : "DELIVERY";
    await fenced(binding, async (tx) => {
      if (!job || ["REPOSITORY", "MISSING", "ACCESS"].includes(reason))
        await tx
          .update(bindings)
          .set({ failure: reason })
          .where(eq(bindings.ticketId, binding.ticketId));
      if (job)
        await tx
          .update(jobs)
          .set({
            state: retryable(reason) ? "failed" : "blocked",
            failure: reason,
            availableAt: new Date(
              Date.now() +
                (retryable(reason)
                  ? Math.max(
                      failure.retryAfter,
                      Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)),
                    ) * 1000
                  : 0),
            ),
          })
          .where(eq(jobs.id, job.id));
    });
  }
  async function recoverUncertain(binding: GithubBinding, job: GithubJob) {
    await github.verify();
    if (job.kind === "create") {
      const found = (await github.issues()).filter(
        (issue) =>
          issue.user?.id === repository.botUserId &&
          issue.pull_request === undefined &&
          hasMarker(issue.body, job.id),
      );
      if (found.length > 1) throw new SupportsGithubError("CONFLICT");
      if (found.length !== 1) return false;
      await completeCreate(binding, job, found[0]);
      return true;
    }
    await verifyIssue(binding);
    if (job.kind === "comment") {
      const found = (await github.comments(binding.issueNumber!)).filter(
        (comment) => comment.user?.id === repository.botUserId && hasMarker(comment.body, job.id),
      );
      if (found.length > 1) throw new SupportsGithubError("CONFLICT");
      if (found.length !== 1) return false;
      await completeComment(binding, job, found[0]);
      return true;
    }
    // Status uncertainty is resolved from confirmed state; it is never replayed automatically.
    return false;
  }
  async function completeCreate(binding: GithubBinding, job: GithubJob, issue: GithubIssue) {
    if (
      issue.user?.id !== repository.botUserId ||
      issue.pull_request !== undefined ||
      !hasMarker(issue.body, job.id)
    )
      throw new SupportsGithubError("UNCERTAIN", true);
    await fenced(binding, async (tx) => {
      await tx
        .update(bindings)
        .set({
          issueId: issue.id,
          issueNumber: issue.number,
          issueUrl: issueHref(repository, issue.number),
          remoteRevision: "initial",
          failure: null,
        })
        .where(eq(bindings.ticketId, binding.ticketId));
      await tx.update(jobs).set({ state: "done", failure: null }).where(eq(jobs.id, job.id));
      await tx
        .insert(messages)
        .values({
          sourceKey: `github:issue:${issue.id}`,
          ticketId: binding.ticketId,
          jobId: job.id,
          remoteId: issue.id,
        })
        .onConflictDoNothing();
    });
  }
  async function completeComment(binding: GithubBinding, job: GithubJob, comment: GithubComment) {
    if (comment.user?.id !== repository.botUserId || !hasMarker(comment.body, job.id))
      throw new SupportsGithubError("UNCERTAIN", true);
    await fenced(binding, async (tx) => {
      await tx.update(jobs).set({ state: "done", failure: null }).where(eq(jobs.id, job.id));
      await tx
        .insert(messages)
        .values({
          sourceKey: `github:comment:${comment.id}`,
          ticketId: binding.ticketId,
          jobId: job.id,
          remoteId: comment.id,
        })
        .onConflictDoNothing();
    });
  }
  async function deliver(binding: GithubBinding, job: GithubJob) {
    if (job.direction === "inbound") {
      await verifyIssue(binding);
      if (job.kind === "missing") throw new SupportsGithubError("MISSING");
      if (job.kind === "status") {
        const { issue, events } = await confirmedStatus(binding);
        await fenced(binding, async (tx, current) => {
          await observe(tx, current, issue, events);
          await tx
            .update(jobs)
            .set({ state: "done", failure: null, payload: {} })
            .where(eq(jobs.id, job.id));
        });
      } else {
        const { payload } = job;
        const source = payload.sourceUrl!;
        const body = payload.body!;
        const tooLong = payload.tooLong === true;
        const imported = tooLong
          ? `This GitHub reply exceeds the import limit and was not copied. [Read the original reply](${source}).`
          : body || `[View the original reply](${source}).`;
        await fenced(binding, async (tx) => {
          const [seen] = await tx
            .select()
            .from(messages)
            .where(eq(messages.sourceKey, job.sourceKey));
          if (!seen) {
            const activityId = `github-comment:${String(payload.remoteId).padStart(20, "0")}`;
            await supports.apply(tx, binding.ticketId, {
              id: activityId,
              kind: "comment",
              body: imported,
              status: null,
              author: payload.author!,
              createdAt: payload.sourceAt!,
            });
            await tx.insert(messages).values({
              sourceKey: job.sourceKey,
              ticketId: binding.ticketId,
              jobId: job.id,
              remoteId: payload.remoteId,
              activityId,
            });
          }
          await tx
            .update(jobs)
            .set({
              state: tooLong ? "blocked" : "done",
              failure: tooLong ? "TOO_LONG" : null,
              payload: { sourceUrl: source, remoteId: payload.remoteId },
            })
            .where(eq(jobs.id, job.id));
        });
      }
      return;
    }
    await github.verify();
    if (job.kind !== "create") await verifyIssue(binding);
    let reclose = false;
    if (job.kind === "status") {
      const { issue, events } = await confirmedStatus(binding);
      reclose =
        issue.state === "closed" &&
        job.payload.status !== "open" &&
        fromGithubStatus(issue) !== job.payload.status;
      const allowed = await fenced(binding, async (tx, current) => {
        const revision = await observe(tx, current, issue, events);
        if (job.payload.baseRevision !== revision) {
          await tx
            .update(jobs)
            .set({ state: "done", failure: "STALE_STATUS", payload: {} })
            .where(eq(jobs.id, job.id));
          return false;
        }
        return true;
      });
      if (!allowed) return;
    }
    // Commit intent before contacting GitHub; a crashed worker leaves recoverable uncertainty.
    await fenced(binding, async (tx) => {
      await tx
        .update(jobs)
        .set({ state: "sending", attemptedAt: new Date(), attempts: job.attempts + 1 })
        .where(eq(jobs.id, job.id));
    });
    let written = false;
    try {
      if (job.kind === "create") {
        const issue = await github.create(
          job.payload.title!,
          `${job.payload.body}\n\n${marker(job.id)}`,
        );
        written = true;
        await completeCreate(binding, job, issue);
      } else if (job.kind === "comment") {
        const comment = await github.comment(
          binding.issueNumber!,
          `${job.payload.body}\n\n${marker(job.id)}`,
        );
        written = true;
        await completeComment(binding, job, comment);
      } else {
        // GitHub only guarantees a new close reason when the state changes.
        if (reclose) {
          await github.setStatus(binding.issueNumber!, "open");
          written = true;
          const { issue, events } = await confirmedStatus(binding);
          const allowed = await fenced(binding, async (tx, current) => {
            const revision = await observe(tx, current, issue, events);
            if (revision === job.payload.baseRevision) return true;
            await tx
              .update(jobs)
              .set({ state: "done", failure: "STALE_STATUS", payload: {} })
              .where(eq(jobs.id, job.id));
            return false;
          });
          if (!allowed) return;
        }
        await github.setStatus(binding.issueNumber!, job.payload.status!);
        written = true;
        const { issue, events } = await confirmedStatus(binding);
        if (fromGithubStatus(issue) !== job.payload.status)
          throw new SupportsGithubError("UNCERTAIN", true);
        await fenced(binding, async (tx, current) => {
          await observe(tx, current, issue, events);
          await tx
            .update(jobs)
            .set({ state: "done", failure: null, payload: {} })
            .where(eq(jobs.id, job.id));
        });
      }
    } catch (error) {
      if (written) throw new SupportsGithubError("UNCERTAIN", true);
      throw error;
    }
  }
  /** Trusted host scheduler, normally once per minute. No user credentials are accepted here. */
  async function process(limit = 20) {
    limitSchema.parse(limit);
    const candidates = await db
      .select({ ticketId: bindings.ticketId })
      .from(bindings)
      .orderBy(asc(bindings.reconciledAt))
      .limit(50);
    let examined = 0;
    for (const candidate of candidates) {
      if (examined >= limit) break;
      const binding = await acquire(candidate.ticketId);
      if (!binding) continue;
      let job: GithubJob | null = null;
      try {
        configured(binding);
        if (binding.failure) continue;
        const work = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.ticketId, binding.ticketId), inArray(jobs.state, [...activeStates])))
          .orderBy(asc(jobs.createdAt), asc(jobs.id));
        // Inbound comments can arrive while an outbound write is uncertain; keep them readable.
        job =
          work.find(
            (entry) =>
              entry.direction === "inbound" &&
              entry.state !== "blocked" &&
              entry.availableAt <= new Date(),
          ) ??
          work.find((entry) => entry.failure !== "TOO_LONG") ??
          null;
        if (!job || job.availableAt > new Date()) continue;
        examined++;
        if (job.state === "blocked" || job.state === "sending") {
          if (job.failure === "UNCERTAIN" || job.state === "sending")
            await recoverUncertain(binding, job);
          continue;
        }
        await deliver(binding, job);
      } catch (error) {
        await fail(binding, job, error);
      } finally {
        await db
          .update(bindings)
          .set({ reconciledAt: new Date() })
          .where(eq(bindings.ticketId, binding.ticketId));
        await release(binding);
      }
    }
    return { examined, ...(await health()) };
  }
  /** Trusted scheduler, normally every fifteen minutes; imports only already-linked issues. */
  async function reconcile(limit = 20) {
    limitSchema.parse(limit);
    const candidates = await db
      .select()
      .from(bindings)
      .orderBy(asc(bindings.reconciledAt))
      .limit(limit);
    let examined = 0;
    for (const candidate of candidates) {
      const binding = await acquire(candidate.ticketId);
      if (!binding) continue;
      try {
        configured(binding);
        if ((binding.failure && binding.failure !== "DELIVERY") || !binding.issueNumber) continue;
        const { issue, events } = await confirmedStatus(binding);
        const comments = await github.commentPage(binding.issueNumber, binding.commentPage);
        await fenced(binding, async (tx, current) => {
          await observe(tx, current, issue, events);
          for (const comment of comments) await importComment(tx, current, comment);
          await tx
            .update(bindings)
            .set({
              failure: null,
              commentPage: comments.length === 100 ? current.commentPage + 1 : 1,
            })
            .where(eq(bindings.ticketId, binding.ticketId));
        });
        examined++;
      } catch (error) {
        await fail(binding, null, error);
      } finally {
        await db
          .update(bindings)
          .set({ reconciledAt: new Date() })
          .where(eq(bindings.ticketId, binding.ticketId));
        await release(binding);
      }
    }
    return { examined, ...(await health()) };
  }
  async function health() {
    const counts = await db
      .select({ state: jobs.state, count: count() })
      .from(jobs)
      .groupBy(jobs.state);
    const [broken] = await db
      .select({ count: count() })
      .from(bindings)
      .where(isNotNull(bindings.failure));
    return {
      pending: counts
        .filter((row) => row.state === "pending" || row.state === "sending")
        .reduce((total, row) => total + row.count, 0),
      failed: counts.find((row) => row.state === "failed")?.count ?? 0,
      blocked: (counts.find((row) => row.state === "blocked")?.count ?? 0) + (broken?.count ?? 0),
    };
  }
  async function operator(context: Context) {
    if (!(await options.authorizeOperator(context))) throw new SupportsGithubError("FORBIDDEN");
  }
  /** Server-only recovery; an operator must inspect GitHub before confirming an unsent write. */
  async function recover(
    context: Context,
    raw: { ticketId: string; jobId: string; resolution: "unsent" | "delivered"; remoteId?: number },
  ) {
    await operator(context);
    const input = z
      .object({
        ticketId: supportIdSchema,
        jobId: z.uuid(),
        resolution: z.enum(["unsent", "delivered"]),
        remoteId: z.number().int().positive().safe().optional(),
      })
      .parse(raw);
    const binding = await acquire(input.ticketId);
    if (!binding) throw new SupportsGithubError("CONFLICT");
    try {
      configured(binding);
      await github.verify();
      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), eq(jobs.ticketId, input.ticketId)));
      if (
        !job ||
        job.direction !== "outbound" ||
        job.state !== "blocked" ||
        job.failure !== "UNCERTAIN"
      )
        throw new SupportsGithubError("CONFLICT");
      if (input.resolution === "delivered") {
        if (job.kind === "create") {
          if (!input.remoteId) throw new SupportsGithubError("INVALID");
          await completeCreate(binding, job, await github.issue(input.remoteId));
        } else if (job.kind === "comment") {
          await verifyIssue(binding);
          const comment = (await github.comments(binding.issueNumber!)).find(
            (entry) => entry.id === input.remoteId,
          );
          if (!comment) throw new SupportsGithubError("INVALID");
          await completeComment(binding, job, comment);
        } else {
          const { issue, events } = await confirmedStatus(binding);
          await fenced(binding, async (tx, current) => {
            await observe(tx, current, issue, events);
            await tx
              .update(jobs)
              .set({ state: "done", failure: null, payload: {} })
              .where(eq(jobs.id, job.id));
          });
        }
      } else {
        if (await recoverUncertain(binding, job)) throw new SupportsGithubError("CONFLICT");
        await fenced(binding, async (tx) => {
          await tx
            .update(jobs)
            .set({ state: "pending", failure: null, availableAt: new Date() })
            .where(eq(jobs.id, job.id));
        });
      }
    } finally {
      await release(binding);
    }
  }
  async function resume(context: Context, id: string) {
    await operator(context);
    const binding = await acquire(supportIdSchema.parse(id));
    if (!binding) throw new SupportsGithubError("CONFLICT");
    try {
      configured(binding);
      await github.verify();
      if (binding.issueNumber) await verifyIssue(binding);
      await fenced(binding, async (tx) => {
        await tx.update(bindings).set({ failure: null }).where(eq(bindings.ticketId, id));
        await tx
          .update(jobs)
          .set({ state: "done", failure: null })
          .where(and(eq(jobs.ticketId, id), eq(jobs.kind, "missing")));
        await tx
          .update(jobs)
          .set({ state: "pending", failure: null, availableAt: new Date() })
          .where(
            and(
              eq(jobs.ticketId, id),
              eq(jobs.state, "blocked"),
              inArray(jobs.failure, ["REPOSITORY", "MISSING"]),
            ),
          );
      });
    } finally {
      await release(binding);
    }
  }
  function safe<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      try {
        return await action(...args);
      } catch (error) {
        if (error instanceof SupportsGithubError) throw error;
        if (error instanceof z.ZodError) throw new SupportsGithubError("INVALID");
        if (error instanceof SupportsError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
          throw new SupportsGithubError("FORBIDDEN");
        throw new SupportsGithubError("DELIVERY");
      }
    };
  }
  return {
    enqueue,
    client(context: Context): SupportsGithubClient {
      const actions = client(context);
      return {
        get: safe((id: string) => actions.get(id)),
        exportTicket: safe((id: string) => actions.exportTicket(id)),
        retry: safe((id: string) => actions.retry(id)),
      };
    },
    receiveWebhook: safe(receiveWebhook),
    process,
    reconcile,
    health,
    recover: safe(recover),
    resume: safe(resume),
  };
}

import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import test from "node:test";

import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const schema =
  await import("../../registry/components/connectors/supports-github/server/schema.ts");
const { createSupportsGithub } =
  await import("../../registry/components/connectors/supports-github/server/service.server.ts");
import * as core from "../../registry/components/plugins/supports/server/schema.ts";
const { createSupportsStorage } =
  await import("../../registry/components/plugins/supports/server/storage.server.ts");
import { pluginLocks } from "../../registry/components/utils/database.ts";
import { generatedMigration } from "../persistence/migrations.mjs";
import { githubMock } from "./github-mock.mjs";

await test("Supports–GitHub transactional delivery and recovery", async (t) => {
  const connection = "postgres://blogs_test:local_blogs_test_only@127.0.0.1:55440/blogs_test";
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const name = `supports_github_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(connection);
  url.pathname = name;
  const pool = postgres(url.href, { max: 8, onnotice: () => {} });
  const db = drizzle({ client: pool });
  t.after(async () => {
    await pool.end();
    await root`drop database if exists ${root(name)}`;
    await root.end();
  });
  await root`create database ${root(name)}`;
  for (const statement of await generatedMigration({}, { ...core, ...schema, pluginLocks }))
    await pool.unsafe(statement);
  const secret = "disposable-webhook-secret-only";
  async function fixture() {
    for (const table of [
      schema.supportsGithubMessages,
      schema.supportsGithubJobs,
      schema.supportsGithubDeliveries,
      schema.supportsGithubBindings,
      core.supportsAttachments,
      core.supportsMutations,
      core.supportsActivity,
      core.supportsTickets,
    ])
      await db.delete(table);
    const remote = githubMock();
    let failEnqueue = false;
    let denied = false;
    const storage = createSupportsStorage({
      db,
      keyPrefix: "test-site/supports/",
      resolveActor: async (context) =>
        context === "staff"
          ? { id: "staff", name: "Alex Morgan", kind: "staff" }
          : context === "customer"
            ? { id: "customer", name: "Customer", kind: "customer" }
            : null,
      authorize: async () => !denied,
      onMutation: async (tx, event) => {
        if (failEnqueue) throw new Error("queue unavailable");
        await connector.enqueue(tx, event);
      },
    });
    const options = {
      db,
      supports: storage.integration,
      repository: remote.repository,
      request: remote.request,
      getAccessToken: async () => "test-installation-token",
      webhookSecret: secret,
      ticketUrl: (id) => `https://site.example/intranet/supports/${id}`,
      authorizeOperator: async (context) => context === "operator",
    };
    const connector = createSupportsGithub(options);
    const staff = storage.client("staff");
    const ui = connector.client("staff");
    const create = (extra = {}) =>
      staff.create({
        requestId: randomUUID(),
        title: "Contact form",
        description: "No confirmation",
        type: "bug",
        attachmentIds: [],
        ...extra,
      });
    const comment = (id, body, extra = {}) =>
      staff.comment({ id, body, requestId: randomUUID(), attachmentIds: [], ...extra });
    async function drain(rounds = 8) {
      for (let i = 0; i < rounds; i++) await connector.process(50);
    }
    async function linked(extra = {}) {
      const ticket = await create(extra);
      await drain(2);
      const binding = (
        await db
          .select()
          .from(schema.supportsGithubBindings)
          .where(eq(schema.supportsGithubBindings.ticketId, ticket.id))
      )[0];
      return { ticket, number: binding.issueNumber };
    }
    async function webhook(number, action, entry, overrides = {}) {
      const payload = {
        action,
        installation: { id: remote.repository.installationId },
        repository: { id: remote.repository.id, private: true },
        issue: remote.issues.find((issue) => issue.number === number),
        ...(entry ? { comment: entry } : {}),
        ...overrides,
      };
      const body = Buffer.from(JSON.stringify(payload));
      return connector.receiveWebhook({
        body,
        signature: `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
        deliveryId: randomUUID(),
        event: entry ? "issue_comment" : "issues",
      });
    }
    return {
      remote,
      connector,
      storage,
      staff,
      ui,
      options,
      create,
      comment,
      linked,
      drain,
      webhook,
      failEnqueue: (value) => {
        failEnqueue = value;
      },
      deny: (value) => {
        denied = value;
      },
    };
  }
  await t.test(
    "local creation and queue commit atomically; duplicate requests create one job",
    async () => {
      const f = await fixture();
      f.failEnqueue(true);
      await assert.rejects(f.create(), (error) => error.code === "STORAGE");
      assert.equal((await f.staff.list({})).total, 0);
      assert.equal((await db.select().from(schema.supportsGithubJobs)).length, 0);
      f.failEnqueue(false);
      const requestId = randomUUID();
      const [first, second] = await Promise.all([f.create({ requestId }), f.create({ requestId })]);
      assert.equal(first.id, second.id);
      assert.equal((await db.select().from(schema.supportsGithubJobs)).length, 1);
      assert.equal(f.remote.calls.length, 0);
      await Promise.all([f.connector.process(), f.connector.process()]);
      assert.equal(f.remote.issues.length, 1);
      assert.equal((await f.ui.get(first.id)).state, "synchronized");
      f.failEnqueue(true);
      await assert.rejects(f.comment(first.id, "Must roll back"));
      await assert.rejects(f.staff.setStatus(first.id, "closed"));
      const detail = await f.staff.get(first.id);
      assert.equal(detail.activity.length, 0);
      assert.equal(detail.ticket.status, "open");
    },
  );
  await t.test(
    "a database failure after GitHub commits remains uncertain, including failed reconciliation",
    async () => {
      const f = await fixture();
      const ticket = await f.create();
      await pool.unsafe(
        `create function reject_completion() returns trigger language plpgsql as $$ begin if NEW.state = 'done' then raise exception 'simulated persistence failure'; end if; return NEW; end $$`,
      );
      await pool.unsafe(
        `create trigger reject_completion before update on supports_github_job for each row execute function reject_completion()`,
      );
      try {
        await f.connector.process();
        assert.equal(f.remote.issues.length, 1);
        assert.equal((await f.ui.get(ticket.id)).failure, "UNCERTAIN");
        f.remote.settings.denied = true;
        await f.connector.process();
        assert.equal((await f.ui.get(ticket.id)).failure, "UNCERTAIN");
        await assert.rejects(f.ui.retry(ticket.id));
      } finally {
        await pool.unsafe(`drop trigger reject_completion on supports_github_job`);
        await pool.unsafe(`drop function reject_completion()`);
      }
      f.remote.settings.denied = false;
      await f.drain(2);
      assert.equal(f.remote.issues.length, 1);
      assert.equal((await f.ui.get(ticket.id)).state, "synchronized");
    },
  );
  await t.test(
    "reconciliation checkpoints large discussions without persisting signed image URLs",
    async () => {
      const f = await fixture();
      const { ticket, number } = await f.linked();
      for (let i = 0; i < 1001; i++) f.remote.externalComment(number, `Reply ${i}`);
      f.remote.externalComment(
        number,
        "![capture](https://images.example/picture.png?token=private-secret)",
      );
      for (let i = 0; i < 11; i++) await f.connector.reconcile();
      const work = await db
        .select()
        .from(schema.supportsGithubJobs)
        .where(eq(schema.supportsGithubJobs.direction, "inbound"));
      assert.equal(work.length, 1002);
      assert(!JSON.stringify(work).includes("private-secret"));
      assert(work.some((job) => job.payload.body.includes("image not copied")));
      await f.connector.reconcile();
      assert.equal(
        (
          await db
            .select()
            .from(schema.supportsGithubJobs)
            .where(eq(schema.supportsGithubJobs.direction, "inbound"))
        ).length,
        1002,
      );
      assert.equal((await f.ui.get(ticket.id)).pending, 1002);
    },
  );
  await t.test(
    "staff guards reject customers, anonymous callers, denied staff and non-operators",
    async () => {
      const f = await fixture();
      const { ticket } = await f.linked();
      for (const context of ["customer", "anonymous"]) {
        await assert.rejects(
          f.connector.client(context).get(ticket.id),
          (error) => error.code === "FORBIDDEN",
        );
        await assert.rejects(
          f.connector.client(context).exportTicket(ticket.id),
          (error) => error.code === "FORBIDDEN",
        );
        await assert.rejects(
          f.connector.client(context).retry(ticket.id),
          (error) => error.code === "FORBIDDEN",
        );
      }
      await assert.rejects(
        f.connector.resume("staff", ticket.id),
        (error) => error.code === "FORBIDDEN",
      );
      f.deny(true);
      await assert.rejects(f.ui.get(ticket.id));
    },
  );
  await t.test("lost issue and comment responses reconcile without repeating writes", async () => {
    const f = await fixture();
    f.remote.settings.lose = "create";
    const ticket = await f.create();
    await f.connector.process();
    assert.equal((await f.ui.get(ticket.id)).failure, "UNCERTAIN");
    await assert.rejects(f.ui.retry(ticket.id), (error) => error.code === "CONFLICT");
    await f.drain(2);
    assert.equal(f.remote.issues.length, 1);
    f.remote.settings.lose = "comment";
    await f.comment(ticket.id, "Hello @maintainer");
    await f.connector.process();
    assert.equal((await f.ui.get(ticket.id)).failure, "UNCERTAIN");
    await f.drain(2);
    assert.equal(f.remote.comments.get(1).length, 1);
    assert.match(f.remote.comments.get(1)[0].body, /@maintainer/);
    assert.equal((await f.ui.get(ticket.id)).state, "synchronized");
  });
  await t.test(
    "uncertain writes without a remote match require explicit operator recovery",
    async () => {
      const f = await fixture();
      const ticket = await f.create();
      const [job] = await db.select().from(schema.supportsGithubJobs);
      await db
        .update(schema.supportsGithubJobs)
        .set({ state: "sending" })
        .where(eq(schema.supportsGithubJobs.id, job.id));
      await db
        .update(schema.supportsGithubBindings)
        .set({ lease: "crashed-worker", leaseUntil: new Date(0) });
      await f.drain(2);
      assert.equal(f.remote.issues.length, 0);
      await assert.rejects(
        f.connector.recover("staff", { ticketId: ticket.id, jobId: job.id, resolution: "unsent" }),
      );
      await f.connector.recover("operator", {
        ticketId: ticket.id,
        jobId: job.id,
        resolution: "unsent",
      });
      await f.drain(2);
      assert.equal(f.remote.issues.length, 1);
    },
  );
  await t.test(
    "private repository validation, safe retry and changed configuration preserve local content",
    async () => {
      const f = await fixture();
      const ticket = await f.create();
      f.remote.settings.private = false;
      await f.connector.process();
      assert.equal(f.remote.issues.length, 0);
      assert.equal((await f.ui.get(ticket.id)).failure, "REPOSITORY");
      f.remote.settings.private = true;
      await f.connector.resume("operator", ticket.id);
      await f.drain();
      f.remote.settings.denied = true;
      await f.comment(ticket.id, "Saved locally");
      await f.connector.process();
      assert.equal((await f.ui.get(ticket.id)).failure, "ACCESS");
      f.remote.settings.denied = false;
      await f.ui.retry(ticket.id);
      await f.drain();
      assert.equal(f.remote.comments.get(1).length, 1);
      const changed = createSupportsGithub({
        ...f.options,
        repository: { ...f.options.repository, id: 999 },
      });
      await f.comment(ticket.id, "Keep original destination");
      await changed.process();
      assert.equal((await changed.client("staff").get(ticket.id)).failure, "REPOSITORY");
      assert.equal(f.remote.issues.length, 1);
      assert.equal((await f.staff.get(ticket.id)).activity.length, 2);
    },
  );
  await t.test(
    "signed webhooks deduplicate messages and ignore unrelated issues, edits and bot echoes",
    async () => {
      const f = await fixture();
      const { ticket, number } = await f.linked();
      const entry = f.remote.externalComment(number, "Reply from GitHub");
      await f.webhook(number, "created", entry);
      await f.webhook(number, "created", entry);
      await f.drain();
      assert.equal((await f.staff.get(ticket.id)).activity.length, 1);
      await f.webhook(number, "edited", { ...entry, body: "Edited remotely" });
      await f.connector.reconcile();
      await f.drain();
      assert.equal((await f.staff.get(ticket.id)).activity[0].body, "Reply from GitHub");
      await f.comment(ticket.id, "Local response");
      await f.drain();
      await f.webhook(number, "created", f.remote.comments.get(number).at(-1));
      await f.drain();
      assert.equal((await f.staff.get(ticket.id)).activity.length, 2);
      await assert.rejects(
        f.webhook(number, "created", entry, { installation: { id: 999 } }),
        (error) => error.code === "FORBIDDEN",
      );
      await assert.rejects(
        f.connector.receiveWebhook({
          body: Buffer.from("{}"),
          signature: `sha256=${"0".repeat(64)}`,
          event: "issues",
          deliveryId: randomUUID(),
        }),
        (error) => error.code === "FORBIDDEN",
      );
      assert.equal(
        (
          await f.webhook(number, "created", entry, {
            issue: { ...f.remote.issues[0], id: 9999, number: 999 },
          })
        ).accepted,
        false,
      );
    },
  );
  await t.test(
    "newer external status supersedes queued local intent; reordered webhooks use confirmed state",
    async () => {
      const f = await fixture();
      const { ticket, number } = await f.linked();
      await f.staff.setStatus(ticket.id, "closed");
      f.remote.setStatus(number, { state: "closed", state_reason: "not_planned" });
      await f.connector.process();
      assert.equal((await f.staff.get(ticket.id)).ticket.status, "canceled");
      assert.equal(f.remote.calls.filter((call) => call.method === "PATCH").length, 0);
      await f.staff.setStatus(ticket.id, "open");
      await f.drain();
      assert.equal(f.remote.issues[0].state, "open");
      f.remote.setStatus(number, { state: "closed", state_reason: "completed" });
      const old = { ...f.remote.issues[0] };
      f.remote.setStatus(number, { state: "open", state_reason: "reopened" });
      await f.webhook(number, "closed", null, { issue: old });
      await f.drain();
      assert.equal((await f.staff.get(ticket.id)).ticket.status, "open");
    },
  );
  await t.test(
    "changing a closed ticket to canceled reopens before setting the new close reason",
    async () => {
      const f = await fixture();
      const { ticket } = await f.linked();
      await f.staff.setStatus(ticket.id, "closed");
      await f.drain(2);
      await f.staff.setStatus(ticket.id, "canceled");
      await f.drain(2);
      assert.equal(f.remote.issues[0].state_reason, "not_planned");
      assert.equal((await f.ui.get(ticket.id)).state, "synchronized");
      assert.deepEqual(
        f.remote.calls.filter((call) => call.method === "PATCH").map((call) => call.body.state),
        ["closed", "open", "closed"],
      );
    },
  );
  await t.test(
    "historical export is explicit, complete, ordered and safe against concurrent replies",
    async () => {
      const f = await fixture();
      const localOnly = createSupportsStorage({
        db,
        keyPrefix: "test-site/supports/",
        resolveActor: async () => ({ id: "staff", name: "Alex", kind: "staff" }),
        authorize: async () => true,
      }).client("staff");
      const ticket = await localOnly.create({
        requestId: randomUUID(),
        title: "Old ticket",
        description: "Original",
        type: "support",
        attachmentIds: [],
      });
      for (let i = 0; i < 55; i++)
        await localOnly.comment({
          requestId: randomUUID(),
          id: ticket.id,
          body: `Historical ${i}`,
          attachmentIds: [],
        });
      await localOnly.setStatus(ticket.id, "canceled");
      await f.comment(ticket.id, "Still local");
      await f.drain(2);
      assert.equal(f.remote.issues.length, 0);
      await Promise.all([
        f.ui.exportTicket(ticket.id),
        f.comment(ticket.id, "Concurrent reply"),
        f.ui.exportTicket(ticket.id),
      ]);
      await f.drain(65);
      assert.equal(f.remote.issues.length, 1);
      assert.equal(f.remote.comments.get(1).length, 58);
      assert.equal(f.remote.issues[0].state_reason, "not_planned");
      assert.match(f.remote.comments.get(1)[0].body, /Historical 0/);
      assert.match(f.remote.comments.get(1).at(-1).body, /Concurrent reply/);
    },
  );
  await t.test(
    "image-only and long external replies remain meaningful; oversized replies are explicit",
    async () => {
      const f = await fixture();
      const { ticket, number } = await f.linked();
      await f.webhook(
        number,
        "created",
        f.remote.externalComment(
          number,
          "![Screenshot](https://github.com/user-attachments/assets/abcdef)",
        ),
      );
      await f.webhook(number, "created", f.remote.externalComment(number, "x".repeat(6000)));
      await f.webhook(number, "created", f.remote.externalComment(number, "x".repeat(65537)));
      await f.drain();
      const detail = await f.staff.get(ticket.id);
      assert.match(detail.activity[0].body, /image not copied/);
      assert.equal(detail.activity[1].body.length, 6000);
      assert.match(detail.activity[2].body, /exceeds the import limit/);
      assert.equal((await f.ui.get(ticket.id)).failure, "TOO_LONG");
      await f.comment(ticket.id, "Later reply still works");
      await f.drain();
      assert.equal(
        f.remote.comments.get(number).filter((entry) => entry.user.id === f.remote.bot.id).length,
        1,
      );
    },
  );
  await t.test(
    "private local attachment metadata is forwarded as filenames and ticket links only",
    async () => {
      const f = await fixture();
      const { ticket } = await f.linked();
      const id = randomUUID();
      await db.insert(core.supportsAttachments).values({
        id,
        actorId: "staff",
        requestId: randomUUID(),
        fingerprint: "fixture",
        name: "Screen.png",
        contentType: "image/png",
        size: 100,
        key: `test-site/supports/${id}/screen.png`,
        state: "ready",
        expiresAt: new Date(Date.now() + 60000),
      });
      await f.comment(ticket.id, "", { attachmentIds: [id] });
      await f.drain();
      const body = f.remote.comments.get(1)[0].body;
      assert.match(body, /Images were not copied/);
      assert.match(body, /Screen.png/);
      assert.match(body, /https:\/\/site.example\/intranet\/supports\//);
      assert.doesNotMatch(body, /test-site\/supports|X-Amz|!\[/);
    },
  );
  await t.test(
    "missing issues block delivery and redaction tombstones prevent re-import",
    async () => {
      const f = await fixture();
      const { ticket, number } = await f.linked();
      const entry = f.remote.externalComment(number, "Remove this secret");
      await f.webhook(number, "created", entry);
      await f.drain();
      const key = `github:comment:${entry.id}`;
      const [message] = await db
        .select()
        .from(schema.supportsGithubMessages)
        .where(eq(schema.supportsGithubMessages.sourceKey, key));
      await db.transaction(async (tx) => {
        await f.storage.integration.lock(tx, ticket.id);
        await tx
          .update(core.supportsActivity)
          .set({ body: "Removed by operator" })
          .where(eq(core.supportsActivity.id, message.activityId));
        await tx
          .update(schema.supportsGithubMessages)
          .set({ redacted: 1 })
          .where(eq(schema.supportsGithubMessages.sourceKey, key));
        await tx
          .update(schema.supportsGithubJobs)
          .set({ state: "redacted", payload: {} })
          .where(eq(schema.supportsGithubJobs.sourceKey, key));
      });
      await f.webhook(number, "created", entry);
      await f.connector.reconcile();
      await f.drain();
      assert.equal((await f.staff.get(ticket.id)).activity[0].body, "Removed by operator");
      f.remote.settings.moved = true;
      await f.comment(ticket.id, "Keep pending");
      await f.drain(2);
      assert.equal((await f.ui.get(ticket.id)).failure, "MISSING");
      assert.equal(f.remote.issues.length, 1);
      assert.equal(
        (
          await db
            .select()
            .from(schema.supportsGithubJobs)
            .where(
              and(
                eq(schema.supportsGithubJobs.ticketId, ticket.id),
                eq(schema.supportsGithubJobs.state, "blocked"),
              ),
            )
        ).length,
        1,
      );
    },
  );
});

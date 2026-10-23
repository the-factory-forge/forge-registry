import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createBlogsStorage } =
  await import("../../registry/components/plugins/blogs/server/storage.server.ts");
const { canAccessBlog } = await import("../../registry/components/plugins/blogs/permissions.ts");
const { emptyContent, slugify } = await import("../../registry/components/plugins/blogs/utils.ts");
const connection = "postgres://blogs_test:local_blogs_test_only@127.0.0.1:55440/blogs_test";
const request = () => ({ requestId: randomUUID() });
const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
  "base64",
);

await test("localized history uses transactional PostgreSQL and private image references", async (t) => {
  const schema = `history_${randomUUID().replaceAll("-", "")}`;
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const pool = postgres(connection, {
    max: 8,
    connection: { search_path: schema },
    onnotice: () => {},
  });
  const db = drizzle(pool);
  const s3 = new S3Client({
    endpoint: "http://127.0.0.1:19040",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "blogs_test", secretAccessKey: "local_blogs_test_only" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const bucket = `history-${randomUUID()}`;
  const accounts = new Map([
    ["alice", { id: "alice", name: "Alice", admin: false }],
    ["bob", { id: "bob", name: "Bob", admin: false }],
    ["admin", { id: "admin", name: "Admin", admin: true }],
  ]);
  const options = {
    db,
    s3,
    bucket,
    keyPrefix: "history-test/blogs/",
    locales: ["en", "fr"],
    authorize: async (context, permission, id) => {
      const actor = accounts.get(context);
      const [row] = id ? await pool`select document from blogs_article where id=${id}` : [];
      return canAccessBlog(actor ?? null, permission, row?.document.shared.author?.id);
    },
    resolveEditor: async (context) => accounts.get(context),
    resolveAuthor: async (_, id) => accounts.get(id) ?? null,
    resolveAuthorNames: async (ids) =>
      ids.flatMap((id) => (accounts.has(id) ? [accounts.get(id)] : [])),
  };
  const storage = createBlogsStorage(options);
  const alice = storage.client("alice"),
    bob = storage.client("bob"),
    admin = storage.client("admin");
  const target = (
    article,
    versionId = article.translations.en.history.currentId,
    locale = "en",
  ) => ({ id: article.id, version: article.version, locale, versionId });
  const save = (client, article, title, { locale = "en", origin, shared, markdown = title } = {}) =>
    client.save({
      ...request(),
      id: article.id,
      version: article.version,
      locale,
      origin,
      shared: shared ?? article.translations[locale]?.shared ?? article.shared,
      content: {
        ...emptyContent,
        title,
        slug: `${slugify(title)}-${article.id.slice(0, 8)}`,
        markdown,
      },
    });
  const create = (title) => alice.create({ ...request(), title, locale: "en" });
  const publish = (client, article, locale = "en") =>
    client.publish({ ...request(), id: article.id, version: article.version, locale });
  const headers = (client, article, locale = "en") =>
    client.history.list({ id: article.id, locale });
  const snapshot = (client, article, versionId, locale = "en") =>
    client.history.get({ id: article.id, locale, versionId });
  const upload = (article) =>
    storage.upload("alice", {
      ...request(),
      id: article.id,
      name: "illustration.png",
      contentType: "image/png",
      bytes: image,
    });

  try {
    await root`create schema ${root(schema)}`;
    await pool.unsafe(
      await readFile(
        new URL("../../registry/components/plugins/blogs/server/migration.sql", import.meta.url),
        "utf8",
      ),
    );
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));

    await t.test("saves persist complete snapshots and suppress unchanged inputs", async () => {
      let article = await create("Persistence");
      article = await save(alice, article, "First", { markdown: "Private historical paragraph" });
      const original = await snapshot(alice, article, article.translations.en.history.currentId);
      const savedVersion = article.version;
      article = await save(bob, article, "First", { markdown: "Private historical paragraph" });
      assert.equal(article.version, savedVersion);
      assert.equal(article.editor.id, "alice");
      article = await publish(alice, article);
      article = await save(alice, article, "Latest");
      article = await publish(alice, article);
      const list = await headers(bob, article);
      assert.equal(list.length, 2);
      assert.ok(list.every((header) => !("content" in header) && !("shared" in header)));
      assert.equal(
        (await snapshot(bob, article, original.id)).content.markdown,
        original.content.markdown,
      );
      assert.ok(!JSON.stringify(await alice.get(article.id)).includes(original.content.markdown));
      assert.ok(
        !JSON.stringify(await alice.list({ locale: "en" })).includes(original.content.markdown),
      );
      assert.ok(
        !JSON.stringify(
          await storage.getPublished("en", article.translations.en.published.slug),
        ).includes(original.content.markdown),
      );
      const [journal] =
        await pool`select result from blogs_mutation where result->>'id'=${article.id} order by id limit 1`;
      assert.deepEqual(journal.result, { id: article.id });
    });

    await t.test(
      "draft limits span independent reprises and retain separate language counters",
      async () => {
        let article = await save(alice, await create("Retention"), "Source");
        article = await publish(alice, article);
        const sourceId = article.translations.en.history.publishedId;
        for (let index = 0; index < 9; index++)
          article = await save(alice, article, `Path ${index}`, {
            origin: { versionId: sourceId, repriseId: randomUUID() },
          });
        const english = await headers(alice, article);
        assert.equal(english.filter((header) => header.state === "draft").length, 8);
        assert.equal(
          new Set(
            english.filter((header) => header.state === "draft").map((header) => header.repriseId),
          ).size,
          8,
        );
        assert.equal(
          english.some((header) => header.number === 2),
          false,
        );
        article = await save(alice, article, "French draft", { locale: "fr" });
        assert.equal(article.translations.fr.history.lastNumber, 1);
        assert.equal((await headers(alice, article)).length, 9);
        assert.equal((await headers(alice, article, "fr")).length, 1);
      },
    );

    await t.test(
      "normal publication caps publications without duplicating content identities",
      async () => {
        let article = await create("Publication cap");
        for (let index = 0; index < 6; index++) {
          article = await save(alice, article, `Published ${index}`);
          const id = article.translations.en.history.currentId;
          article = await publish(alice, article);
          assert.equal(article.translations.en.history.publishedId, id);
        }
        const retained = await headers(alice, article);
        assert.equal(retained.length, 5);
        assert.ok(retained.every((header) => header.state === "publication"));
        assert.ok(!retained.some((header) => header.number === 1));
      },
    );

    await t.test(
      "historical return requires a current plan at every publish entrypoint",
      async () => {
        let article = await save(alice, await create("Return"), "Before");
        article = await publish(alice, article);
        const source = article.translations.en.history.publishedId;
        article = await save(alice, article, "After");
        article = await publish(alice, article);
        const later = article.translations.en.history.publishedId;
        article = await save(alice, article, "Reworked before", {
          origin: { versionId: source, repriseId: randomUUID() },
        });
        await rejected(publish(alice, article), "HISTORY_CONFIRMATION_REQUIRED");
        const pending = await headers(alice, article);
        const plan = await alice.history.plan(target(article));
        assert.deepEqual(await headers(alice, article), pending);
        assert.deepEqual(
          plan.discarded.map((header) => header.id),
          [later],
        );
        assert.equal(
          (await storage.getPublished("en", article.translations.en.published.slug)).title,
          "After",
        );
        const stale = {
          ...target(article),
          ...request(),
          token: plan.token,
          omitMissingImages: false,
        };
        article = await save(alice, article, "Changed while confirming");
        const beforeFailure = await headers(alice, article);
        await rejected(alice.history.publish(stale), "CONFLICT");
        assert.deepEqual(await headers(alice, article), beforeFailure);
        const refreshed = await alice.history.plan(target(article));
        const input = {
          ...target(article),
          ...request(),
          token: refreshed.token,
          omitMissingImages: false,
        };
        article = await alice.history.publish(input);
        const after = await headers(alice, article);
        const replay = await alice.history.publish(input);
        assert.equal(replay.version, article.version);
        assert.deepEqual(await headers(alice, article), after);
        assert.ok(!after.some((header) => header.id === later));
        assert.equal(article.translations.en.published.title, "Changed while confirming");
        assert.equal(article.translations.en.history.lastNumber, 4);
      },
    );

    await t.test(
      "a database failure after history writes rolls back publication and deletions",
      async () => {
        let article = await save(alice, await create("Rollback"), "Original");
        article = await publish(alice, article);
        const original = article.translations.en.history.publishedId;
        article = await save(alice, article, "Successor");
        article = await publish(alice, article);
        const before = await alice.get(article.id);
        const retained = await headers(alice, article);
        const plan = await alice.history.plan(target(article, original));
        await pool.unsafe(
          "create function fail_history_write() returns trigger language plpgsql as $$ begin raise exception 'forced transaction rollback'; end $$",
        );
        await pool.unsafe(
          `create trigger fail_history_write before update on blogs_article for each row when (old.id='${article.id}') execute function fail_history_write()`,
        );
        try {
          await rejected(
            alice.history.publish({
              ...target(article, original),
              ...request(),
              token: plan.token,
              omitMissingImages: false,
            }),
            "STORAGE",
          );
        } finally {
          await pool.unsafe(
            "drop trigger fail_history_write on blogs_article; drop function fail_history_write()",
          );
        }
        assert.deepEqual(await alice.get(article.id), before);
        assert.deepEqual(await headers(alice, article), retained);
      },
    );

    await t.test(
      "staff inspect history but current ownership controls restore and deletion",
      async () => {
        let article = await save(alice, await create("Ownership"), "Alice signature");
        article = await publish(alice, article);
        const original = article.translations.en.history.publishedId;
        assert.equal((await headers(bob, article)).length, 1);
        await rejected(bob.history.plan(target(article)), "FORBIDDEN");
        await rejected(bob.history.delete({ ...target(article), ...request() }), "FORBIDDEN");
        await rejected(
          save(bob, article, "Forbidden resume", {
            origin: { versionId: original, repriseId: randomUUID() },
          }),
          "FORBIDDEN",
        );
        article = await save(admin, article, "Bob signature", {
          shared: {
            ...article.translations.en.shared,
            author: { id: "bob", name: "Untrusted browser name" },
          },
        });
        assert.equal(article.shared.author.id, "bob");
        assert.equal(article.shared.author.name, "Bob");
        await rejected(alice.history.plan(target(article, original)), "FORBIDDEN");
        const plan = await bob.history.plan(target(article, original));
        article = await bob.history.publish({
          ...target(article, original),
          ...request(),
          token: plan.token,
          omitMissingImages: false,
        });
        assert.equal(article.shared.author.id, "bob");
        assert.equal(article.translations.en.published.shared.author.id, "alice");
        await rejected(
          storage
            .client("stranger")
            .history.get({ id: article.id, locale: "en", versionId: original }),
          "FORBIDDEN",
        );
      },
    );

    await t.test(
      "unknown historical signatures require administrator review without inferring the current author",
      async () => {
        let article = await save(alice, await create("Unknown historical author"), "Legacy text");
        article = await publish(alice, article);
        const legacy = structuredClone(article);
        delete legacy.shared.author;
        for (const translation of Object.values(legacy.translations)) {
          delete translation.shared;
          delete translation.history;
          if (translation.published) delete translation.published.shared.author;
        }
        await pool`delete from blogs_history where article_id=${article.id}`;
        await pool`update blogs_article set document=${JSON.stringify(legacy)}::jsonb where id=${article.id}`;
        await db.transaction((tx) => storage.backfillHistory(tx));
        article = await admin.get(article.id);
        const unknownSource = article.translations.en.history.publishedId;
        article = await save(admin, article, "Reviewed current author", {
          shared: { ...article.translations.en.shared, author: { id: "bob", name: "Bob" } },
        });
        article = await publish(bob, article);
        const unknown = await snapshot(bob, article, unknownSource);
        article = await save(bob, article, "Edited unknown history", {
          origin: { versionId: unknownSource, repriseId: randomUUID() },
          shared: unknown.shared,
        });
        const saved = await snapshot(bob, article, article.translations.en.history.currentId);
        assert.equal(saved.shared.author, undefined);
        assert.equal(article.shared.author.id, "bob");
        await rejected(bob.history.plan(target(article)), "AUTHOR_REQUIRED");
        await rejected(
          save(bob, article, "Owner cannot confirm history", {
            origin: { versionId: unknownSource, repriseId: randomUUID() },
            shared: { ...unknown.shared, author: { id: "bob", name: "Bob" } },
          }),
          "FORBIDDEN",
        );
        article = await save(admin, article, "Administrator reviewed history", {
          origin: { versionId: unknownSource, repriseId: randomUUID() },
          shared: { ...unknown.shared, author: { id: "bob", name: "Bob" } },
        });
        const plan = await bob.history.plan(target(article));
        article = await bob.history.publish({
          ...target(article),
          ...request(),
          token: plan.token,
          omitMissingImages: false,
        });
        assert.equal(article.translations.en.published.shared.author.id, "bob");
        assert.equal((await snapshot(bob, article, unknownSource)).shared.author, undefined);
      },
    );

    await t.test("foreign snapshot IDs and languages cannot cross article boundaries", async () => {
      const first = await save(alice, await create("Boundary one"), "One");
      const second = await save(alice, await create("Boundary two"), "Two");
      const foreign = second.translations.en.history.currentId;
      await rejected(snapshot(alice, first, foreign), "NOT_FOUND");
      await rejected(
        snapshot(alice, first, first.translations.en.history.currentId, "fr"),
        "NOT_FOUND",
      );
      await rejected(
        save(alice, first, "Bad source", { origin: { versionId: foreign } }),
        "NOT_FOUND",
      );
      assert.equal((await alice.get(first.id)).version, first.version);
    });

    await t.test(
      "a saved reprise keeps its provenance after its source publication is deleted",
      async () => {
        let article = await save(alice, await create("Pruned source"), "Original source");
        article = await publish(alice, article);
        const source = article.translations.en.history.publishedId;
        article = await save(alice, article, "Later publication");
        article = await publish(alice, article);
        const later = article.translations.en.history.publishedId;
        article = await save(alice, article, "Independent draft", {
          origin: { versionId: source, repriseId: randomUUID() },
        });
        const draft = await snapshot(alice, article, article.translations.en.history.currentId);
        article = await alice.history.delete({ ...target(article, source), ...request() });
        article = await save(alice, article, "Continued draft", {
          origin: { versionId: draft.id },
        });
        const continued = await snapshot(alice, article, article.translations.en.history.currentId);
        assert.equal(continued.repriseId, draft.repriseId);
        assert.equal(continued.sourcePublicationId, source);
        assert.equal(continued.sourcePublicationOrder, draft.sourcePublicationOrder);
        assert.ok(
          (await alice.history.plan(target(article))).discarded.some(
            (header) => header.id === later,
          ),
        );
      },
    );

    await t.test("concurrent saves allocate exactly one new content version", async () => {
      const article = await save(alice, await create("Concurrency"), "Base");
      const result = await Promise.allSettled([
        save(alice, article, "Concurrent one"),
        save(alice, article, "Concurrent two"),
      ]);
      assert.equal(result.filter((entry) => entry.status === "fulfilled").length, 1);
      assert.equal(result.find((entry) => entry.status === "rejected").reason.code, "CONFLICT");
      assert.equal((await headers(alice, article)).length, 2);
    });

    await t.test(
      "only retained references protect image bytes and history images stay private",
      async () => {
        let article = await create("Image retention");
        const asset = await upload(article);
        article = await save(alice, article, "With image", {
          shared: { ...article.shared, thumbnailId: asset.id },
        });
        article = await publish(alice, article);
        const source = article.translations.en.history.publishedId;
        article = await save(alice, article, "Without image", {
          shared: { ...article.translations.en.shared, thumbnailId: null },
        });
        article = await publish(alice, article);
        const [object] =
          await pool`update blogs_object set created_at=now()-interval '2 days' where id=${asset.id} returning key`;
        await storage.maintenance();
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: object.key }));
        await rejected(storage.readImage(asset.id), "NOT_FOUND");
        assert.deepEqual(Buffer.from((await storage.readImage(asset.id, "bob")).bytes), image);
        article = await alice.history.delete({ ...target(article, source), ...request() });
        await storage.maintenance();
        await assert.rejects(
          s3.send(new HeadObjectCommand({ Bucket: bucket, Key: object.key })),
          (error) => error.$metadata.httpStatusCode === 404,
        );
        assert.equal((await pool`select id from blogs_object where id=${asset.id}`).length, 0);
      },
    );

    await t.test(
      "confirmed missing illustrations can be omitted without rewriting the source",
      async () => {
        let article = await create("Missing image");
        const asset = await upload(article);
        article = await save(alice, article, "Illustrated", {
          markdown: `Text ![illustration](./assets/${asset.id})`,
          shared: { ...article.shared, thumbnailId: asset.id },
        });
        article = await publish(alice, article);
        const source = article.translations.en.history.publishedId;
        const saved = await snapshot(alice, article, source);
        const [object] = await pool`select key from blogs_object where id=${asset.id}`;
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.key }));
        const plan = await alice.history.plan(target(article, source));
        assert.deepEqual(plan.missingAssetIds, [asset.id]);
        await rejected(
          alice.history.publish({
            ...target(article, source),
            ...request(),
            token: plan.token,
            omitMissingImages: false,
          }),
          "HISTORY_CONFIRMATION_REQUIRED",
        );
        article = await alice.history.publish({
          ...target(article, source),
          ...request(),
          token: plan.token,
          omitMissingImages: true,
        });
        const live = await storage.getPublished("en", article.translations.en.published.slug);
        assert.equal(live.shared.thumbnailId, null);
        assert.ok(!live.assetIds.includes(asset.id));
        const original = await snapshot(alice, article, source);
        assert.deepEqual(original.content, saved.content);
        assert.deepEqual(original.shared, saved.shared);
      },
    );

    await t.test("provider timeouts cannot be confirmed as missing images", async () => {
      let article = await create("Temporary image outage");
      const asset = await upload(article);
      article = await save(alice, article, "Retry image", {
        shared: { ...article.shared, thumbnailId: asset.id },
      });
      const offline = createBlogsStorage({
        ...options,
        s3: {
          send: async (command) => {
            if (command instanceof HeadObjectCommand)
              throw Object.assign(new Error("temporary timeout"), { name: "TimeoutError" });
            return s3.send(command);
          },
        },
      });
      const before = await headers(alice, article);
      await rejected(offline.client("alice").history.plan(target(article)), "STORAGE");
      const plan = await alice.history.plan(target(article));
      await rejected(
        offline.client("alice").history.publish({
          ...target(article),
          ...request(),
          token: plan.token,
          omitMissingImages: true,
        }),
        "STORAGE",
      );
      assert.deepEqual(await headers(alice, article), before);
      assert.equal((await alice.get(article.id)).version, article.version);
    });

    await t.test(
      "migration preserves current states and repeats without allocating content",
      async () => {
        let article = await save(alice, await create("Migration"), "Legacy publication");
        article = await publish(alice, article);
        const publication = structuredClone(article.translations.en.published);
        const version = article.version;
        await pool`delete from blogs_history where article_id=${article.id}`;
        await pool`update blogs_article set document=document #- '{translations,en,history}' #- '{translations,en,shared}' where id=${article.id}`;
        const incremental = await readFile(
          new URL(
            "../../registry/components/plugins/blogs/server/history-migration.sql",
            import.meta.url,
          ),
          "utf8",
        );
        await pool.unsafe(incremental);
        const first = await db.transaction((tx) => storage.backfillHistory(tx));
        assert.equal(first.updated, 1);
        article = await alice.get(article.id);
        const seeded = await headers(alice, article);
        assert.equal(seeded.length, 1);
        assert.equal(seeded[0].state, "publication");
        assert.equal(article.version, version);
        assert.deepEqual(article.translations.en.published, publication);
        await pool.unsafe(incremental);
        assert.equal((await db.transaction((tx) => storage.backfillHistory(tx))).updated, 0);
        assert.deepEqual(await headers(alice, article), seeded);
      },
    );

    await t.test(
      "migration captures distinct drafts and publications in each language",
      async () => {
        let article = await save(alice, await create("Localized migration"), "Published English");
        article = await publish(alice, article);
        article = await save(alice, article, "Published French", { locale: "fr" });
        article = await publish(alice, article, "fr");
        article = await save(alice, article, "Pending English");
        const before = structuredClone(article);
        const legacy = structuredClone(article);
        for (const translation of Object.values(legacy.translations)) {
          delete translation.history;
          delete translation.shared;
        }
        await pool`delete from blogs_history where article_id=${article.id}`;
        await pool`update blogs_article set document=${JSON.stringify(legacy)}::jsonb where id=${article.id}`;
        await db.transaction((tx) => storage.backfillHistory(tx));
        article = await alice.get(article.id);
        assert.deepEqual(article.translations.en.draft, before.translations.en.draft);
        assert.deepEqual(article.translations.en.published, before.translations.en.published);
        assert.deepEqual(article.translations.fr.published, before.translations.fr.published);
        const english = await headers(alice, article);
        const french = await headers(alice, article, "fr");
        assert.equal(english.length, 2);
        assert.equal(french.length, 1);
        assert.equal(
          english.find((header) => header.state === "draft").sourcePublicationId,
          english.find((header) => header.state === "publication").id,
        );
        assert.equal(article.version, before.version);
      },
    );

    await t.test(
      "trusted renames and departing signatures include retained snapshots without new versions",
      async () => {
        let article = await save(alice, await create("Name retention"), "Old signature");
        const original = article.translations.en.history.currentId;
        article = await publish(alice, article);
        article = await save(alice, article, "New text");
        accounts.set("alice", { ...accounts.get("alice"), name: "Alice renamed" });
        assert.equal(
          (await snapshot(alice, article, original)).shared.author.name,
          "Alice renamed",
        );
        const before = (await headers(alice, article)).map((header) => header.id);
        await db.transaction((tx) =>
          storage.snapshotAuthorName(tx, { id: "alice", name: "Alice final signature" }),
        );
        accounts.delete("alice");
        assert.equal(
          (await snapshot(admin, article, original)).shared.author.name,
          "Alice final signature",
        );
        assert.deepEqual(
          (await headers(admin, article)).map((header) => header.id),
          before,
        );
        accounts.set("alice", { id: "alice", name: "Alice", admin: false });
      },
    );

    await t.test(
      "history survives a fresh process without object storage configuration",
      async () => {
        const article = await save(alice, await create("Restart"), "Persistent history");
        const source = new URL(
          "../../registry/components/plugins/blogs/server/storage.server.ts",
          import.meta.url,
        ).href;
        const script = `
        import './tests/drive-storage/register.mjs';
        import assert from 'node:assert/strict';
        import postgres from 'postgres';
        import { drizzle } from 'drizzle-orm/postgres-js';
        const { createBlogsStorage } = await import(${JSON.stringify(source)});
        const pool = postgres(${JSON.stringify(connection)}, { max: 2, connection: { search_path: ${JSON.stringify(schema)} } });
        try {
          const client = createBlogsStorage({ db: drizzle(pool), keyPrefix: 'history-test/blogs/', locales: ['en','fr'], authorize: async () => true, resolveEditor: async () => ({id:'alice',name:'Alice'}) }).client('alice');
          const headers = await client.history.list({id:${JSON.stringify(article.id)},locale:'en'});
          assert.equal(headers.length,1);
          const saved = await client.history.get({id:${JSON.stringify(article.id)},locale:'en',versionId:headers[0].id});
          assert.equal(saved.content.markdown,'Persistent history');
        } finally { await pool.end(); }
      `;
        await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
          cwd: process.cwd(),
        });
      },
    );
  } finally {
    try {
      const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
      for (const object of objects.Contents ?? [])
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    } finally {
      await pool.end();
      await root.unsafe(`drop schema if exists "${schema}" cascade`);
      await root.end();
      s3.destroy();
    }
  }
});

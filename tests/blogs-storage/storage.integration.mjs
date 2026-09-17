import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const { createBlogsStorage } =
  await import("../../registry/components/plugins/blogs/server/storage.server.ts");
const { emptyContent } = await import("../../registry/components/plugins/blogs/utils.ts");

const pool = postgres("postgres://blogs_test:local_blogs_test_only@127.0.0.1:55440/blogs_test", {
    prepare: false,
    max: 8,
  }),
  db = drizzle(pool);
const s3 = new S3Client({
  endpoint: "http://127.0.0.1:19040",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "blogs_test", secretAccessKey: "local_blogs_test_only" },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const bucket = "forge-blogs-integration";
const options = {
  db,
  s3,
  bucket,
  locales: ["en", "fr"],
  authorize: async (ctx, permission, id) =>
    ctx !== "stranger" &&
    (ctx !== "reader" || permission === "read") &&
    (ctx !== "restricted" || id === undefined || id === visibleId),
  resolveEditor: async (ctx) => ({
    id: ctx,
    name: ctx === "jordan" ? "Jordan Lee" : "Alex Morgan",
  }),
};
let visibleId;
const storage = createBlogsStorage(options),
  client = storage.client("jordan");
const request = () => ({ requestId: randomUUID() });
const input = (article, locale = "en") => ({
  id: article.id,
  version: article.version,
  locale,
  ...request(),
});
const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const image = await readFile(new URL("../../public/blogs/studio-1.png", import.meta.url));

test("private blog persistence, publication boundaries, retries, and recovery", async (t) => {
  t.after(async () => {
    s3.destroy();
    await pool.end();
  });
  if (process.env.BLOGS_TEST_PHASE === "restart") {
    const post = await storage.getPublished("en", "restart-proof");
    assert.ok(post);
    assert.equal(post.markdown, "Persisted Markdown");
    assert.deepEqual(Buffer.from((await storage.readImage(post.shared.thumbnailId)).bytes), image);
    return;
  }
  await pool.unsafe(
    "DROP TABLE IF EXISTS blogs_mutation,blogs_object,blogs_category,blogs_article CASCADE",
  );
  await pool.unsafe(
    await readFile(
      new URL("../../registry/components/plugins/blogs/server/migration.sql", import.meta.url),
      "utf8",
    ),
  );
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)) throw error;
  }
  let article = await client.create({ title: "A private draft", locale: "en", ...request() });
  visibleId = article.id;
  const second = await client.create({ title: "Another article", locale: "en", ...request() });
  await t.test("authorization and scoped lists", async () => {
    await rejected(storage.client("stranger").get(article.id), "FORBIDDEN");
    await rejected(
      storage.client("reader").create({ title: "No", locale: "en", ...request() }),
      "FORBIDDEN",
    );
    await rejected(storage.client("restricted").get(second.id), "FORBIDDEN");
    const page = await storage.client("restricted").list({ locale: "en" });
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, article.id);
    assert.equal((await storage.listPublished({ locale: "en" })).total, 0);
  });
  const category = await client.saveCategory({
    parentId: null,
    translations: { en: { name: "Ideas", slug: "ideas" }, fr: { name: "Idées", slug: "idees" } },
    ...request(),
  });
  const child = await client.saveCategory({
    parentId: category.id,
    translations: { en: { name: "Design", slug: "design" } },
    ...request(),
  });
  const imageInput = {
    id: article.id,
    name: "photo.png",
    contentType: "image/png",
    bytes: image,
    ...request(),
  };
  const asset = await storage.upload("jordan", imageInput);
  assert.deepEqual(await storage.upload("jordan", imageInput), asset);
  await t.test("private media, image validation, and foreign asset IDs", async () => {
    await rejected(storage.readImage(asset.id), "NOT_FOUND");
    assert.deepEqual(Buffer.from((await storage.readImage(asset.id, "jordan")).bytes), image);
    await rejected(storage.readImage(asset.id, "stranger"), "FORBIDDEN");
    await rejected(
      storage.upload("jordan", { ...imageInput, ...request(), contentType: "image/jpeg" }),
      "INVALID",
    );
    await rejected(
      storage.upload("jordan", {
        ...imageInput,
        ...request(),
        bytes: Buffer.from("<script>bad</script>"),
      }),
      "INVALID",
    );
    await rejected(
      storage.upload("jordan", {
        ...imageInput,
        ...request(),
        bytes: new Uint8Array(11 * 1024 * 1024),
      }),
      "INVALID",
    );
    await rejected(
      client.save({
        ...input(second),
        content: {
          ...emptyContent,
          title: "Foreign",
          slug: "foreign",
          markdown: `![bad](./assets/${asset.id})`,
        },
        shared: second.shared,
      }),
      "NOT_FOUND",
    );
  });
  const shared = { thumbnailId: asset.id, bannerId: asset.id, categoryIds: [child.id] };
  const draft = {
    ...input(article),
    content: {
      ...emptyContent,
      title: "Published title",
      slug: "first-post",
      markdown: `# Hello\n\n![Photo][image]\n\n[image]: ./assets/${asset.id}`,
    },
    shared,
  };
  article = await client.save(draft);
  const savedVersion = article.version;
  assert.equal((await client.save(draft)).version, savedVersion);
  await rejected(
    client.save({ ...draft, content: { ...draft.content, title: "Tampered" } }),
    "CONFLICT",
  );
  article = await client.publish(input(article));
  const published = await storage.getPublished("en", "first-post");
  assert.equal(published.title, "Published title");
  assert.deepEqual(Buffer.from((await storage.readImage(asset.id)).bytes), image);
  assert.equal((await storage.listPublished({ locale: "en", categoryId: category.id })).total, 1);
  assert.equal((await storage.listPublished({ locale: "en" })).categoryCounts[category.id], 1);
  await t.test("independent translation snapshots and taxonomy labels", async () => {
    article = await client.save({
      ...input(article, "fr"),
      shared,
      content: { ...emptyContent, title: "Un article", slug: "un-article", markdown: "Bonjour" },
    });
    await rejected(client.publish(input(article, "fr")), "INVALID");
    await client.saveCategory({
      ...child,
      translations: { ...child.translations, fr: { name: "Design", slug: "design" } },
      ...request(),
    });
    article = await storage.client("alex").publish(input(article, "fr"));
    assert.equal((await storage.getPublished("fr", "un-article")).editor.name, "Alex Morgan");
    assert.deepEqual(await storage.getPublished("en", "first-post"), published);
    article = await client.save({
      ...input(article),
      shared: { ...shared, thumbnailId: null, categoryIds: [] },
      content: { ...draft.content, title: "Unpublished title" },
    });
    assert.deepEqual(await storage.getPublished("en", "first-post"), published);
    await rejected(client.deleteCategory({ id: child.id, version: 2, ...request() }), "IN_USE");
    article = await client.unpublish(input(article));
    assert.equal(await storage.getPublished("en", "first-post"), null);
    // French still references the shared image.
    await storage.readImage(asset.id);
    article = await client.unpublish(input(article, "fr"));
    await rejected(storage.readImage(asset.id), "NOT_FOUND");
  });
  await t.test("concurrent writes and slug conflicts", async () => {
    const old = article;
    const results = await Promise.allSettled(
      ["One", "Two"].map((title) =>
        client.save({ ...input(old), shared: old.shared, content: { ...draft.content, title } }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.code, "CONFLICT");
    article = await client.get(article.id);
    await rejected(
      client.save({
        ...input(second),
        shared: second.shared,
        content: { ...draft.content, markdown: "No images" },
      }),
      "CONFLICT",
    );
  });
  await t.test("database rollback and storage failure keep the previous draft", async () => {
    const before = await client.get(article.id);
    let rollback = false;
    const original = s3.send.bind(s3);
    s3.send = async (command, ...rest) => {
      // oxlint-disable-next-line typescript/await-thenable -- AWS's bound callback overload is synchronous, but this invocation returns a promise.
      const result = await original(command, ...rest);
      if (command instanceof PutObjectCommand) rollback = true;
      return result;
    };
    const failing = createBlogsStorage({
      ...options,
      db: {
        execute: db.execute.bind(db),
        transaction: (callback) =>
          db.transaction(async (tx) => {
            const result = await callback(tx);
            if (rollback) {
              rollback = false;
              throw new Error("Simulated commit failure");
            }
            return result;
          }),
      },
    });
    await rejected(
      failing.client("jordan").save({
        ...input(before),
        shared: before.shared,
        content: { ...draft.content, title: "Must roll back" },
      }),
      "STORAGE",
    );
    s3.send = original;
    assert.deepEqual(await client.get(article.id), before);
    s3.send = async (command, ...rest) => {
      if (command instanceof PutObjectCommand) throw new Error("S3 unavailable");
      return original(command, ...rest);
    };
    await rejected(
      client.save({ ...input(before), shared: before.shared, content: draft.content }),
      "STORAGE",
    );
    s3.send = original;
    assert.deepEqual(await client.get(article.id), before);
  });
  await t.test("cleanup preserves references and retries partial object deletion", async () => {
    await pool.unsafe("UPDATE blogs_object SET created_at=now()-interval '2 days'");
    const original = s3.send.bind(s3);
    let fail = true;
    s3.send = async (command, ...rest) => {
      if (command instanceof DeleteObjectCommand && fail) {
        fail = false;
        throw new Error("Partial deletion failure");
      }
      return original(command, ...rest);
    };
    const first = await storage.maintenance(100);
    assert.ok(first.failed.length);
    s3.send = original;
    await storage.maintenance(100);
    await client.get(article.id);
    await storage.readImage(asset.id, "jordan");
    const deletion = { id: article.id, version: article.version, ...request() };
    await client.delete(deletion);
    await client.delete(deletion);
    await rejected(storage.readImage(asset.id, "jordan"), "NOT_FOUND");
    // A deleted article cannot acquire new objects through a racing save.
    await rejected(
      client.save({ ...input(article), shared: article.shared, content: draft.content }),
      "NOT_FOUND",
    );
    for (let i = 0; i < 10; i++) await storage.maintenance(2);
    assert.equal(
      Number(
        (await pool`select count(*) from blogs_object where article_id=${article.id}`)[0].count,
      ),
      0,
    );
  });
  let durable = await client.create({ title: "Restart proof", locale: "en", ...request() });
  const durableAsset = await storage.upload("jordan", {
    ...imageInput,
    id: durable.id,
    ...request(),
  });
  durable = await client.save({
    ...input(durable),
    content: {
      ...emptyContent,
      title: "Restart proof",
      slug: "restart-proof",
      markdown: "Persisted Markdown",
    },
    shared: { thumbnailId: durableAsset.id, bannerId: null, categoryIds: [] },
  });
  await client.publish(input(durable));
  const objects = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: `blogs/${durable.id}/` }),
  );
  assert.ok(objects.Contents.some((o) => o.Key.endsWith("README.md")));
  const source = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objects.Contents.find((o) => o.Key.endsWith("README.md")).Key,
    }),
  );
  assert.equal(await source.Body.transformToString(), "Persisted Markdown");
});

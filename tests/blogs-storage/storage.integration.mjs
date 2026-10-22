import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  S3Client,
  CreateBucketCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
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
s3.middlewareStack.add(
  (next) => async (args) => {
    // Match providers such as Infomaniak that reject conditional object PUTs.
    if (args.request.method === "PUT" && args.request.headers["if-none-match"]) {
      throw Object.assign(new Error("Conditional object PUTs are not supported."), {
        name: "NotImplemented",
        $metadata: { httpStatusCode: 501 },
      });
    }
    return next(args);
  },
  { step: "build", name: "rejectConditionalUploads" },
);
const bucket = "forge-blogs-integration";
const options = {
  db,
  s3,
  bucket,
  keyPrefix: "storage-test/blogs/",
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
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
  "base64",
);

await test("private blog persistence, publication boundaries, retries, and recovery", async (t) => {
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
  await t.test("missing image configuration leaves text editing available", async () => {
    const objectsBefore = await pool`select id from blogs_object`;
    for (const missing of [
      { s3: undefined, bucket: undefined },
      { bucket: "" },
      { bucket: "   " },
    ]) {
      const local = createBlogsStorage({ ...options, ...missing });
      const editor = local.client("jordan");
      let draft = await editor.create({
        title: `Local ${randomUUID()}`,
        locale: "en",
        ...request(),
      });
      draft = await editor.save({
        ...input(draft),
        shared: draft.shared,
        content: { ...draft.translations.en.draft, markdown: "Text needs only PostgreSQL" },
      });
      const uploadInput = {
        id: draft.id,
        name: "photo.png",
        contentType: "image/png",
        bytes: image,
        ...request(),
      };
      await rejected(local.upload("stranger", uploadInput), "FORBIDDEN");
      await rejected(local.upload("jordan", uploadInput), "STORAGE_NOT_CONFIGURED");
      assert.deepEqual(await pool`select id from blogs_object`, objectsBefore);
      draft = await editor.publish(input(draft));
      const post = await local.getPublished("en", draft.translations.en.draft.slug);
      assert.equal(post.markdown, "Text needs only PostgreSQL");
      assert.equal((await editor.get(draft.id)).translations.en.draft.markdown, post.markdown);
      draft = await editor.unpublish(input(draft));
      assert.equal(await local.getPublished("en", draft.translations.en.draft.slug), null);
      await editor.delete({ id: draft.id, version: draft.version, ...request() });
      await rejected(local.maintenance(), "STORAGE_NOT_CONFIGURED");
    }
  });
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
  const banner = await storage.upload("jordan", { ...imageInput, ...request() });
  const inline = await storage.upload("jordan", { ...imageInput, ...request() });
  await t.test(
    "same-name images retain distinct scoped keys without conditional PUTs",
    async () => {
      const images = [asset, banner, inline];
      assert.equal(new Set(images.map((image) => image.id)).size, 3);
      const records =
        await pool`select id,key from blogs_object where article_id=${article.id} and state='ready'`;
      assert.equal(records.length, 3);
      for (const record of records) {
        assert.equal(record.key, `storage-test/blogs/${article.id}/${record.id}/photo-blog.png`);
        assert.deepEqual(Buffer.from((await storage.readImage(record.id, "jordan")).bytes), image);
      }
    },
  );
  await t.test(
    "image extensions follow verified bytes and legacy image keys stay readable",
    async () => {
      const uploaded = await storage.upload("jordan", {
        ...imageInput,
        name: "the_corner-logo_mark-white_bg.JPG",
        ...request(),
      });
      const [record] = await pool`select key from blogs_object where id=${uploaded.id}`;
      assert.ok(record.key.endsWith("/the_corner-blog-white_bg.png"));
      const legacyKey = record.key.replace(/[^/]+$/, "image");
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: legacyKey,
          CopySource: `${bucket}/${record.key}`,
        }),
      );
      await pool`update blogs_object set key=${legacyKey} where id=${uploaded.id}`;
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: record.key }));
      assert.deepEqual(Buffer.from((await storage.readImage(uploaded.id, "jordan")).bytes), image);
      await pool`update blogs_object set created_at=now()-interval '2 days' where id=${uploaded.id}`;
      await storage.maintenance();
      assert.equal((await pool`select id from blogs_object where id=${uploaded.id}`).length, 0);
      assert.equal(
        (await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: legacyKey }))).KeyCount,
        0,
      );
    },
  );
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
  await t.test("foreign stored keys cannot be read or deleted by maintenance", async () => {
    const [record] = await pool`select key from blogs_object where id=${asset.id}`;
    await pool`update blogs_object set key=${`other-site/blogs/${article.id}/${asset.id}/image`},created_at=now()-interval '2 days' where id=${asset.id}`;
    const send = s3.send.bind(s3);
    const objectRequests = [];
    s3.send = (command, ...rest) => {
      if (command.input.Key) objectRequests.push(command.input.Key);
      return send(command, ...rest);
    };
    try {
      await rejected(storage.readImage(asset.id, "jordan"), "STORAGE");
      assert.ok((await storage.maintenance(100)).failed.includes(asset.id));
      assert.deepEqual(objectRequests, []);
    } finally {
      s3.send = send;
      await pool`update blogs_object set key=${record.key},created_at=now() where id=${asset.id}`;
    }
  });
  const shared = { thumbnailId: asset.id, bannerId: banner.id, categoryIds: [child.id] };
  const draft = {
    ...input(article),
    content: {
      ...emptyContent,
      title: "Published title",
      slug: "first-post",
      markdown: `# Hello\n\n![Inline](./assets/${inline.id})\n\n![Photo][image]\n\n[image]: ./assets/${inline.id}`,
    },
    shared,
  };
  article = await client.save(draft);
  assert.equal(
    (await client.get(article.id)).translations.en.draft.markdown,
    draft.content.markdown,
  );
  const savedVersion = article.version;
  assert.equal((await client.save(draft)).version, savedVersion);
  await rejected(
    client.save({ ...draft, content: { ...draft.content, title: "Tampered" } }),
    "CONFLICT",
  );
  article = await client.publish(input(article));
  const published = await storage.getPublished("en", "first-post");
  assert.equal(published.title, "Published title");
  assert.equal(published.markdown, draft.content.markdown);
  assert.equal(published.shared.thumbnailId, asset.id);
  assert.equal(published.shared.bannerId, banner.id);
  assert.deepEqual(new Set(published.assetIds), new Set([asset.id, banner.id, inline.id]));
  for (const id of published.assetIds) {
    assert.deepEqual(Buffer.from((await storage.readImage(id)).bytes), image);
  }
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
  await t.test("database rollback preserves drafts; text survives an S3 outage", async () => {
    const before = await client.get(article.id);
    const failing = createBlogsStorage({
      ...options,
      db: {
        execute: db.execute.bind(db),
        transaction: (callback) =>
          db.transaction(async (tx) => {
            await callback(tx);
            throw new Error("Simulated commit failure");
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
    assert.deepEqual(await client.get(article.id), before);
    const original = s3.send.bind(s3);
    s3.send = async () => {
      throw new Error("S3 unavailable");
    };
    try {
      article = await client.save({
        ...input(before),
        shared: before.shared,
        content: draft.content,
      });
      assert.equal(article.translations.en.draft.markdown, draft.content.markdown);
      let text = await client.create({ title: "Text only", locale: "en", ...request() });
      text = await client.save({
        ...input(text),
        shared: text.shared,
        content: {
          ...emptyContent,
          title: "Text only",
          slug: "text-only",
          markdown: "Database text",
        },
      });
      text = await client.publish(input(text));
      assert.equal((await storage.getPublished("en", "text-only")).markdown, "Database text");
      assert.equal((await client.get(text.id)).translations.en.published.markdown, "Database text");
      await rejected(storage.upload("jordan", { ...imageInput, ...request() }), "STORAGE");
    } finally {
      s3.send = original;
    }
    assert.equal(
      Number((await pool`select count(*) from blogs_object where kind='markdown'`)[0].count),
      0,
    );
    const [row] = await pool`select document from blogs_article where id=${article.id}`;
    assert.equal(row.document.translations.en.draft.markdown, draft.content.markdown);
    await rejected(
      client.save({
        ...input(article),
        shared: article.shared,
        content: { ...draft.content, markdown: "x".repeat(1024 * 1024 + 1) },
      }),
      "INVALID",
    );
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
    await storage.readImage(banner.id, "jordan");
    await storage.readImage(inline.id, "jordan");
    const deletion = { id: article.id, version: article.version, ...request() };
    await client.delete(deletion);
    await client.delete(deletion);
    await rejected(storage.readImage(inline.id, "jordan"), "NOT_FOUND");
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
  await t.test(
    "public images follow publication snapshots, never draft replacements or bucket ACLs",
    async () => {
      let post = await client.create({ title: "Image privacy", locale: "en", ...request() });
      const assets = [];
      for (let i = 0; i < 3; i++) {
        assets.push(await storage.upload("jordan", { ...imageInput, id: post.id, ...request() }));
      }
      const [original, replacement, unused] = assets;
      const content = {
        ...emptyContent,
        title: "Image privacy",
        slug: "image-privacy",
        markdown: "Public text",
      };
      post = await client.save({
        ...input(post),
        content,
        shared: { thumbnailId: original.id, bannerId: null, categoryIds: [] },
      });
      await rejected(storage.readImage(original.id), "NOT_FOUND");
      post = await client.publish(input(post));
      post = await client.save({
        ...input(post),
        content,
        shared: { ...post.shared, thumbnailId: replacement.id },
      });
      assert.equal((await storage.readImage(original.id)).cacheControl, "no-store");
      await rejected(storage.readImage(replacement.id), "NOT_FOUND");
      await rejected(storage.readImage(unused.id), "NOT_FOUND");
      await rejected(storage.readImage(replacement.id, "restricted"), "FORBIDDEN");
      assert.deepEqual(
        Buffer.from((await storage.readImage(replacement.id, "jordan")).bytes),
        image,
      );
      post = await client.publish(input(post));
      await rejected(storage.readImage(original.id), "NOT_FOUND");
      assert.deepEqual(Buffer.from((await storage.readImage(replacement.id)).bytes), image);
      for (const asset of assets) {
        const [record] = await pool`select key from blogs_object where id=${asset.id}`;
        const rawUrl = `http://127.0.0.1:19040/${bucket}/${record.key}`;
        assert.equal((await fetch(rawUrl)).status, 403);
        assert.equal((await fetch(rawUrl, { method: "HEAD" })).status, 403);
      }
      post = await client.unpublish(input(post));
      await rejected(storage.readImage(replacement.id), "NOT_FOUND");
      post = await client.publish(input(post));
      await client.delete({ id: post.id, version: post.version, ...request() });
      await rejected(storage.readImage(replacement.id), "NOT_FOUND");
      await rejected(storage.readImage(replacement.id, "jordan"), "NOT_FOUND");
    },
  );
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
    new ListObjectsV2Command({ Bucket: bucket, Prefix: `storage-test/blogs/${durable.id}/` }),
  );
  assert.ok(
    objects.Contents.every((o) => /\/(?:image|[a-z0-9-]+-blog\.(?:png|jpg|webp))$/.test(o.Key)),
  );
  const [record] = await pool`select document from blogs_article where id=${durable.id}`;
  assert.equal(record.document.translations.en.published.markdown, "Persisted Markdown");
});

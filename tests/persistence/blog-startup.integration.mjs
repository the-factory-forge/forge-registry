import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { assertMigrationsApplied } from "../../registry/components/utils/database-migrations.ts";
import { createAuth } from "./auth.fixture.ts";
import { generatedMigration } from "./migrations.mjs";
import * as schema from "./schema.ts";

const { createArticle } = await import("../../registry/components/plugins/blogs/model.ts");
const { backfillBlogProjections, assertBlogStorageReady, createBlogsStorage } =
  await import("../../registry/components/plugins/blogs/server/index.ts");

await test("current schema migrations replay safely and gate blog startup", async (t) => {
  const connection = "postgres://blogs_test:local_blogs_test_only@127.0.0.1:55440/blogs_test";
  const database = `startup_${randomUUID().replaceAll("-", "")}`;
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const url = new URL(connection);
  url.pathname = database;
  const pool = postgres(url.href, { max: 4, onnotice: () => {} });
  const db = drizzle({ client: pool, relations: schema.authRelations });
  const folder = await mkdtemp(join(tmpdir(), "forge-startup-journal-"));
  t.after(async () => {
    await pool.end();
    await root`drop database if exists ${root(database)}`;
    await root.end();
    await rm(folder, { recursive: true, force: true });
  });
  await root`create database ${root(database)}`;
  await assert.rejects(assertBlogStorageReady(db), /Blog storage is not ready/);
  await migrate(db, { migrationsFolder: folder });
  const migrationName = "20261023000000_current";
  await mkdir(join(folder, migrationName));
  const migration = (await generatedMigration({}, schema)).join("\n--> statement-breakpoint\n");
  await writeFile(join(folder, migrationName, "migration.sql"), migration);
  await assert.rejects(
    assertMigrationsApplied(db, { migrationsFolder: folder }),
    /Project migrations are not current/,
  );
  await migrate(db, { migrationsFolder: folder });
  await assertMigrationsApplied(db, { migrationsFolder: folder });
  const journal = await pool`select * from drizzle.__drizzle_migrations order by id`;
  assert.equal(journal.length, 1);
  assert.deepEqual(await assertBlogStorageReady(db), { articles: 0, history: 0 });
  const editor = { id: "existing-user", name: "Existing Author" };
  const now = "2026-01-02T03:04:05.000Z";
  const article = createArticle(randomUUID(), "Existing article", "en", editor, now);
  const imageId = randomUUID(),
    revisionId = randomUUID(),
    categoryId = randomUUID();
  article.shared = { ...article.shared, categoryIds: [categoryId], thumbnailId: imageId };
  const draft = {
    ...article.translations.en.draft,
    revisionId,
    markdown: "Existing markdown",
    assetIds: [imageId],
    summary: "Searchable words",
  };
  const publication = { ...draft, shared: article.shared, publishedAt: now };
  article.translations.en = {
    draft,
    published: publication,
    shared: article.shared,
    history: {
      lastNumber: 1,
      lastPublicationOrder: 1,
      currentId: revisionId,
      publishedId: revisionId,
    },
  };
  const header = {
    id: revisionId,
    number: 1,
    locale: "en",
    state: "publication",
    savedAt: now,
    savedBy: editor,
    author: editor,
    repriseId: null,
    sourcePublicationId: null,
    sourcePublicationOrder: null,
    publicationOrder: 1,
    publishedAt: now,
    omittedAssetIds: [],
  };
  const payload = { content: draft, shared: article.shared };
  const category = {
    id: categoryId,
    version: 1,
    parentId: null,
    translations: { en: { name: "Existing", slug: "existing" } },
  };
  const key = `startup-test/blogs/${article.id}/${imageId}/existing.png`;
  await pool`insert into blogs_article (id,version,document,updated_at) values (${article.id},1,${JSON.stringify(article)}::jsonb,${now})`;
  await pool`insert into blogs_category (id,document) values (${categoryId},${JSON.stringify(category)}::jsonb)`;
  await pool`insert into blogs_history (id,article_id,locale,number,header,payload) values (${revisionId},${article.id},'en',1,${JSON.stringify(header)}::jsonb,${JSON.stringify(payload)}::jsonb)`;
  await pool`insert into blogs_object (id,article_id,key,kind,name,content_type,size,state) values (${imageId},${article.id},${key},'image','existing.png','image/png',5,'ready')`;
  await db
    .insert(schema.user)
    .values({ id: editor.id, name: editor.name, email: "existing@example.test", role: "admin" });
  await db.insert(schema.account).values({
    id: "existing-credential",
    userId: editor.id,
    accountId: editor.id,
    providerId: "credential",
    password: await hashPassword("disposable-startup-password"),
    updatedAt: new Date(),
  });
  const auth = createAuth(db);
  const response = await auth.api.signInEmail({
    body: { email: "existing@example.test", password: "disposable-startup-password" },
    asResponse: true,
  });
  assert.equal(response.status, 200);
  const headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  });
  const identity = {
    users: await db.select().from(schema.user),
    accounts: await db.select().from(schema.account),
    sessions: await db.select().from(schema.session),
  };
  const spaceId = randomUUID(),
    fileId = randomUUID(),
    storageId = randomUUID();
  await db
    .insert(schema.driveSpaces)
    .values({ id: spaceId, entityType: "workspace", entityId: "startup" });
  await db.insert(schema.driveEntries).values({
    id: fileId,
    spaceId,
    name: "Existing.png",
    kind: "file",
    state: "ready",
    storageId,
    storageName: "immutable.png",
  });
  const drive = await pool`select * from drive_entry`;
  await migrate(db, { migrationsFolder: folder });
  await assertMigrationsApplied(db, { migrationsFolder: folder });
  assert.deepEqual(await pool`select * from drizzle.__drizzle_migrations order by id`, journal);
  assert.equal(await readFile(join(folder, migrationName, "migration.sql"), "utf8"), migration);
  await writeFile(
    join(folder, migrationName, "migration.sql"),
    migration + "\n-- edited applied migration\n",
  );
  await assert.rejects(
    assertMigrationsApplied(db, { migrationsFolder: folder }),
    /Project migrations are not current/,
  );
  await writeFile(join(folder, migrationName, "migration.sql"), migration);
  assert.deepEqual(await db.select().from(schema.user), identity.users);
  assert.deepEqual(await db.select().from(schema.account), identity.accounts);
  assert.deepEqual(await db.select().from(schema.session), identity.sessions);
  assert.deepEqual(await pool`select * from drive_entry`, drive);
  assert.equal((await auth.api.getSession({ headers })).user.id, editor.id);
  assert.equal(
    (
      await auth.api.signInEmail({
        body: { email: "existing@example.test", password: "disposable-startup-password" },
        asResponse: true,
      })
    ).status,
    200,
  );
  await assert.rejects(
    db.insert(schema.user).values({ id: "duplicate", name: "No", email: "existing@example.test" }),
    (error) => error.cause?.code === "23505",
  );
  const before = {
    article: (await pool`select document from blogs_article`)[0].document,
    history: (await pool`select header,payload from blogs_history`)[0],
    objects: await pool`select id,key from blogs_object`,
  };
  let objectOperations = 0,
    started = false;
  const options = {
    db,
    keyPrefix: "startup-test/blogs/",
    locales: ["en"],
    authorize: async () => true,
    resolveEditor: async () => editor,
    s3: {
      send: async () => {
        objectOperations++;
        return {};
      },
    },
    bucket: "unused",
  };
  const storage = createBlogsStorage(options);
  await assert.rejects(async () => {
    await storage.preflight();
    started = true;
  }, /Blog storage is not ready/);
  assert.equal(started, false);
  await assert.rejects(
    storage.listPublished({ locale: "en" }),
    (error) => error.code === "STORAGE",
  );
  await assert.rejects(storage.maintenance(), (error) => error.code === "STORAGE");
  assert.equal(objectOperations, 0, "cleanup cannot touch objects before readiness");
  assert.deepEqual(await db.transaction(backfillBlogProjections), { articles: 1, history: 1 });
  const projections = await pool`select * from blogs_translation order by kind`;
  assert.deepEqual(await db.transaction(backfillBlogProjections), { articles: 1, history: 1 });
  assert.deepEqual(await pool`select * from blogs_translation order by kind`, projections);
  assert.deepEqual((await pool`select document from blogs_article`)[0].document, before.article);
  assert.deepEqual((await pool`select header,payload from blogs_history`)[0], before.history);
  assert.deepEqual(await pool`select id,key from blogs_object`, before.objects);
  assert.deepEqual((await pool`select author_ids,category_ids from blogs_article`)[0], {
    author_ids: [editor.id],
    category_ids: [categoryId],
  });
  assert.deepEqual((await pool`select asset_ids,author_id from blogs_history`)[0], {
    asset_ids: [imageId],
    author_id: editor.id,
  });
  async function startHost() {
    await assertMigrationsApplied(db, { migrationsFolder: folder });
    const checked = await storage.preflight();
    started = true;
    return checked;
  }
  assert.deepEqual(await startHost(), { articles: 1, history: 1 });
  assert.equal(started, true);
  await t.test(
    "preflight rejects stale or missing projections and retained image references",
    async () => {
      for (const corrupt of [
        () => pool`delete from blogs_translation where kind='publication'`,
        () => pool`update blogs_translation set search_text='stale'`,
        () => pool`delete from blogs_publication_category`,
        () => pool`update blogs_article set author_ids='{}'`,
        () => pool`update blogs_history set asset_ids='{}'`,
      ]) {
        await corrupt();
        await assert.rejects(assertBlogStorageReady(db), /Blog storage is not ready/);
        await assert.rejects(
          createBlogsStorage(options).maintenance(),
          (error) => error.code === "STORAGE",
        );
        assert.equal(objectOperations, 0);
        await db.transaction(backfillBlogProjections);
        assert.deepEqual(await assertBlogStorageReady(db), { articles: 1, history: 1 });
      }
    },
  );
  await migrate(db, { migrationsFolder: folder });
  assert.deepEqual(await pool`select * from drizzle.__drizzle_migrations order by id`, journal);
  assert.deepEqual((await pool`select document from blogs_article`)[0].document, before.article);
  assert.deepEqual((await pool`select header,payload from blogs_history`)[0], before.history);
  assert.deepEqual(await pool`select id,key from blogs_object`, before.objects);
  const page = await storage.listPublished({ locale: "en", search: "Searchable", categoryId });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, article.id);
  assert.equal((await storage.getPublished("en", draft.slug)).markdown, draft.markdown);
});

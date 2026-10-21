import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const { createBlogsStorage } =
  await import("../../registry/components/plugins/blogs/server/storage.server.ts");
const { canAccessBlog } = await import("../../registry/components/plugins/blogs/permissions.ts");
const { emptyContent } = await import("../../registry/components/plugins/blogs/utils.ts");

void test("trusted authors, collaborative drafts, deleted signatures and language snapshots", async () => {
  const target = new URL(process.env.BLOGS_AUTHOR_TEST_DATABASE_URL);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname.endsWith("_e2e"),
  );
  const schema = `authors_${randomUUID().replaceAll("-", "")}`;
  const root = postgres(target.href, { max: 1, onnotice: () => {} });
  const pool = postgres(target.href, {
    max: 4,
    connection: { search_path: schema },
    onnotice: () => {},
  });
  try {
    await root`create schema ${root(schema)}`;
    await pool.unsafe(
      await readFile(
        new URL("../../registry/components/plugins/blogs/server/migration.sql", import.meta.url),
        "utf8",
      ),
    );
    const accounts = new Map([
      ["author", "Original author"],
      ["colleague", "Draft editor"],
      ["admin", "Administrator"],
    ]);
    const storage = createBlogsStorage({
      db: drizzle(pool),
      keyPrefix: "author-tests/blogs/",
      locales: ["en", "fr"],
      resolveAuthorNames: async (ids) =>
        ids.flatMap((id) => (accounts.has(id) ? [{ id, name: accounts.get(id) }] : [])),
      resolveEditor: async (id) => ({ id, name: accounts.get(id) }),
      resolveAuthor: async (_, id) => (accounts.has(id) ? { id, name: accounts.get(id) } : null),
      authorize: async (id, permission, articleId) => {
        const [row] = articleId
          ? await pool`select document from blogs_article where id=${articleId}`
          : [];
        return canAccessBlog(
          accounts.has(id) ? { id, admin: id === "admin" } : null,
          permission,
          row?.document.shared.author?.id,
        );
      },
    });
    const author = storage.client("author"),
      colleague = storage.client("colleague"),
      admin = storage.client("admin");
    const request = () => ({ requestId: randomUUID() });
    const mutation = (article, locale = "en") => ({
      id: article.id,
      version: article.version,
      locale,
      ...request(),
    });
    const save = (client, article, shared = article.shared, locale = "en") =>
      client.save({
        ...mutation(article, locale),
        shared,
        content: {
          ...emptyContent,
          title: "Article",
          slug: `article-${locale}`,
          markdown: "A saved draft.",
        },
      });
    let article = await author.create({ ...request(), title: "Article", locale: "en" });
    article = await save(author, article);
    article = await author.publish(mutation(article));
    article = await save(author, article, article.shared, "fr");
    article = await author.publish(mutation(article, "fr"));
    assert.equal((await colleague.list({ locale: "en" })).total, 1);
    article = await save(colleague, article, {
      ...article.shared,
      author: { id: "author", name: "Forged name" },
    });
    assert.equal(article.shared.author.name, "Original author");
    assert.equal(article.editor.id, "colleague");
    await assert.rejects(
      colleague.publish(mutation(article)),
      (error) => error.code === "FORBIDDEN",
    );
    await assert.rejects(
      save(colleague, article, {
        ...article.shared,
        author: { id: "colleague", name: "Takeover" },
      }),
      (error) => error.code === "FORBIDDEN",
    );
    const [beforeRename] = await pool`select document from blogs_article where id=${article.id}`;
    accounts.set("author", "Renamed author");
    for (const locale of ["en", "fr"]) {
      assert.equal(
        (await storage.getPublished(locale, `article-${locale}`)).shared.author.name,
        "Renamed author",
      );
      assert.equal(
        (await storage.listPublished({ locale })).items[0].shared.author.name,
        "Renamed author",
      );
    }
    assert.equal((await colleague.get(article.id)).shared.author.name, "Renamed author");
    assert.equal((await colleague.list({ locale: "en" })).items[0].author.name, "Renamed author");
    const [afterRename] = await pool`select document from blogs_article where id=${article.id}`;
    assert.deepEqual(afterRename.document, beforeRename.document);
    article = await author.publish(mutation(article));
    assert.equal(article.translations.en.published.shared.author.name, "Renamed author");
    assert.equal(article.translations.fr.published.shared.author.name, "Renamed author");
    await assert.rejects(
      save(admin, article, { ...article.shared, author: { id: "missing", name: "Unknown" } }),
      (error) => error.code === "NOT_FOUND",
    );
    accounts.set("author", "Final name before departure");
    const [beforeDeparture] = await pool`select document from blogs_article where id=${article.id}`;
    await assert.rejects(
      drizzle(pool).transaction(async (tx) => {
        await storage.snapshotAuthorName(tx, { id: "author", name: accounts.get("author") });
        throw new Error("Rollback departure");
      }),
      /Rollback departure/,
    );
    const [afterRollback] = await pool`select document from blogs_article where id=${article.id}`;
    assert.deepEqual(afterRollback.document, beforeDeparture.document);
    await drizzle(pool).transaction((tx) =>
      storage.snapshotAuthorName(tx, { id: "author", name: accounts.get("author") }),
    );
    accounts.delete("author");
    const [retained] = await pool`select document from blogs_article where id=${article.id}`;
    assert.equal(retained.document.version, beforeDeparture.document.version);
    assert.equal(retained.document.updatedAt, beforeDeparture.document.updatedAt);
    assert.deepEqual(retained.document.editor, beforeDeparture.document.editor);
    for (const locale of ["en", "fr"])
      assert.equal(
        (await storage.getPublished(locale, `article-${locale}`)).shared.author.name,
        "Final name before departure",
      );
    article = await save(colleague, article);
    assert.equal(article.shared.author.name, "Final name before departure");
    article = await admin.publish(mutation(article));
    article = await save(admin, article, {
      ...article.shared,
      author: { id: "colleague", name: "Ignored" },
    });
    assert.equal(article.shared.author.name, "Draft editor");
    assert.equal((await storage.getPublished("en", "article-en")).shared.author.id, "author");
    article = await colleague.publish(mutation(article));
    assert.equal(article.translations.en.published.shared.author.id, "colleague");
    const legacy = structuredClone(article);
    delete legacy.shared.author;
    delete legacy.translations.en.published.shared.author;
    await pool`update blogs_article set document=${JSON.stringify(legacy)}::jsonb where id=${article.id}`;
    const legacySignature = (await storage.getPublished("en", "article-en")).editor;
    await assert.rejects(
      admin.publish(mutation(legacy)),
      (error) => error.code === "AUTHOR_REQUIRED",
    );
    article = await save(colleague, legacy);
    assert.equal(article.shared.author, undefined);
    assert.deepEqual((await storage.getPublished("en", "article-en")).editor, legacySignature);
    await assert.rejects(
      save(colleague, article, {
        ...article.shared,
        author: { id: "colleague", name: "Takeover" },
      }),
      (error) => error.code === "FORBIDDEN",
    );
    article = await save(admin, article);
    assert.equal(article.shared.author, undefined);
    await assert.rejects(
      admin.publish(mutation(article)),
      (error) => error.code === "AUTHOR_REQUIRED",
    );
    article = await save(admin, article, {
      ...article.shared,
      author: { id: "colleague", name: "Ignored" },
    });
    assert.equal(article.shared.author.name, "Draft editor");
    article = await colleague.publish(mutation(article));
    assert.equal((await storage.getPublished("en", "article-en")).shared.author.id, "colleague");
  } finally {
    await pool.end();
    await root`drop schema if exists ${root(schema)} cascade`;
    await root.end();
  }
});

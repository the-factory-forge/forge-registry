import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
const { createArticle, publishArticle, saveArticle, validateCategory } =
  await import("../registry/components/plugins/blogs/model.ts");
const {
  emptyContent,
  markdownAssetIds,
  normalizeCategories,
  publicPosts,
  safeAssetUrl,
  validateContent,
} = await import("../registry/components/plugins/blogs/utils.ts");

const actor = { id: "author", name: "First editor" },
  other = { id: "other", name: "Last editor" },
  now = "2026-09-10T10:00:00.000Z";
const parent = {
  id: randomUUID(),
  version: 1,
  parentId: null,
  translations: { en: { name: "Ideas", slug: "ideas" }, fr: { name: "Idées", slug: "idees" } },
};
const child = {
  id: randomUUID(),
  version: 1,
  parentId: parent.id,
  translations: { en: { name: "Design", slug: "design" } },
};
const categories = [parent, child];
test("publication snapshots isolate languages, shared media, attribution, and category counts", () => {
  let article = createArticle(randomUUID(), "First title", "en", actor, now);
  const image = randomUUID(),
    second = randomUUID();
  const save = (locale, title, shared) => {
    article = saveArticle(
      article,
      {
        id: article.id,
        version: article.version,
        requestId: randomUUID(),
        locale,
        content: {
          ...emptyContent,
          title,
          slug: title.toLowerCase().replaceAll(" ", "-"),
          markdown: `Hello ![alt](./assets/${image})`,
        },
        shared,
      },
      categories,
      new Set([image, second]),
      randomUUID(),
      other,
      now,
    );
  };
  save("en", "English", { thumbnailId: image, bannerId: image, categoryIds: [child.id] });
  article = publishArticle(article, "en", categories, other, now);
  const publication = structuredClone(article.translations.en.published);
  save("fr", "Francais", { thumbnailId: second, bannerId: second, categoryIds: [parent.id] });
  // Slugs must use the documented URL-safe alphabet.
  article.translations.fr.draft.slug = "francais";
  article = publishArticle(article, "fr", categories, actor, "2026-09-11T10:00:00.000Z");
  assert.deepEqual(article.translations.en.published, publication);
  assert.equal(article.translations.fr.published.shared.thumbnailId, second);
  assert.equal(article.translations.fr.published.editor.name, actor.name);
  const page = publicPosts([article], { locale: "en", categoryId: parent.id });
  assert.equal(page.total, 1);
  assert.equal(page.categoryCounts[parent.id], 1);
  assert.equal(page.categoryCounts[child.id], 1);
  assert.equal(publicPosts([article], { locale: "de" }).total, 0);
});
test("parser tracks reference-style images and rejects unowned or non-asset image URLs", () => {
  const id = randomUUID();
  assert.deepEqual(markdownAssetIds(`![alt][image]\n\n[image]: ./assets/${id}`), [id]);
  assert.deepEqual(markdownAssetIds("`![not an image](https://example.com)`"), []);
  assert.throws(() => markdownAssetIds("![image](https://example.com/photo.png)"), {
    code: "INVALID",
  });
  assert.throws(() => markdownAssetIds("![image](javascript:alert(1))"), { code: "INVALID" });
  const article = createArticle(randomUUID(), "Draft", "en", actor, now);
  assert.throws(
    () =>
      saveArticle(
        article,
        {
          id: article.id,
          version: 1,
          requestId: randomUUID(),
          locale: "en",
          content: { ...emptyContent, markdown: `![alt](./assets/${id})` },
          shared: article.shared,
        },
        [],
        new Set(),
        randomUUID(),
        actor,
        now,
      ),
    { code: "NOT_FOUND" },
  );
});
test("validation rejects blank publications, unsafe URLs, invalid sizes, and incomplete taxonomy translations", () => {
  assert.throws(
    () => validateContent({ ...emptyContent, title: " ", slug: "ok", markdown: "body" }, 100, true),
    { code: "INVALID" },
  );
  assert.throws(() => validateContent({ ...emptyContent, markdown: "é".repeat(51) }, 100), {
    code: "INVALID",
  });
  for (const url of [
    "//evil.test/image",
    "javascript:alert(1)",
    "/\\evil.test/image",
    "https://user:pass@host/image",
  ])
    assert.equal(safeAssetUrl(url), "");
  assert.equal(safeAssetUrl("/api/blog-images/id"), "/api/blog-images/id");
  assert.deepEqual(
    normalizeCategories([child.id, parent.id, child.id], categories),
    [parent.id, child.id].sort((a, b) => a.localeCompare(b)),
  );
  assert.throws(
    () =>
      validateCategory(
        { id: parent.id, parentId: child.id, translations: parent.translations },
        categories,
        ["en", "fr"],
      ),
    { code: "INVALID" },
  );
  assert.throws(
    () =>
      validateCategory(
        { id: parent.id, parentId: null, translations: { en: parent.translations.en } },
        categories,
        ["en", "fr"],
      ),
    { code: "INVALID" },
  );
});
test("blog registry files ship independently and never expose server imports through the UI", async () => {
  const registry = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  for (const name of ["blogs", "blogs-storage"]) {
    const item = registry.items.find((i) => i.name === name);
    assert.ok(item);
    assert.equal(item.type, "registry:block");
    const directory = `registry/components/plugins/blogs${name === "blogs-storage" ? "/server" : ""}`;
    const files = (
      await readdir(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true })
    )
      .filter((f) => f.isFile())
      .map((f) => `${directory}/${f.name}`)
      .sort();
    assert.deepEqual(item.files.map((f) => f.path).sort(), files);
    for (const file of item.files) {
      assert.equal(file.target, file.path.replace("registry/components/", "@components/"));
      const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /from ["'](?:next|@\/lib\/|@\/showroom\/)/);
      if (name === "blogs")
        assert.doesNotMatch(
          source,
          /blogs\/server|plugins\/(?:drive|customers|projects)|drizzle-orm|@aws-sdk/,
        );
    }
  }
});

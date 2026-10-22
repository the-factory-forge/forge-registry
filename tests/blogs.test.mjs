import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
const {
  createArticle,
  publishArticle,
  saveArticle,
  validateCategory,
  recordBlogSave,
  publishBlogVersion,
  deleteBlogVersion,
} = await import("../registry/components/plugins/blogs/model.ts");
const {
  articleListItem,
  emptyContent,
  markdownAssetIds,
  normalizeCategories,
  publicPosts,
  safeAssetUrl,
  validateContent,
  hasUnpublishedChanges,
} = await import("../registry/components/plugins/blogs/utils.ts");

const actor = { id: "author", name: "First editor" },
  other = { id: "other", name: "Last editor" },
  now = "2026-09-10T10:00:00.000Z";
void test("collaboration grants editing to staff and management only to author/admin", async () => {
  const { blogCapabilities, canAccessBlog } =
    await import("../registry/components/plugins/blogs/permissions.ts");
  for (const permission of [
    "read",
    "create",
    "edit",
    "upload",
    "publish",
    "delete",
    "changeAuthor",
    "manageCategories",
  ])
    assert.equal(canAccessBlog(null, permission, "author"), false);
  const colleague = { id: "colleague", admin: false };
  assert.equal(canAccessBlog(colleague, "read", "author"), true);
  assert.equal(canAccessBlog(colleague, "edit", "author"), true);
  assert.equal(canAccessBlog(colleague, "upload", "author"), true);
  for (const permission of ["publish", "delete", "changeAuthor", "manageCategories"])
    assert.equal(canAccessBlog(colleague, permission, "author"), false);
  assert.equal(blogCapabilities({ id: "author", admin: false }, "author").publish, true);
  assert.equal(blogCapabilities({ id: "admin", admin: true }, "author").changeAuthor, true);
});
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
function historyFixture() {
  let article = createArticle(randomUUID(), "Initial", "en", actor, now);
  let versions = [];
  return {
    get article() {
      return article;
    },
    get versions() {
      return versions;
    },
    save(
      title,
      origin,
      locale = "en",
      shared = article.translations[locale]?.shared ?? article.shared,
    ) {
      const input = {
        id: article.id,
        version: article.version,
        requestId: randomUUID(),
        locale,
        shared,
        origin,
        content: {
          ...emptyContent,
          title,
          slug: title.toLowerCase().replaceAll(" ", "-"),
          markdown: title,
        },
      };
      const sourceId = origin?.versionId ?? article.translations[locale]?.history?.currentId;
      const source = versions.find((version) => version.id === sourceId) ?? null;
      const next = saveArticle(article, input, [], new Set(), randomUUID(), other, now);
      const result = recordBlogSave(article, next, input, versions, source);
      article = result.article;
      versions = versions.filter((version) => !result.removedIds.includes(version.id));
      if (result.saved) versions.push(result.saved);
      return result;
    },
    publish(id, omitted = []) {
      const target = versions.find((version) => version.id === id);
      const result = publishBlogVersion(article, target, versions, [], actor, now, omitted);
      article = result.article;
      versions = versions.filter(
        (version) =>
          version.id !== id && !result.discarded.some((header) => header.id === version.id),
      );
      versions.push(result.saved);
      return result;
    },
    delete(id) {
      const target = versions.find((version) => version.id === id);
      const translation = article.translations[target.locale];
      const fallbackId =
        versions
          .filter(
            (version) =>
              version.locale === target.locale && version.id !== id && version.state === "draft",
          )
          .sort((left, right) => right.number - left.number)[0]?.id ??
        translation.history.publishedId;
      article = deleteBlogVersion(
        article,
        target,
        versions,
        versions.find((version) => version.id === fallbackId) ?? null,
        actor,
        now,
      );
      versions = versions.filter((version) => version.id !== id);
    },
  };
}

await test("language settings freeze legacy fallback before another language changes", () => {
  let article = createArticle(randomUUID(), "English", "en", actor, now);
  article = saveArticle(
    article,
    {
      id: article.id,
      version: article.version,
      requestId: randomUUID(),
      locale: "en",
      content: { ...emptyContent, title: "English", slug: "english", markdown: "Text" },
      shared: article.shared,
    },
    [],
    new Set(),
    randomUUID(),
    actor,
    now,
  );
  article = publishArticle(article, "en", [], actor, now);
  delete article.translations.en.shared;
  const frenchAuthor = { id: "french-author", name: "French author" };
  article = saveArticle(
    article,
    {
      id: article.id,
      version: article.version,
      requestId: randomUUID(),
      locale: "fr",
      content: { ...emptyContent, title: "Français", slug: "francais", markdown: "Texte" },
      shared: { ...article.shared, author: frenchAuthor },
    },
    [],
    new Set(),
    randomUUID(),
    other,
    now,
  );
  assert.equal(article.shared.author.id, frenchAuthor.id);
  assert.equal(article.translations.en.shared.author.id, actor.id);
  assert.equal(hasUnpublishedChanges(article, "en"), false);
  article = publishArticle(article, "en", [], other, now);
  assert.equal(article.translations.en.published.shared.author.id, actor.id);
});

await test("changed saves allocate stable history numbers and unchanged saves keep concurrency state", () => {
  const fixture = historyFixture();
  const first = fixture.save("First").saved;
  assert.equal(first.number, 1);
  assert.equal(first.author.id, actor.id);
  assert.equal(first.savedBy.id, other.id);
  const before = structuredClone(fixture.article);
  assert.equal(fixture.save("First").saved, null);
  assert.deepEqual(fixture.article, before);
  assert.equal(fixture.versions.length, 1);
  const second = fixture.save("Second").saved;
  assert.equal(second.number, 2);
  assert.equal(second.repriseId, first.repriseId);
  const publication = fixture.publish(second.id);
  assert.equal(publication.saved.id, second.id);
  assert.equal(publication.saved.number, second.number);
  assert.equal(fixture.versions.length, 1);
  assert.equal(fixture.versions[0].state, "publication");
});

await test("account renames do not create versions and ordinary language edits do not reassign management", () => {
  const fixture = historyFixture();
  fixture.save("First");
  const shared = fixture.article.translations.en.shared;
  assert.equal(
    fixture.save("First", undefined, "en", {
      ...shared,
      author: { id: actor.id, name: "Renamed account" },
    }).saved,
    null,
  );
  assert.equal(fixture.versions.length, 1);
  fixture.save("Francais", undefined, "fr", {
    ...shared,
    author: { id: "french-author", name: "French author" },
  });
  assert.equal(fixture.article.shared.author.id, "french-author");
  fixture.save("English correction");
  assert.equal(fixture.article.shared.author.id, "french-author");
  assert.equal(fixture.article.translations.en.shared.author.id, actor.id);
});

await test("starts from the same publication stay independent and continued drafts retain their source", () => {
  const fixture = historyFixture();
  const source = fixture.save("Source").saved;
  fixture.publish(source.id);
  const first = fixture.save("First path", { versionId: source.id, repriseId: randomUUID() }).saved;
  const second = fixture.save("First path", {
    versionId: source.id,
    repriseId: randomUUID(),
  }).saved;
  assert.notEqual(first.repriseId, second.repriseId);
  assert.equal(first.content.markdown, second.content.markdown);
  assert.equal(first.sourcePublicationId, source.id);
  assert.equal(second.sourcePublicationId, source.id);
  const continued = fixture.save("First path continued", { versionId: first.id }).saved;
  assert.equal(continued.repriseId, first.repriseId);
  assert.equal(continued.sourcePublicationId, source.id);
  assert.equal(fixture.versions.filter((version) => version.state === "publication").length, 1);
  assert.throws(
    () => fixture.save("Invalid reuse", { versionId: source.id, repriseId: first.repriseId }),
    { code: "CONFLICT" },
  );
});

await test("eight drafts are retained across reprises and pruning never resets numbering or provenance", () => {
  const fixture = historyFixture();
  const source = fixture.save("Source").saved;
  fixture.publish(source.id);
  for (let index = 0; index < 9; index++)
    fixture.save(`Path ${index}`, { versionId: source.id, repriseId: randomUUID() });
  const drafts = fixture.versions.filter((version) => version.state === "draft");
  assert.equal(drafts.length, 8);
  assert.equal(
    drafts.some((version) => version.number === 2),
    false,
  );
  assert.throws(() => fixture.delete(source.id), { code: "IN_USE" });
  fixture.publish(drafts.at(-1).id);
  const reprise = fixture.save("Surviving path", {
    versionId: source.id,
    repriseId: randomUUID(),
  }).saved;
  fixture.delete(source.id);
  const continued = fixture.save("Continued without source", { versionId: reprise.id }).saved;
  assert.equal(continued.sourcePublicationId, source.id);
  assert.equal(continued.sourcePublicationOrder, reprise.sourcePublicationOrder);
  assert.equal(continued.repriseId, reprise.repriseId);
  assert.ok(continued.number > 10);
});

await test("draft retention and visible counters are independent for each language", () => {
  const fixture = historyFixture();
  for (let index = 0; index < 8; index++) fixture.save(`Francais ${index}`, undefined, "fr");
  for (let index = 0; index < 9; index++) fixture.save(`English ${index}`);
  assert.equal(fixture.versions.filter((version) => version.locale === "fr").length, 8);
  assert.equal(fixture.versions.filter((version) => version.locale === "en").length, 8);
  assert.equal(fixture.article.translations.fr.history.lastNumber, 8);
  assert.equal(fixture.article.translations.en.history.lastNumber, 9);
});

await test("historical publication discards only later publications and pending drafts in its language", () => {
  const fixture = historyFixture();
  const first = fixture.save("First").saved;
  fixture.publish(first.id);
  const second = fixture.save("Second").saved;
  fixture.publish(second.id);
  const french = fixture.save("Francais", undefined, "fr").saved;
  fixture.publish(french.id);
  const reprise = fixture.save("Reworked first", {
    versionId: first.id,
    repriseId: randomUUID(),
  }).saved;
  const result = fixture.publish(reprise.id);
  assert.equal(result.historicalReturn, true);
  assert.deepEqual(
    result.discarded.map((version) => version.id),
    [second.id],
  );
  assert.equal(fixture.article.translations.en.published.markdown, "Reworked first");
  assert.equal(fixture.article.translations.fr.published.markdown, "Francais");
  assert.equal(
    fixture.versions.some((version) => version.id === french.id),
    true,
  );
  assert.ok(fixture.save("After rollback").saved.number > reprise.number);
});

await test("publication retention keeps five publications and direct reactivation keeps its content identity", () => {
  const fixture = historyFixture();
  const ids = [];
  for (let index = 0; index < 6; index++) {
    const saved = fixture.save(`Publication ${index}`).saved;
    ids.push(saved.id);
    fixture.publish(saved.id);
  }
  assert.equal(fixture.versions.length, 5);
  assert.equal(
    fixture.versions.some((version) => version.id === ids[0]),
    false,
  );
  const original = structuredClone(fixture.versions.find((version) => version.id === ids[1]));
  fixture.publish(ids[1]);
  assert.equal(fixture.versions.length, 1);
  assert.equal(fixture.versions[0].id, original.id);
  assert.deepEqual(fixture.versions[0].content, original.content);
  assert.equal(fixture.article.translations.en.history.lastNumber, 6);
});

await test("deleting the selected draft falls back to the latest draft, live state, then empty input", () => {
  const fixture = historyFixture();
  const first = fixture.save("First").saved;
  const second = fixture.save("Second").saved;
  fixture.delete(second.id);
  assert.equal(fixture.article.translations.en.draft.title, "First");
  fixture.delete(first.id);
  assert.equal(fixture.article.translations.en.draft.revisionId, null);
  assert.equal(fixture.article.translations.en.history.lastNumber, 2);
  const published = fixture.save("Live").saved;
  fixture.publish(published.id);
  const draft = fixture.save("Pending").saved;
  fixture.delete(draft.id);
  assert.equal(fixture.article.translations.en.draft.title, "Live");
  assert.throws(() => fixture.delete(published.id), { code: "IN_USE" });
});
await test("admin list includes assigned category names with locale fallback", () => {
  const article = createArticle(randomUUID(), "Draft", "en", actor, now);
  assert.deepEqual(articleListItem(article, "en", categories).categoryNames, []);
  article.shared.categoryIds = [parent.id, child.id];
  assert.deepEqual(articleListItem(article, "en", categories).categoryNames, ["Ideas", "Design"]);
  assert.deepEqual(articleListItem(article, "fr", categories).categoryNames, ["Idées", "Design"]);
  assert.deepEqual(articleListItem(article, "en").categoryNames, []);
});
await test("publication snapshots isolate languages, shared media, attribution, and category counts", () => {
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
await test("parser tracks reference-style images and rejects unowned or non-asset image URLs", () => {
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
await test("validation rejects blank publications, unsafe URLs, invalid sizes, and incomplete taxonomy translations", () => {
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
await test("blog registry files ship independently and never expose server imports through the UI", async () => {
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
    if (name === "blogs-storage") files.push("registry/components/utils/storage-filename.ts");
    assert.deepEqual(item.files.map((f) => f.path).sort(), files.sort());
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

void test("legacy drafts stay unattributed until explicitly reviewed", () => {
  let article = createArticle(randomUUID(), "Legacy article", "en", actor, now);
  delete article.shared.author;
  const input = {
    id: article.id,
    version: 1,
    locale: "en",
    requestId: randomUUID(),
    content: { ...emptyContent, title: "Legacy", slug: "legacy", markdown: "Text" },
    shared: article.shared,
  };
  article = saveArticle(article, input, [], new Set(), randomUUID(), other, now);
  assert.equal(article.shared.author, undefined);
  assert.equal(articleListItem(article, "en").author, undefined);
  assert.throws(() => publishArticle(article, "en", [], other, now), { code: "AUTHOR_REQUIRED" });
  article = saveArticle(
    article,
    { ...input, shared: { ...input.shared, author: actor } },
    [],
    new Set(),
    randomUUID(),
    other,
    now,
  );
  assert.deepEqual(
    publishArticle(article, "en", [], other, now).translations.en.published.shared.author,
    actor,
  );
});

void test("authorship stores only public identity fields", () => {
  const privateAccount = { ...actor, email: "private@example.test", passwordHash: "not-public" };
  let article = createArticle(randomUUID(), "Article", "en", privateAccount, now);
  assert.deepEqual(article.shared.author, actor);
  article = saveArticle(
    article,
    {
      id: article.id,
      version: 1,
      requestId: randomUUID(),
      locale: "en",
      content: { ...emptyContent, title: "Article", slug: "article", markdown: "Text" },
      shared: { ...article.shared, author: privateAccount },
    },
    [],
    new Set(),
    randomUUID(),
    other,
    now,
  );
  assert.deepEqual(article.shared.author, actor);
  // Old/custom documents may still contain a full account object.
  article.shared.author = privateAccount;
  assert.deepEqual(
    publishArticle(article, "en", [], other, now).translations.en.published.shared.author,
    actor,
  );
});

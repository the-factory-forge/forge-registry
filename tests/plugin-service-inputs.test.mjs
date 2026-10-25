import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { createMenusService } =
  await import("../registry/components/plugins/menus/server/service.server.ts");
const { validateItem, validateCategory, validateLabel } =
  await import("../registry/components/plugins/menus/model.ts");
const { createDriveStorage } =
  await import("../registry/components/plugins/drive/server/storage.server.ts");
const { driveInputs, parseDriveInput } =
  await import("../registry/components/plugins/drive/server/input.ts");
const { createBlogsStorage } =
  await import("../registry/components/plugins/blogs/server/storage.server.ts");
const { blogInputs, parseBlogInput } =
  await import("../registry/components/plugins/blogs/server/input.ts");

const id = "00000000-0000-0000-0000-000000000001";
const scope = { type: "project", id: "host-owned-id" };
const item = {
  categoryId: id,
  priceMinor: 1250,
  position: 0,
  visible: false,
  soldOut: false,
  imageEntryId: null,
  labelIds: [],
  translations: { en: { name: " Lunch ", description: "" } },
};
const mutation = { id, version: 1, requestId: id };
const content = { title: "", slug: "", summary: "", markdown: "", thumbnailAlt: "", bannerAlt: "" };
const save = {
  ...mutation,
  locale: "en",
  content,
  shared: { thumbnailId: null, bannerId: null, categoryIds: [] },
};
function services() {
  let storageCalls = 0;
  const storage = new Proxy(
    {},
    {
      get() {
        storageCalls++;
        throw new Error("Unexpected storage access");
      },
    },
  );
  const menus = createMenusService({
    db: storage,
    drive: storage,
    baseLocale: "en",
    authorize: async () => true,
  });
  const drive = createDriveStorage({
    db: storage,
    s3: storage,
    bucket: "test",
    keyPrefix: "test/drive/",
    trash: {},
    resolveScope: async (_context, scope) => ({
      scope,
      name: "Test",
      capabilities: {
        upload: true,
        createFolder: true,
        rename: true,
        delete: true,
        download: true,
        restore: true,
      },
    }),
    listScopes: async () => {
      storageCalls++;
      throw new Error("Unexpected host query");
    },
  });
  const blogs = createBlogsStorage({
    db: storage,
    keyPrefix: "test/blogs/",
    locales: ["en"],
    authorize: async () => true,
    resolveEditor: async () => ({ id: "editor", name: "Editor" }),
  });
  return { menus, drive, blogs, assertUntouched: () => assert.equal(storageCalls, 0) };
}
const invalid = (action) => assert.rejects(async () => action(), { code: "INVALID" });

await test("all Menu request methods reject malformed inputs before storage", async () => {
  const { menus, assertUntouched } = services();
  const client = menus.client(null);
  for (const input of [null, undefined, [], 42, false]) {
    for (const method of [
      "get",
      "create",
      "reorder",
      "remove",
      "saveCategory",
      "removeCategory",
      "saveLabel",
      "removeLabel",
    ])
      if (method !== "reorder" || !Array.isArray(input)) await invalid(() => client[method](input));
    await invalid(() => client.save(id, 1, input));
    await invalid(() => menus.publicMenu(input));
    await invalid(() => menus.readPublicImage(input));
  }
  for (const version of [0, -1, 1.5, "1", null, Infinity])
    await invalid(() => client.save(id, version, item));
  for (const input of [
    { ...item, translations: { en: null } },
    { ...item, sizes: [null] },
    { ...item, labelIds: [42] },
  ])
    await invalid(() => client.create(input));
  await invalid(() => client.saveCategory({ id: 42, position: 0, translations: { en: "Lunch" } }));
  await invalid(() => client.saveLabel({ position: 0, translations: {}, kind: "unknown" }));
  assertUntouched();
});

await test("Menu validation strips extra fields without changing normalization or optional-field semantics", () => {
  const input = {
    ...item,
    id: "injected-id",
    version: 99,
    translations: { en: { ...item.translations.en, secret: "extra" } },
  };
  const snapshot = structuredClone(input);
  const value = validateItem(input, "en");
  assert.equal("id" in value, false);
  assert.equal("version" in value, false);
  assert.equal("secret" in value.translations.en, false);
  assert.equal(value.translations.en.name, "Lunch");
  assert.deepEqual(value.sizes, []);
  assert.equal(value.spiceLevel, 0);
  assert.equal(input.sizes, undefined);
  assert.equal(input.spiceLevel, undefined);
  assert.deepEqual(input, snapshot);
  for (const validate of [validateCategory, validateLabel])
    for (const input of [null, undefined, [], {}])
      assert.throws(() => validate(input, "en"), { code: "INVALID" });
});

await test("all Drive request methods reject malformed inputs before storage", async () => {
  const { drive, assertUntouched } = services();
  const client = drive.client(null);
  for (const input of [null, undefined, [], 42, false])
    for (const method of Object.keys(client)) await invalid(() => client[method](input));
  for (const search of [42, false, [], {}]) {
    await invalid(() => client.listSpaces({ search }));
    await invalid(() => client.listEntries({ scope, parentId: null, search }));
    await invalid(() => client.listTrash({ scope, search }));
  }
  for (const input of [
    { scope: null, parentId: null },
    { scope, parentId: 4 },
    { scope, parentId: null, sort: { field: "unsafe", direction: "asc" } },
    { scope, parentId: null, cursor: 10 },
  ])
    await invalid(() => client.listEntries(input));
  await invalid(() =>
    client.prepareUpload({
      scope,
      parentId: null,
      requestId: id,
      name: "test",
      size: "1",
      contentType: "text/plain",
    }),
  );
  await invalid(() =>
    client.prepareFolderUpload({
      scope,
      parentId: null,
      requestId: id,
      name: "test",
      size: 1,
      contentType: "text/plain",
      relativePath: [],
    }),
  );
  await invalid(() => client.deleteEntry({ scope, entryId: id, token: {} }));
  await invalid(() => client.restoreEntry({ scope, entryId: id, name: 4 }));
  await invalid(() => drive.readTrustedFile(null, id, 100));
  await invalid(() => drive.assertSpaceEmpty(null, null));
  await invalid(() => drive.deleteSpace(null, null));
  for (const input of [null, [], { limit: "1" }, { limit: 0 }])
    await invalid(() => drive.maintenance(input));
  assertUntouched();
});

await test("Drive keeps opaque host cursors and preserves omitted versus explicit restore fields", () => {
  assert.deepEqual(
    parseDriveInput(driveInputs.query, {
      cursor: "opaque:next",
      signal: new AbortController().signal,
      extra: true,
    }),
    { cursor: "opaque:next" },
  );
  assert.deepEqual(parseDriveInput(driveInputs.restore, { scope, entryId: id }), {
    scope,
    entryId: id,
  });
  assert.deepEqual(parseDriveInput(driveInputs.restore, { scope, entryId: id, parentId: null }), {
    scope,
    entryId: id,
    parentId: null,
  });
});

await test("all Blog request methods reject malformed inputs before storage", async () => {
  const { blogs, assertUntouched } = services();
  const client = blogs.client(null);
  for (const input of [null, undefined, [], 42, false]) {
    for (const method of [
      "list",
      "get",
      "assets",
      "create",
      "save",
      "publish",
      "unpublish",
      "delete",
      "upload",
      "saveCategory",
      "deleteCategory",
    ])
      await invalid(() => client[method](input));
    for (const method of Object.keys(client.history))
      await invalid(() => client.history[method](input));
    await invalid(() => blogs.upload(null, input));
    await invalid(() => blogs.listPublished(input));
    await invalid(() => blogs.getPublished(input, "post"));
    await invalid(() => blogs.getPublished("en", input));
    await invalid(() => blogs.readImage(input));
  }
  for (const query of [
    { locale: "en", search: 42 },
    { locale: "en", page: "1" },
    { locale: "en", pageSize: 101 },
  ]) {
    await invalid(() => client.list(query));
    await invalid(() => blogs.listPublished(query));
  }
  for (const input of [
    { ...save, content: null },
    { ...save, shared: [] },
    { ...save, origin: { versionId: false } },
    { ...save, shared: { ...save.shared, categoryIds: [42] } },
    { ...save, content: { ...content, markdown: "a".repeat(1024 * 1024 + 1) } },
  ])
    await invalid(() => client.save(input));
  await invalid(() => client.upload({ id, requestId: id, file: { size: 1 } }));
  await invalid(() =>
    blogs.upload(null, {
      id,
      requestId: "invalid",
      name: "test.png",
      contentType: "image/png",
      bytes: new Uint8Array([1]),
    }),
  );
  await invalid(() =>
    client.history.publish({
      ...mutation,
      locale: "en",
      versionId: id,
      token: "test",
      omitMissingImages: "false",
    }),
  );
  await invalid(() =>
    client.saveCategory({ requestId: id, parentId: null, translations: { en: null } }),
  );
  await invalid(() => blogs.listPublished({ locale: "en", categoryId: 42 }));
  for (const limit of [null, "1", 0, 1001]) await invalid(() => blogs.maintenance(limit));
  assertUntouched();
});

await test("Blog schemas retain incomplete drafts, strip unknown fields and preserve optional origin/author", () => {
  const input = { ...save, editor: { id: "injected" }, shared: { ...save.shared, secret: true } };
  assert.deepEqual(parseBlogInput(blogInputs.save, input), save);
  assert.equal(input.shared.secret, true);
  const history = {
    ...save,
    origin: { versionId: id, repriseId: id },
    shared: { ...save.shared, author: { id: "account", name: "Author" } },
  };
  assert.deepEqual(parseBlogInput(blogInputs.save, history), history);
});

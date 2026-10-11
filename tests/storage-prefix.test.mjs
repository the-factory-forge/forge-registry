import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { createBlogsStorage } =
  await import("../registry/components/plugins/blogs/server/storage.server.ts");
const { createDriveStorage } =
  await import("../registry/components/plugins/drive/server/storage.server.ts");

void test("storage companions require an explicit site and their storage plugin", () => {
  const options = {
    db: {},
    s3: {},
    bucket: "shared-bucket",
    locales: ["en"],
    authorize: async () => true,
    resolveEditor: async () => ({ id: "test", name: "Test" }),
  };
  for (const { create, plugin } of [
    { create: createBlogsStorage, plugin: "blogs" },
    { create: createDriveStorage, plugin: "drive" },
  ]) {
    for (const keyPrefix of [
      undefined,
      "",
      `${plugin}/`,
      "site/",
      `site/${plugin}/nested/`,
      `../${plugin}/`,
      `other/site/${plugin}/`,
      `Site/${plugin}/`,
      "site/wrong-plugin/",
    ]) {
      assert.throws(() => create({ ...options, keyPrefix }), { code: "INVALID" });
    }
    for (const site of ["first-site", "second-site"]) {
      assert.doesNotThrow(() => create({ ...options, keyPrefix: `${site}/${plugin}/` }));
    }
  }
});

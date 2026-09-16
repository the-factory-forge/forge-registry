import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const componentsUrl = new URL("../registry/components/", import.meta.url);
const manifestUrl = new URL("../registry/registry.json", import.meta.url);

test("registry files and targets use only components, pages, layouts, or utils", async () => {
  const directories = (await readdir(componentsUrl, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(directories, ["layouts", "pages", "utils"]);

  const registry = JSON.parse(await readFile(manifestUrl, "utf8"));
  for (const item of registry.items) {
    for (const file of item.files ?? []) {
      const prefix = "registry/components/";
      assert.ok(file.path.startsWith(prefix), item.name + " must live under " + prefix);

      const relativePath = file.path.slice(prefix.length);
      const [directory] = relativePath.split("/");
      if (relativePath.includes("/")) {
        assert.ok(
          directory === "layouts" || directory === "pages" || directory === "utils",
          item.name + " uses unsupported directory " + directory,
        );
      }

      if (directory === "pages") {
        assert.match(item.name, /^page-/);
        assert.match(relativePath.split("/").at(-1), /^page-/);
      }

      assert.equal(file.target, "@components/" + relativePath);
      await access(new URL("../" + file.path, import.meta.url));
    }
  }
});

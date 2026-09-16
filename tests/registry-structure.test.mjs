import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const componentsUrl = new URL("../registry/components/", import.meta.url);
const manifestUrl = new URL("../registry/registry.json", import.meta.url);
const cookieBannerUrl = new URL("../registry/components/cookie-banner.tsx", import.meta.url);

test("registry files and targets use only components, pages, layouts, plugins, or utils", async () => {
  const directories = (await readdir(componentsUrl, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(directories, ["layouts", "pages", "plugins", "utils"]);

  const registry = JSON.parse(await readFile(manifestUrl, "utf8"));
  for (const item of registry.items) {
    for (const file of item.files ?? []) {
      const prefix = "registry/components/";
      assert.ok(file.path.startsWith(prefix), item.name + " must live under " + prefix);

      const relativePath = file.path.slice(prefix.length);
      const [directory] = relativePath.split("/");
      if (relativePath.includes("/")) {
        assert.ok(
          ["layouts", "pages", "plugins", "utils"].includes(directory),
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

test("cookie banner exposes optional choices only during custom selection", async () => {
  const source = await readFile(cookieBannerUrl, "utf8");

  assert.match(source, /\{customizing && \(/);
  assert.match(source, /customizing \? cancelLabel : acceptSelectionLabel/);
  assert.match(source, /customizing \? confirmLabel : acceptAllLabel/);
  assert.doesNotMatch(source, /rejectLabel/);
});

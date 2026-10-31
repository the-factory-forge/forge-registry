import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";

import { parseSync } from "vite";

const prefix = "registry/components/";
const framework = /^(?:next(?:\/|@|$)|@tanstack\/react-(?:router|start))/;

function imports(path, source) {
  if (!/\.[cm]?[jt]sx?$/.test(path)) return [];
  const parsed = parseSync(path, source);
  assert.deepEqual(parsed.errors, [], `${path}: source must parse`);
  const requests = new Set();
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
        "ImportExpression",
        "TSImportType",
      ].includes(node.type) &&
      node.source
    ) {
      const value =
        node.source.type === "TemplateLiteral" && !node.source.expressions.length
          ? node.source.quasis[0].value.cooked
          : node.source.value;
      assert.equal(typeof value, "string", `${path}: imports must use literal paths`);
      requests.add(value);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }
  visit(parsed.program);
  return [...requests];
}

/** Check the source an item can actually install, including its registry dependencies. */
export async function assertRegistryDistribution(root) {
  const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const registry = await json("registry/registry.json");
  const items = new Map(registry.items.map((item) => [item.name, item]));
  assert.equal(items.size, registry.items.length, "registry item names must be unique");
  const sources = new Map();
  const requests = new Map();
  for (const item of items.values()) {
    for (const dependency of [...(item.dependencies ?? []), ...(item.registryDependencies ?? [])]) {
      assert.ok(!framework.test(dependency), `${item.name}: framework dependency ${dependency}`);
      assert.doesNotMatch(
        dependency,
        /^(?:forge-template|cove|(?:file|link|workspace):)/,
        item.name,
      );
    }
    for (const file of item.files ?? []) {
      const path = file.path;
      assert.ok(
        path.startsWith(prefix) && posix.normalize(path) === path,
        `${item.name}: invalid source path ${path}`,
      );
      const relative = path.slice(prefix.length);
      const [directory] = relative.split("/");
      if (relative.includes("/"))
        assert.ok(
          ["connectors", "layouts", "pages", "plugins", "utils"].includes(directory),
          `${item.name}: unsupported directory ${directory}`,
        );
      if (directory === "pages") {
        assert.match(item.name, /^page-/);
        assert.match(posix.basename(path), /^page-/);
      }
      assert.equal(
        file.target,
        "@components/" + relative,
        `${item.name}: incorrect target for ${path}`,
      );
      if (!sources.has(path)) {
        const source = await readFile(new URL(path, root), "utf8");
        assert.doesNotMatch(source, /registry\.the-corner\.io|showroomHead/, path);
        sources.set(path, source);
        requests.set(path, imports(path, source));
      }
    }
  }
  function shipped(item, seen = new Set()) {
    if (seen.has(item.name)) return [];
    seen.add(item.name);
    return [
      ...(item.files ?? []).map((file) => file.path),
      ...(item.registryDependencies ?? []).flatMap((name) => {
        const dependency = name.startsWith("@forge/") && items.get(name.slice(7));
        assert.ok(dependency, `${item.name}: unknown registry dependency ${name}`);
        return shipped(dependency, seen);
      }),
    ];
  }
  for (const item of items.values()) {
    const available = new Set(shipped(item));
    for (const file of item.files ?? []) {
      for (const request of requests.get(file.path)) {
        assert.ok(!framework.test(request), `${item.name}: framework import ${request}`);
        assert.ok(
          !request.startsWith("@/") || request.startsWith("@/components/"),
          `${item.name}: host import ${request}`,
        );
        const path = request.startsWith("@/components/")
          ? prefix + request.slice("@/components/".length)
          : request.startsWith(".")
            ? posix.join(posix.dirname(file.path), request)
            : null;
        if (path)
          assert.ok(
            [path, path + ".ts", path + ".tsx", path + "/index.ts", path + "/index.tsx"].some(
              (candidate) => available.has(candidate),
            ),
            `${item.name}: ${file.path} imports ${request}, which is not shipped by the item or its registry dependencies`,
          );
      }
    }
    const published = await json(`public/r/${item.name}.json`);
    assert.deepEqual(
      published.files.map(({ content: _content, ...file }) => file),
      item.files,
      `${item.name}: generated file metadata differs from the manifest`,
    );
    for (const file of published.files)
      assert.equal(
        file.content,
        sources.get(file.path),
        `${item.name}: stale generated source ${file.path}`,
      );
    for (const key of ["dependencies", "registryDependencies"])
      assert.deepEqual(
        published[key] ?? [],
        item[key] ?? [],
        `${item.name}: stale generated ${key}`,
      );
  }
  assert.deepEqual(
    await json("public/r/registry.json"),
    registry,
    "generated catalog differs from the manifest",
  );
}

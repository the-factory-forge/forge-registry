import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { assertRegistryDistribution } from "./registry-distribution.mjs";

async function fixture(t) {
  const path = await mkdtemp(join(tmpdir(), "forge-distribution-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  const root = pathToFileURL(path + "/");
  const sources = {
    "widget.tsx": `import type { Value } from '@/components/utils/library';
      export type { Value } from './utils/library';
      import './widget.css';
      const lazy = () => import('@/components/utils/shared');
      type Lazy = import('./utils/shared').Value;
      const template = () => import(\`./utils/shared\`);
      const text = "import './not-an-import'";
      // import './also-not-an-import';
      export const Widget = () => <div>{text}</div>;`,
    "widget.css": ".widget { display: grid; }",
    "utils/library/index.ts": "export * from '../shared';",
    "utils/shared.ts": "export type Value = string;",
  };
  const item = (name, paths, registryDependencies = []) => ({
    name,
    type: "registry:ui",
    files: paths.map((path) => ({
      path: "registry/components/" + path,
      target: "@components/" + path,
      type: "registry:component",
    })),
    registryDependencies,
  });
  const registry = {
    items: [
      item("widget", ["widget.tsx", "widget.css"], ["@forge/library"]),
      item("library", ["utils/library/index.ts", "widget.css"], ["@forge/shared"]),
      item("shared", ["utils/shared.ts"]),
    ],
  };
  const write = async (name, value) => {
    const url = new URL(name, root);
    await mkdir(new URL(".", url), { recursive: true });
    await writeFile(url, value);
  };
  const build = async () => {
    await write("registry/registry.json", JSON.stringify(registry));
    await write("public/r/registry.json", JSON.stringify(registry));
    for (const [name, source] of Object.entries(sources))
      await write("registry/components/" + name, source);
    for (const item of registry.items)
      await write(
        `public/r/${item.name}.json`,
        JSON.stringify({
          ...item,
          files: item.files.map((file) => ({
            ...file,
            content: sources[file.path.slice("registry/components/".length)],
          })),
        }),
      );
  };
  await build();
  return { root, registry, sources, build, write };
}

await test("distribution accepts transitive dependencies, shared ownership and every supported import form", async (t) => {
  const { root } = await fixture(t);
  await assertRegistryDistribution(root);
});

for (const { name, change, message } of [
  {
    name: "undeclared dependency",
    change: ({ registry }) => {
      registry.items[0].registryDependencies = [];
    },
    message: /widget.*not shipped/,
  },
  {
    name: "unknown dependency",
    change: ({ registry }) => {
      registry.items[0].registryDependencies = ["@forge/missing"];
    },
    message: /unknown registry dependency/,
  },
  {
    name: "incorrect target",
    change: ({ registry }) => {
      registry.items[0].files[0].target = "@components/wrong.tsx";
    },
    message: /incorrect target/,
  },
  {
    name: "unshipped CSS",
    change: ({ registry }) => {
      for (const item of registry.items)
        item.files = item.files.filter((file) => !file.path.endsWith(".css"));
    },
    message: /widget\.css.*not shipped/,
  },
  {
    name: "showroom import",
    change: ({ sources }) => {
      sources["widget.tsx"] = "export { x } from '@/showroom/x';";
    },
    message: /host import/,
  },
  {
    name: "framework import",
    change: ({ sources }) => {
      sources["widget.tsx"] = "const load = () => import('@tanstack/react-router');";
    },
    message: /framework import/,
  },
  {
    name: "computed import",
    change: ({ sources }) => {
      sources["widget.tsx"] = "const load = (path: string) => import(path);";
    },
    message: /literal paths/,
  },
]) {
  await test(`distribution rejects ${name}`, async (t) => {
    const data = await fixture(t);
    change(data);
    await data.build();
    await assert.rejects(assertRegistryDistribution(data.root), message);
  });
}

await test("distribution rejects missing source and stale generated output", async (t) => {
  const data = await fixture(t);
  await rm(new URL("registry/components/widget.tsx", data.root));
  await assert.rejects(assertRegistryDistribution(data.root), /ENOENT/);
  await data.build();
  await data.write("registry/components/widget.tsx", data.sources["widget.tsx"] + "\n");
  await assert.rejects(assertRegistryDistribution(data.root), /stale generated source/);
  await data.build();
  await data.write(
    "public/r/widget.json",
    JSON.stringify({ ...data.registry.items[0], files: [] }),
  );
  await assert.rejects(assertRegistryDistribution(data.root), /generated file metadata/);
  await data.build();
  await data.write("public/r/registry.json", JSON.stringify({ items: [] }));
  await assert.rejects(assertRegistryDistribution(data.root), /generated catalog differs/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const source = await readFile(
  new URL("../registry/components/native-select.tsx", import.meta.url),
  "utf8",
);
const { code } = await transformWithOxc(source, "native-select.tsx", {
  jsx: { runtime: "automatic" },
});
const resolved = code.replace(
  /"(lucide-react|@\/components\/utils\/cn|react\/jsx-runtime)"/g,
  (_, name) =>
    JSON.stringify(import.meta.resolve(name === "@/components/utils/cn" ? "cnfast" : name)),
);
const { NativeSelect } = await import(
  `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`
);

void test("native select preserves form props and reserves arrows for dropdowns", () => {
  const option = createElement("option", { value: "ready" }, "Ready");
  const html = (props) => renderToStaticMarkup(createElement(NativeSelect, props, option));
  const dropdown = html({
    id: "factory-select-test",
    name: "state",
    required: true,
    disabled: true,
    defaultValue: "ready",
  });
  assert.match(dropdown, /id="factory-select-test"/);
  assert.match(dropdown, /name="state"/);
  assert.match(dropdown, /required=""/);
  assert.match(dropdown, /disabled=""/);
  assert.match(dropdown, /selected=""/);
  assert.match(dropdown, /appearance-none pe-10/);
  assert.match(dropdown, /aria-hidden="true"/);
  for (const props of [{ multiple: true, defaultValue: ["ready"] }, { size: 4 }]) {
    const listbox = html(props);
    assert.doesNotMatch(listbox, /<svg|appearance-none|pe-10/);
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { submitDialogOnShortcut } from "../registry/components/utils/dialog-submit.ts";

test("dialog submission accepts platform shortcuts and respects disabled and unrelated events", () => {
  function press(overrides = {}, { disabled = false, inside = true, hasSubmit = true } = {}) {
    let clicks = 0;
    let prevented = false;
    const event = {
      key: "Enter",
      metaKey: true,
      nativeEvent: { isComposing: false },
      currentTarget: {
        contains: () => inside,
        querySelector: () =>
          hasSubmit ? { matches: () => disabled, click: () => clicks++ } : null,
      },
      preventDefault: () => (prevented = true),
      stopPropagation: () => {},
      ...overrides,
    };
    submitDialogOnShortcut(event);
    return { clicks, prevented };
  }

  assert.deepEqual(press(), { clicks: 1, prevented: true });
  assert.deepEqual(press({ metaKey: false, ctrlKey: true }), { clicks: 1, prevented: true });
  assert.deepEqual(press({}, { disabled: true }), { clicks: 0, prevented: true });
  assert.deepEqual(press({ repeat: true }), { clicks: 0, prevented: true });
  for (const overrides of [
    { key: "Escape" },
    { metaKey: false },
    { altKey: true },
    { shiftKey: true },
    { nativeEvent: { isComposing: true } },
    { defaultPrevented: true },
  ])
    assert.deepEqual(press(overrides), { clicks: 0, prevented: false });
  assert.deepEqual(press({}, { inside: false }), { clicks: 0, prevented: false });
  assert.deepEqual(press({}, { hasSubmit: false }), { clicks: 0, prevented: false });
});

test("modal plugins ship the shared shortcut dependency", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const item = items.find((item) => item.name === "dialog-submit");
  const published = JSON.parse(await readFile("public/r/dialog-submit.json", "utf8"));
  for (const file of item.files)
    assert.equal(
      published.files.find((entry) => entry.path === file.path).content,
      await readFile(file.path, "utf8"),
    );
  for (const name of ["drive", "employees", "menus", "reservations"])
    assert.ok(
      items
        .find((item) => item.name === name)
        .registryDependencies.includes("@forge/dialog-submit"),
      name,
    );
});

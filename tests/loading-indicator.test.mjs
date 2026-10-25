import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createLoadingStore } from "../registry/components/utils/loading-store.ts";

await test("loading starts immediately and hides 300ms after the final completion", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createLoadingStore();
  const changes = [];
  const unsubscribe = store.subscribe(() => changes.push(store.getSnapshot()));
  assert.equal(store.getServerSnapshot(), "idle");
  const first = store.start(),
    second = store.start();
  assert.equal(store.getSnapshot(), "loading");
  first();
  first();
  t.mock.timers.tick(1000);
  assert.equal(store.getSnapshot(), "loading");
  second();
  assert.equal(store.getSnapshot(), "complete");
  t.mock.timers.tick(299);
  assert.equal(store.getSnapshot(), "complete");
  t.mock.timers.tick(1);
  assert.equal(store.getSnapshot(), "idle");
  assert.deepEqual(changes, ["loading", "complete", "idle"]);
  unsubscribe();
});

await test("new work cancels a pending hide and gets its own completion hold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createLoadingStore();
  store.start()();
  t.mock.timers.tick(250);
  const finish = store.start();
  t.mock.timers.tick(500);
  assert.equal(store.getSnapshot(), "loading");
  finish();
  assert.equal(store.getSnapshot(), "complete");
  t.mock.timers.tick(299);
  assert.equal(store.getSnapshot(), "complete");
  t.mock.timers.tick(1);
  assert.equal(store.getSnapshot(), "idle");
});

await test("disposing cancels outstanding work and timers without affecting another app", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const first = createLoadingStore(),
    second = createLoadingStore();
  const stale = first.start();
  second.start();
  first.dispose();
  stale();
  assert.equal(first.getSnapshot(), "idle");
  assert.equal(second.getSnapshot(), "loading");
  const finish = first.start();
  t.mock.timers.tick(1000);
  assert.equal(first.getSnapshot(), "loading");
  finish();
  first.dispose();
  t.mock.timers.tick(300);
  assert.equal(first.getSnapshot(), "idle");
  second.dispose();
});

await test("plugins ship the shared loading indicator and its complete source", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const item = items.find((item) => item.name === "loading-indicator");
  const generated = JSON.parse(await readFile("public/r/loading-indicator.json", "utf8"));
  for (const file of item.files)
    assert.equal(
      generated.files.find((entry) => entry.path === file.path).content,
      await readFile(file.path, "utf8"),
    );
  for (const name of [
    "auth",
    "blogs",
    "customers",
    "drive",
    "employees",
    "menus",
    "projects",
    "reservations",
  ])
    assert.ok(
      items
        .find((item) => item.name === name)
        .registryDependencies.includes("@forge/loading-indicator"),
      name,
    );
});

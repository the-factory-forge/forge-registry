import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

let server, browser, base;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
async function fixture(t, kind = "hook", options = {}) {
  const page = await browser.newPage({ reducedMotion: "reduce", ...options });
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/drive-listing.html?kind=${kind}`);
  await calls(page, 1);
  return page;
}
const calls = (page, count) =>
  page.waitForFunction((n) => window.listingTest?.requests.length === n, count);
const resolve = (page, index, name) =>
  page.evaluate(([i, value]) => window.listingTest.requests[i].resolve(value), [index, name]);
const reject = (page, index, code) =>
  page.evaluate(([i, value]) => window.listingTest.requests[i].reject(value), [index, code]);
const state = (page) => page.locator("output").textContent().then(JSON.parse);
const settled = (page) =>
  page.waitForFunction(() => !JSON.parse(document.querySelector("output").textContent).loading);

void test("superseded responses cannot replace data or its timestamp, including after client replacement", async (t) => {
  const page = await fixture(t);
  await page.evaluate(() => {
    Date.now = () => 1000;
  });
  await resolve(page, 0, "Initial");
  await settled(page);
  await page.evaluate(() => window.listingTest.refresh());
  await calls(page, 2);
  await page.evaluate(() => window.listingTest.replaceClient());
  await calls(page, 3);
  assert.equal((await state(page)).data.name, "Initial");
  assert.equal((await state(page)).loading, true);
  assert.equal(await page.evaluate(() => window.listingTest.requests[1].signal.aborted), true);
  await page.evaluate(() => {
    Date.now = () => 2000;
  });
  await resolve(page, 2, "Current");
  await settled(page);
  await resolve(page, 1, "Stale");
  assert.equal((await state(page)).data.name, "Current");
  assert.equal((await state(page)).loadedAt, 2000);
  await page.evaluate(() => window.listingTest.refresh());
  await calls(page, 4);
  await page.evaluate(() => window.listingTest.refresh());
  await calls(page, 5);
  await reject(page, 3, "FORBIDDEN");
  assert.equal((await state(page)).data.name, "Current");
  assert.equal((await state(page)).loading, true);
  await page.evaluate(() => window.listingTest.unmount());
  assert.equal(await page.evaluate(() => window.listingTest.requests[4].signal.aborted), true);
  await resolve(page, 4, "Unmounted");
  assert.equal(await page.locator("output").count(), 0);
});

void test("failures retain the last successful snapshot except denied or missing listings", async (t) => {
  const page = await fixture(t);
  await resolve(page, 0, "Initial");
  await settled(page);
  const timestamp = (await state(page)).loadedAt;
  for (const [index, code] of ["STORAGE", "FORBIDDEN", "NOT_FOUND"].entries()) {
    if (index > 0) {
      await page.evaluate(() => window.listingTest.refresh());
      await calls(page, index * 2 + 1);
      await resolve(page, index * 2, "Initial");
      await settled(page);
    }
    await page.evaluate(() => window.listingTest.refresh());
    await calls(page, index * 2 + 2);
    assert.equal((await state(page)).error, undefined);
    await reject(page, index * 2 + 1, code);
    await settled(page);
    const result = await state(page);
    assert.equal(result.error.code, code);
    assert.equal(result.data?.name, code === "STORAGE" ? "Initial" : undefined);
    assert.equal(result.loadedAt, code === "STORAGE" ? timestamp : undefined);
  }
});

void test("refresh keeps a pending optimistic edit and rollback uses the refreshed data", async (t) => {
  const page = await fixture(t);
  await resolve(page, 0, "Initial");
  await settled(page);
  await page.evaluate(() => window.listingTest.mutate());
  await page.waitForFunction(
    () => JSON.parse(document.querySelector("output").textContent).pending,
  );
  await page.evaluate(() => window.listingTest.refresh());
  await calls(page, 2);
  await resolve(page, 1, "Refreshed");
  await settled(page);
  assert.equal((await state(page)).data.name, "Optimistic");
  await page.evaluate(() => window.listingTest.rejectMutation());
  await page.waitForFunction(
    () => !JSON.parse(document.querySelector("output").textContent).pending,
  );
  assert.equal((await state(page)).data.name, "Refreshed");
});

for (const kind of ["spaces", "folder", "trash"]) {
  void test(`${kind} retains rows on failure, disables actions, retries and clears denied data`, async (t) => {
    const page = await fixture(t, kind);
    await resolve(page, 0, "Retained row");
    const row = page.getByRole("row").filter({ hasText: "Retained row" });
    await row.waitFor();
    await page.evaluate(() => window.listingTest.replaceClient());
    await calls(page, 2);
    assert.equal(await row.isVisible(), true);
    await reject(page, 1, "STORAGE");
    const retry = page.getByRole("button", { name: "Retry", exact: true }).first();
    await retry.waitFor();
    assert.equal(await row.isVisible(), true);
    assert.equal(
      await page.getByRole("button", { name: "Next page", exact: true }).isDisabled(),
      true,
    );
    for (const button of await row.getByRole("button").all())
      assert.equal(await button.isDisabled(), true);
    await retry.click();
    await calls(page, 3);
    await resolve(page, 2, "Recovered row");
    await page.getByRole("row").filter({ hasText: "Recovered row" }).waitFor();
    assert.equal(await row.count(), 0);
    await page.evaluate(() => window.listingTest.replaceClient());
    await calls(page, 4);
    await reject(page, 3, "FORBIDDEN");
    await page.getByRole("row").filter({ hasText: "Recovered row" }).waitFor({ state: "hidden" });
  });
}

void test("restore destinations retain disabled options and recover without moving the picker", async (t) => {
  for (const [width, colorScheme] of [
    [390, "dark"],
    [1440, "light"],
  ]) {
    const page = await fixture(t, "trash", { viewport: { width, height: 900 }, colorScheme });
    await resolve(page, 0, "Deleted row");
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Restore files and folders", exact: true });
    const picker = dialog.getByRole("combobox", { name: "Destination folder" });
    await calls(page, 2);
    await resolve(page, 1, "Destination");
    await picker
      .getByRole("option", { name: "Destination", exact: true })
      .waitFor({ state: "attached" });
    const before = await picker.boundingBox();
    await dialog.getByRole("button", { name: "Next page", exact: true }).click();
    await calls(page, 3);
    await reject(page, 2, "STORAGE");
    const retry = dialog.getByRole("button", { name: "Retry", exact: true });
    await retry.waitFor();
    assert.equal(await picker.isDisabled(), true);
    assert.equal(await picker.getByRole("option", { name: "Destination", exact: true }).count(), 1);
    assert.equal(
      await dialog.getByRole("button", { name: "Restore", exact: true }).isDisabled(),
      true,
    );
    assert.ok(Math.abs((await picker.boundingBox()).y - before.y) <= 1);
    await page.screenshot({ path: `/tmp/drive-listing-${width}-${colorScheme}.png` });
    await retry.click();
    await calls(page, 4);
    await resolve(page, 3, "Recovered destination");
    await picker
      .getByRole("option", { name: "Recovered destination", exact: true })
      .waitFor({ state: "attached" });
    assert.equal(await picker.isEnabled(), true);
    await page.close();
  }
});

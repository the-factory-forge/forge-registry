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
async function fixture(t) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await page.goto(`${base}tests/fixtures/menu-items.html`);
  await handle(page, "A First").waitFor();
  return page;
}
const handle = (page, name) =>
  page.getByRole("button", { name: `Reorder item: ${name}`, exact: true });
const rows = (page) => page.locator("tr[data-menu-item]:visible td:nth-child(2)").allTextContents();
const calls = (page, count) =>
  page.waitForFunction((n) => window.menuItemsTest.calls.length === n, count);
const resolve = (page, index) =>
  page.evaluate((i) => window.menuItemsTest.calls[i].resolve(), index);
const reject = (page, index) => page.evaluate((i) => window.menuItemsTest.calls[i].reject(), index);
const switchClient = (page, scope) =>
  page.evaluate((value) => window.menuItemsTest.switchClient(value), scope);
const confirmation = (page) =>
  page.getByRole("dialog", { name: "Delete selected items?", exact: true });
async function selectTwo(page) {
  await page.getByRole("checkbox", { name: "Select row: A First", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select row: A Second", exact: true }).check();
  await page.getByRole("button", { name: "Delete selected items (2)", exact: true }).click();
}

for (const outcome of ["success", "failure"]) {
  void test(`an old reorder ${outcome} cannot replace, reload or notify the new client`, async (t) => {
    const page = await fixture(t);
    await handle(page, "A First").press("ArrowDown");
    await calls(page, 3);
    await switchClient(page, "B");
    await handle(page, "B First").waitFor();
    await calls(page, 5);
    await (outcome === "success" ? resolve : reject)(page, 2);
    await page.waitForFunction(
      () =>
        document
          .querySelector('button[aria-label="Reorder item: B First"]')
          ?.getAttribute("aria-disabled") === "false",
    );
    assert.deepEqual(await rows(page), ["B First", "B Second", "B Third"]);
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(await page.getByText("Saved.", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.menuItemsTest.calls.length), 5);
  });
}

void test("A to B to A starts a new list session and rejects old reads and writes", async (t) => {
  const page = await fixture(t);
  await handle(page, "A First").press("ArrowDown");
  await calls(page, 3);
  await page.evaluate(() => window.menuItemsTest.holdReads(true));
  await switchClient(page, "B");
  await calls(page, 5);
  await switchClient(page, "A");
  await calls(page, 7);
  await resolve(page, 5);
  await resolve(page, 6);
  await reject(page, 2);
  await resolve(page, 3);
  await reject(page, 4);
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-label="Reorder item: A First"]')
        ?.getAttribute("aria-disabled") === "false",
  );
  assert.deepEqual(await rows(page), ["A First", "A Second", "A Third"]);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.evaluate(() => window.menuItemsTest.calls.length), 7);
});

void test("client replacement clears unconfirmed selections and their dialog", async (t) => {
  const page = await fixture(t);
  await selectTwo(page);
  await switchClient(page, "B");
  await handle(page, "B First").waitFor();
  await confirmation(page).waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 0);
  assert.equal(
    await page.evaluate(() => window.menuItemsTest.calls.some((call) => call.kind === "remove")),
    false,
  );
});

void test("confirmed batches finish on the original client and retry only its failed item", async (t) => {
  const page = await fixture(t);
  await selectTwo(page);
  await confirmation(page).getByRole("button", { name: "Delete", exact: true }).click();
  await calls(page, 3);
  await switchClient(page, "B");
  await page.locator('button[aria-label="Reorder item: B First"]').waitFor();
  await calls(page, 5);
  await resolve(page, 2);
  await calls(page, 6);
  await reject(page, 5);
  await confirmation(page).getByRole("alert").waitFor();
  assert.deepEqual(await confirmation(page).getByRole("listitem").allTextContents(), ["A Second"]);
  assert.deepEqual(await rows(page), ["B First", "B Second", "B Third"]);
  await confirmation(page).getByRole("button", { name: "Delete", exact: true }).click();
  await calls(page, 7);
  await resolve(page, 6);
  await confirmation(page).waitFor({ state: "hidden" });
  assert.deepEqual(
    await page.evaluate(() =>
      window.menuItemsTest.calls
        .filter((call) => call.kind === "remove")
        .map(({ scope, input }) => [scope, input]),
    ),
    [
      ["A", "1"],
      ["A", "2"],
      ["A", "2"],
    ],
  );
  assert.deepEqual(await rows(page), ["B First", "B Second", "B Third"]);
  assert.equal(await page.evaluate(() => window.menuItemsTest.calls.length), 7);
});

void test("single deletion from an old client cannot remove a replacement row or reload it", async (t) => {
  const page = await fixture(t);
  await page.getByRole("button", { name: "Delete item: A First", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await calls(page, 3);
  await switchClient(page, "B");
  await handle(page, "B First").waitFor();
  await calls(page, 5);
  await resolve(page, 2);
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-label="Reorder item: B First"]')
        ?.getAttribute("aria-disabled") === "false",
  );
  assert.deepEqual(await rows(page), ["B First", "B Second", "B Third"]);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.evaluate(() => window.menuItemsTest.calls.length), 5);
});

void test("reordering accepts canonical versions, rolls back failures and gates writes during refresh", async (t) => {
  const page = await fixture(t);
  await handle(page, "A First").press("ArrowDown");
  await calls(page, 3);
  await resolve(page, 2);
  await page.getByText("Saved.", { exact: true }).waitFor();
  assert.deepEqual(await rows(page), ["A Second", "A First", "A Third"]);
  await page.evaluate(() => window.menuItemsTest.holdReads(true));
  await handle(page, "A First").press("ArrowUp");
  await calls(page, 4);
  assert.deepEqual(await page.evaluate(() => window.menuItemsTest.calls[3].input), [
    { id: "1", version: 2 },
    { id: "2", version: 2 },
    { id: "3", version: 2 },
  ]);
  await reject(page, 3);
  await calls(page, 6);
  assert.deepEqual(await rows(page), ["A Second", "A First", "A Third"]);
  assert.equal(await handle(page, "A First").getAttribute("aria-disabled"), "true");
  await reject(page, 4);
  await resolve(page, 5);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await calls(page, 8);
  await resolve(page, 6);
  await resolve(page, 7);
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-label="Reorder item: A First"]')
        ?.getAttribute("aria-disabled") === "false",
  );
  assert.deepEqual(await rows(page), ["A Second", "A First", "A Third"]);
});

void test("single deletion retains failure recovery then refreshes after success", async (t) => {
  const page = await fixture(t);
  await page.getByRole("button", { name: "Delete item: A First", exact: true }).click();
  const modal = page.getByRole("dialog");
  const confirm = modal.getByRole("button", { name: "Delete permanently", exact: true });
  await confirm.click();
  await calls(page, 3);
  await reject(page, 2);
  await modal.getByRole("alert").waitFor();
  assert.deepEqual(await rows(page), ["A First", "A Second", "A Third"]);
  await page.evaluate(() => window.menuItemsTest.holdReads(true));
  await confirm.click();
  await calls(page, 4);
  await resolve(page, 3);
  await calls(page, 6);
  await modal.waitFor({ state: "hidden" });
  assert.deepEqual(await rows(page), ["A Second", "A Third"]);
  assert.equal(await handle(page, "A Second").getAttribute("aria-disabled"), "true");
  await resolve(page, 4);
  await resolve(page, 5);
});

void test("an in-progress drag cannot commit against replacement rows with the same IDs", async (t) => {
  const page = await fixture(t);
  const first = await handle(page, "A First").boundingBox();
  const last = await handle(page, "A Third").boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2 + 4, { steps: 6 });
  await page.locator("[data-menu-drag-preview]").waitFor();
  await switchClient(page, "B");
  await handle(page, "B First").waitFor();
  await page.mouse.up();
  assert.equal(await page.locator("[data-menu-drag-preview]").count(), 0);
  assert.equal(
    await page.evaluate(() => window.menuItemsTest.calls.some((call) => call.kind === "reorder")),
    false,
  );
  assert.deepEqual(await rows(page), ["B First", "B Second", "B Third"]);
});

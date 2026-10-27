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
  await page.goto(`${base}tests/fixtures/menu-taxonomy.html`);
  await page.getByText("A category", { exact: true }).waitFor();
  return page;
}
const calls = (page, count) =>
  page.waitForFunction((n) => window.taxonomyTest.calls.length === n, count);
const resolve = (page, index) =>
  page.evaluate((i) => window.taxonomyTest.calls[i].resolve(), index);
const reject = (page, index) => page.evaluate((i) => window.taxonomyTest.calls[i].reject(), index);
const row = (page, text) => page.getByRole("listitem").filter({ hasText: text });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
async function edit(page, kind, name, value) {
  await row(page, name)
    .getByRole("button", { name: `Edit ${kind}`, exact: true })
    .click();
  const form = dialog(page, `Edit ${kind}`);
  await form.getByRole("textbox", { name: "Name (English) *", exact: true }).fill(value);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  return form;
}

void test("late mutations from an old client cannot change or refresh the current taxonomy", async (t) => {
  const page = await fixture(t);
  await edit(page, "category", "A category", "Saved A");
  await calls(page, 3);
  await page.evaluate(() => window.taxonomyTest.switchClient("B"));
  await page.getByText("B category", { exact: true }).waitFor();
  await calls(page, 5);
  assert.equal(
    await page.getByRole("button", { name: "New category", exact: true }).isEnabled(),
    true,
  );
  await page.evaluate(() => window.taxonomyTest.holdReads(true));
  await resolve(page, 2);
  await page.getByRole("button", { name: "New category", exact: true }).waitFor();
  assert.equal(await page.getByText("B category", { exact: true }).isVisible(), true);
  assert.equal(await page.getByText("Saved A", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.taxonomyTest.calls.length), 5);
  await page.evaluate(() => {
    window.taxonomyTest.holdReads(false);
    window.taxonomyTest.switchClient("A");
  });
  await page.getByText("Saved A", { exact: true }).waitFor();
});

void test("returning to the same client starts a new session and ignores its old read and write", async (t) => {
  const page = await fixture(t);
  await edit(page, "label", "A label", "Old session");
  await calls(page, 3);
  await page.evaluate(() => {
    window.taxonomyTest.holdReads(true);
    window.taxonomyTest.switchClient("B");
  });
  await calls(page, 5);
  await page.evaluate(() => window.taxonomyTest.switchClient("A"));
  await calls(page, 7);
  await resolve(page, 5);
  await resolve(page, 6);
  await page.getByText("A label (dietary)", { exact: true }).waitFor();
  await resolve(page, 2);
  await resolve(page, 3);
  await reject(page, 4);
  assert.equal(await page.getByText("A label (dietary)", { exact: true }).isVisible(), true);
  assert.equal(
    await page.getByRole("button", { name: "New label", exact: true }).isEnabled(),
    true,
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.evaluate(() => window.taxonomyTest.calls.length), 7);
});

void test("canonical saves stay visible while refresh gates the next write and retains failed reads", async (t) => {
  const page = await fixture(t);
  await page.evaluate(() => window.taxonomyTest.holdReads(true));
  await edit(page, "category", "A category", "Saved category");
  await calls(page, 3);
  await resolve(page, 2);
  await dialog(page, "Edit category").waitFor({ state: "hidden" });
  await calls(page, 5);
  await page.getByText("Saved category", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "New label", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await row(page, "A label")
      .getByRole("button", { name: "Edit label", exact: true })
      .isDisabled(),
    true,
  );
  await reject(page, 3);
  await resolve(page, 4);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await calls(page, 7);
  await resolve(page, 5);
  await resolve(page, 6);
  const form = await edit(page, "label", "A label", "Saved label");
  await calls(page, 8);
  await reject(page, 7);
  await form.getByRole("alert").waitFor();
  assert.equal(await form.getByRole("textbox").inputValue(), "Saved label");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await calls(page, 9);
  await resolve(page, 8);
  await form.waitFor({ state: "hidden" });
  await calls(page, 11);
  await resolve(page, 9);
  await resolve(page, 10);
  await page.getByText("Saved label (dietary)", { exact: true }).waitFor();
});

void test("deletion retains its confirmation and row on failure, then refreshes after a single retry", async (t) => {
  const page = await fixture(t);
  await row(page, "A label")
    .getByRole("button", { name: "Delete label: A label", exact: true })
    .click();
  const confirmation = dialog(page, "Delete label: A label");
  const confirm = confirmation.getByRole("button", { name: "Delete permanently", exact: true });
  await confirm.click();
  await calls(page, 3);
  assert.equal(await confirm.isDisabled(), true);
  await reject(page, 2);
  await confirmation.getByRole("alert").waitFor();
  assert.equal(await page.locator("li").filter({ hasText: "A label" }).isVisible(), true);
  await confirm.click();
  await calls(page, 4);
  await resolve(page, 3);
  await confirmation.waitFor({ state: "hidden" });
  await calls(page, 6);
  assert.equal(await page.getByText("A label (dietary)", { exact: true }).count(), 0);
});

for (const kind of ["category", "label"]) {
  void test(`creating a ${kind} replaces its temporary row with the canonical ID`, async (t) => {
    const page = await fixture(t);
    await page.getByRole("button", { name: `New ${kind}`, exact: true }).click();
    const form = dialog(page, `New ${kind}`);
    await form.getByRole("textbox").fill("Created");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await calls(page, 3);
    assert.equal(
      await form.getByRole("button", { name: "Saving…", exact: true }).isDisabled(),
      true,
    );
    await resolve(page, 2);
    await form.waitFor({ state: "hidden" });
    await calls(page, 5);
    assert.equal(await row(page, "Created").count(), 1);
    await row(page, "Created")
      .getByRole("button", { name: `Delete ${kind}: Created`, exact: true })
      .click();
    await dialog(page, `Delete ${kind}: Created`)
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await calls(page, 6);
    assert.equal(await page.evaluate(() => window.taxonomyTest.calls[5].input), `new-${kind}`);
    await resolve(page, 5);
    await calls(page, 8);
    assert.equal(await row(page, "Created").count(), 0);
  });
}

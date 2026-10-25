import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

import { actionToast } from "./action-toast-helpers.mjs";

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
async function fixture(t, legacy = false) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/blog-draft.html${legacy ? "?legacy" : ""}`);
  await page.waitForFunction(() => !!window.draftTest);
  return page;
}
const calls = (page, kind, count) =>
  page.waitForFunction(([k, n]) => window.draftTest.calls[k].length === n, [kind, count]);
const resolve = (page, kind, index) =>
  page.evaluate(([k, i]) => window.draftTest.calls[k][i].resolve(), [kind, index]);
const reject = (page, kind, index, code) =>
  page.evaluate(([k, i, c]) => window.draftTest.calls[k][i].reject(c), [kind, index, code]);
const inputs = (page) => page.evaluate(() => window.draftTest.calls.save.map((call) => call.input));
const title = (page) => page.getByRole("textbox", { name: "Title", exact: true });
const panel = (page) => page.getByRole("complementary", { name: "History · EN", exact: true });
const leave = (page) => page.getByRole("dialog", { name: "Keep your changes?", exact: true });
const save = (page) => page.getByRole("button", { name: "Save draft", exact: true });
async function history(page) {
  await calls(page, "list", 1);
  await resolve(page, "list", 0);
  await panel(page).locator('ol[aria-busy="false"]').waitFor();
}
async function inspect(page, number) {
  await panel(page)
    .getByRole("button", { name: new RegExp(`^v${number}\\b`) })
    .click();
}

void test("late history responses cannot replace the current client or selection", async (t) => {
  const page = await fixture(t);
  await calls(page, "list", 1);
  await page.evaluate(() => {
    window.draftTest.correct();
    window.draftTest.replaceClient();
  });
  await calls(page, "list", 2);
  await resolve(page, "list", 1);
  const count = panel(page).getByText("Publications 5 / 5 · Drafts 5 / 8", { exact: true });
  await count.waitFor();
  await resolve(page, "list", 0);
  assert.equal(await count.isVisible(), true);
  await inspect(page, 23);
  await calls(page, "body", 1);
  await inspect(page, 22);
  await calls(page, "body", 2);
  await resolve(page, "body", 1);
  await page.getByRole("heading", { name: "v22", exact: true }).waitFor();
  await reject(page, "body", 0, "NOT_FOUND");
  assert.equal(await page.getByRole("heading", { name: "v22", exact: true }).isVisible(), true);
  await inspect(page, 21);
  await calls(page, "body", 3);
  await inspect(page, 20);
  await calls(page, "body", 4);
  await resolve(page, "body", 3);
  await page.getByRole("heading", { name: "v20", exact: true }).waitFor();
  await resolve(page, "body", 2);
  assert.equal(await page.getByRole("heading", { name: "v20", exact: true }).isVisible(), true);
  await inspect(page, 18);
  await calls(page, "body", 5);
  await page.evaluate(() => window.draftTest.unmount());
  await resolve(page, "body", 4);
  assert.equal(await page.getByRole("heading").count(), 0);
});

void test("failed save keeps the navigation dialog and draft; retry continues only after acceptance", async (t) => {
  const page = await fixture(t);
  await history(page);
  await page.evaluate(() => window.draftTest.hold("save", true));
  await title(page).fill("Keep my draft");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await leave(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await calls(page, "save", 1);
  await reject(page, "save", 0, "STORAGE");
  await leave(page)
    .getByRole("button", { name: "Save draft", exact: true })
    .waitFor({ state: "visible" });
  assert.equal(await leave(page).isVisible(), true);
  // The modal makes the background inaccessible, but its draft must stay mounted.
  assert.equal(await page.locator('input[id$="-title"]').inputValue(), "Keep my draft");
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), "English");
  await leave(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await calls(page, "save", 2);
  assert.equal((await inputs(page))[0].requestId, (await inputs(page))[1].requestId);
  await resolve(page, "save", 1);
  await page.getByRole("tabpanel", { name: "Français", exact: true }).waitFor();
  assert.equal(await leave(page).count(), 0);
  await page.getByRole("tab", { name: "English", exact: true }).click();
  assert.equal(await title(page).inputValue(), "Keep my draft");
});

void test("explicit refresh rebases a resumed dirty draft without replacing its content, settings or origin", async (t) => {
  const page = await fixture(t);
  await history(page);
  await inspect(page, 22);
  await calls(page, "body", 1);
  await resolve(page, "body", 0);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  await title(page).fill("My resumed article");
  await page.getByRole("combobox", { name: "Author", exact: true }).selectOption("alex");
  await page.evaluate(() => {
    window.draftTest.correct();
    window.draftTest.hold("save", true);
  });
  await save(page).click();
  await calls(page, "save", 1);
  await reject(page, "save", 0, "CONFLICT");
  await page.getByRole("button", { name: "Refresh article", exact: true }).click();
  await calls(page, "article", 1);
  await page
    .getByRole("button", { name: "Refresh article", exact: true })
    .waitFor({ state: "hidden" });
  await save(page).click();
  await calls(page, "save", 2);
  const [before, after] = await inputs(page);
  assert.equal(after.version, before.version + 1);
  assert.notEqual(after.requestId, before.requestId);
  assert.deepEqual(after.content, before.content);
  assert.deepEqual(after.shared, before.shared);
  assert.equal(after.shared.author.id, "alex");
  assert.deepEqual(after.origin, before.origin);
  assert.ok(after.origin.repriseId);
  await resolve(page, "save", 1);
  await actionToast(page, "Draft saved.");
  assert.equal(await title(page).inputValue(), "My resumed article");
  assert.equal(await page.evaluate(() => window.draftTest.dirtyChanges.at(-1)), false);
});

void test("clients without history retain direct publication and edit sessions reset only at navigation boundaries", async (t) => {
  const page = await fixture(t, true);
  assert.equal(await page.getByRole("button", { name: "History", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await actionToast(page, "This language is no longer public.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published.");
  await title(page).fill("Local edit");
  await page.evaluate(() => {
    window.draftTest.correct();
    window.draftTest.rerenderArticle();
  });
  assert.equal(await title(page).inputValue(), "Local edit");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await leave(page).getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await title(page).inputValue(), "Local edit");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await leave(page).getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByRole("tabpanel", { name: "Français", exact: true }).waitFor();
  await page.getByRole("tab", { name: "English", exact: true }).click();
  assert.notEqual(await title(page).inputValue(), "Local edit");
  await title(page).fill("Another local edit");
  await page.evaluate(() => window.draftTest.switchArticle());
  assert.notEqual(await title(page).inputValue(), "Another local edit");
  assert.equal(await page.evaluate(() => window.draftTest.dirtyChanges.at(-1)), false);
});

void test("category navigation protects drafts and preserves keyboard access", async (t) => {
  const page = await fixture(t, true);
  const link = page.getByRole("link", { name: "Manage categories", exact: true });
  assert.equal(await link.getAttribute("href"), "#categories");
  await link.focus();
  await page.getByRole("tooltip", { name: "Manage categories", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await title(page).fill("Keep this category draft");
  await link.click();
  await leave(page).getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await title(page).inputValue(), "Keep this category draft");
  assert.equal(new URL(page.url()).hash, "");
  await link.click();
  await leave(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await page.waitForURL("**#categories");
  assert.equal(
    await page.evaluate(() => window.draftTest.current().translations.en.draft.title),
    "Keep this category draft",
  );
});

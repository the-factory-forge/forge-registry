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
const name = (page) => page.getByRole("textbox", { name: "Name *", exact: true });
const save = (page) => page.locator("form").getByRole("button", { name: "Save", exact: true });
async function fixture(t) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await page.goto(`${base}tests/fixtures/menu-label-navigation.html`);
  await name(page).waitFor();
  return page;
}
const calls = (page, count) =>
  page.waitForFunction((n) => window.menuLabelTest.calls.length === n, count);
const settle = (page, index, success = true) =>
  page.evaluate(
    async ([i, ok]) => {
      window.menuLabelTest.calls[i][ok ? "resolve" : "reject"]();
      await new Promise(requestAnimationFrame);
    },
    [index, success],
  );

const link = (page) => page.getByRole("link", { name: "Manage labels", exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Keep your changes?", exact: true });
const cancel = (page) => dialog(page).getByRole("button", { name: "Cancel", exact: true }).last();
const dialogSave = (page) => dialog(page).getByRole("button", { name: "Save", exact: true });

void test("unchanged items navigate directly; cancel and discard never save", async (t) => {
  const clean = await fixture(t);
  await link(clean).click();
  await clean.waitForURL("**#labels");
  assert.equal(await dialog(clean).count(), 0);
  const page = await fixture(t);
  await name(page).fill("Unsaved dish");
  await link(page).click();
  await cancel(page).click();
  assert.equal(await name(page).inputValue(), "Unsaved dish");
  assert.equal(new URL(page.url()).hash, "");
  await link(page).click();
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await name(page).inputValue(), "Unsaved dish");
  await link(page).click();
  await dialog(page).getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.waitForURL("**#labels");
  assert.equal(await page.evaluate(() => window.menuLabelTest.calls.length), 0);
});

void test("all edited item fields trigger protection", async (t) => {
  const edits = [
    (page) => page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("12.34"),
    (page) => page.getByRole("combobox", { name: "Category", exact: true }).selectOption("drinks"),
    (page) =>
      page.getByRole("textbox", { name: "Description", exact: true }).fill("New description"),
    (page) => page.getByRole("button", { name: "Add size", exact: true }).click(),
    (page) => page.getByRole("radio", { name: "Spicy", exact: true }).check(),
    (page) => page.getByRole("checkbox", { name: "Vegan", exact: true }).check(),
    (page) => page.getByRole("checkbox", { name: "Visible on menu", exact: true }).uncheck(),
    (page) => page.getByRole("checkbox", { name: "Sold out", exact: true }).check(),
    (page) => page.getByRole("button", { name: "Remove photo", exact: true }).click(),
    async (page) => {
      await page.getByRole("tab", { name: "French", exact: true }).click();
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("Plat");
    },
  ];
  for (const edit of edits) {
    const page = await fixture(t);
    await edit(page);
    await link(page).click();
    await dialog(page).waitFor();
    await cancel(page).click();
    assert.equal(new URL(page.url()).hash, "");
  }
});

void test("failed saves retain the dialog and draft; pending saves block dismissal and retry navigates after success", async (t) => {
  const page = await fixture(t);
  await name(page).fill("Saved before leaving");
  await link(page).click();
  await dialogSave(page).click();
  await calls(page, 1);
  assert.equal(await cancel(page).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await dialog(page).isVisible(), true);
  assert.equal(new URL(page.url()).hash, "");
  await settle(page, 0, false);
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(
    await page.locator('input[aria-label="Name *"]').inputValue(),
    "Saved before leaving",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      await dialog(page).screenshot({ path: `/tmp/menu-unsaved-${width}-${theme}.png` });
    }
  }
  await dialogSave(page).click();
  await calls(page, 2);
  await settle(page, 1);
  await page.waitForURL("**#labels");
  assert.equal(
    await page.evaluate(() => window.menuLabelTest.saved[0].translations.en.name),
    "Saved before leaving",
  );
});

void test("validation keeps staff in the editor and focuses the invalid field", async (t) => {
  const page = await fixture(t);
  const price = page.getByRole("textbox", { name: "Price (CHF)", exact: true });
  await price.fill("invalid");
  await link(page).click();
  await dialogSave(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await price.getAttribute("aria-invalid"), "true");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Price (CHF)",
  );
  assert.equal(await price.inputValue(), "invalid");
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.evaluate(() => window.menuLabelTest.calls.length), 0);
});

void test("ordinary saves clear only submitted edits and block navigation while pending", async (t) => {
  const page = await fixture(t);
  await name(page).fill("Submitted");
  await save(page).click();
  await calls(page, 1);
  assert.equal(await link(page).getAttribute("aria-disabled"), "true");
  await link(page).dispatchEvent("click", { button: 0 });
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await dialog(page).count(), 0);
  await name(page).fill("Typed during save");
  await settle(page, 0);
  await save(page).waitFor();
  await link(page).click();
  await cancel(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await name(page).inputValue(), "Typed during save");
  await save(page).click();
  await calls(page, 2);
  await settle(page, 1);
  await save(page).waitFor();
  await link(page).click();
  await page.waitForURL("**#labels");
  assert.equal(await dialog(page).count(), 0);
});

void test("new items save before leaving and unmounted editors cannot resume navigation", async (t) => {
  const page = await fixture(t);
  await page.goto(`${base}tests/fixtures/menu-label-navigation.html?new`);
  await name(page).fill("New dish");
  await link(page).click();
  await dialogSave(page).click();
  await calls(page, 1);
  assert.equal(await page.evaluate(() => window.menuLabelTest.calls[0].id), undefined);
  await settle(page, 0);
  await page.waitForURL("**#labels");
  const other = await fixture(t);
  await name(other).fill("Do not navigate");
  await link(other).click();
  await dialogSave(other).click();
  await calls(other, 1);
  await other.evaluate(() => window.menuLabelTest.unmount());
  await settle(other, 0);
  assert.equal(new URL(other.url()).hash, "");
});

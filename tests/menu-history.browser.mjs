import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const directory = "/en/admin/menus";
const editPath = `${directory}/30000000-0000-4000-8000-000000000001`;
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
const name = (page) => page.getByRole("textbox", { name: "Name *", exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Keep your changes?", exact: true });
const cancel = (page) => dialog(page).getByRole("button", { name: "Cancel", exact: true }).last();
async function editor(t, create = false) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base + directory);
  await page
    .getByRole("link", {
      name: create ? "New item" : "Edit item: Burrata with tomatoes",
      exact: true,
    })
    .click();
  await name(page).waitFor();
  return page;
}

void test("browser Back cancel retains the route and draft; discard and Forward preserve history", async (t) => {
  const page = await editor(t);
  await name(page).fill("Unsaved history draft");
  await page.shell.evaluate(() => history.back());
  await dialog(page).waitFor();
  await cancel(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await name(page).inputValue(), "Unsaved history draft");
  assert.equal(new URL(page.url()).pathname, editPath);
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, directory);
  await page.shell.evaluate(() => history.forward());
  await name(page).waitFor();
  assert.equal(await name(page).inputValue(), "Burrata with tomatoes");
  await page.shell.evaluate(() => history.back());
  await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
  assert.equal(await dialog(page).count(), 0);
});

void test("browser Back saves existing and new items before resuming the original transition", async (t) => {
  for (const create of [false, true]) {
    const page = await editor(t, create);
    const title = create ? "Created before Back" : "Saved before Back";
    await name(page).fill(title);
    await page.shell.evaluate(() => history.back());
    await dialog(page).getByRole("button", { name: "Save", exact: true }).click();
    assert.equal(await cancel(page).isDisabled(), true);
    await page.keyboard.press("Escape");
    assert.equal(await dialog(page).isVisible(), true);
    await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, directory);
    await page.getByRole("link", { name: `Edit item: ${title}`, exact: true }).waitFor();
  }
});

void test("browser Back validation and server errors keep the draft available", async (t) => {
  const page = await editor(t);
  const price = page.getByRole("textbox", { name: "Price (CHF)", exact: true });
  await price.fill("invalid");
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await price.getAttribute("aria-invalid"), "true");
  assert.equal(new URL(page.url()).pathname, editPath);
  await price.fill("19.50");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save", exact: true }).click();
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(new URL(page.url()).pathname, editPath);
  await cancel(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await price.inputValue(), "19.50");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
});

void test("document exits warn while dirty; confirmed link navigation avoids a second warning", async (t) => {
  const page = await editor(t);
  await name(page).fill("Keep through reload");
  const warnings = [];
  page.on("dialog", async (warning) => {
    warnings.push(warning.type());
    await warning.dismiss();
  });
  const warning = page.waitForEvent("dialog");
  await page.shell.evaluate(() => location.reload());
  await warning;
  assert.equal(await name(page).inputValue(), "Keep through reload");
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
  assert.deepEqual(warnings, ["beforeunload"]);
});

void test("Back during an ordinary save stays put until persistence completes", async (t) => {
  for (const create of [false, true]) {
    const page = await editor(t, create);
    await name(page).fill("Saved with pending Back");
    await page.locator("form").getByRole("button", { name: "Save", exact: true }).click();
    await page.shell.evaluate(() => history.back());
    await page.getByRole("heading", { name: "Edit item", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('a[aria-disabled="true"]'));
    assert.equal(await dialog(page).count(), 0);
    assert.equal(await name(page).inputValue(), "Saved with pending Back");
    assert.notEqual(new URL(page.url()).pathname, directory);
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
    await page.getByRole("heading", { name: "Menu items", exact: true }).waitFor();
    assert.equal(await dialog(page).count(), 0);
  }
});

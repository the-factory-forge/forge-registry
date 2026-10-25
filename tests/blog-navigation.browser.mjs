import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const directory = "/en/admin/blogs";
const editPath = `${directory}/b1000000-0000-4000-8000-000000000001`;
const initialTitle = "Make room for better ideas";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
const title = (page) => page.getByRole("textbox", { name: "Title", exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Keep your changes?", exact: true });
const cancel = (page) => dialog(page).getByRole("button", { name: "Cancel", exact: true });
const save = (page) => page.getByRole("button", { name: "Save draft", exact: true });
const list = (page) => page.getByRole("heading", { name: "Blog posts", exact: true });
async function editor(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base + directory);
  await page.getByRole("link", { name: `Edit: ${initialTitle}`, exact: true }).click();
  await title(page).waitFor();
  return page;
}

void test("browser Back cancel preserves the blog draft and discard preserves Forward history", async (t) => {
  const page = await editor(t);
  await title(page).fill("Unsaved blog draft");
  await page.shell.evaluate(() => history.back());
  await cancel(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).pathname, editPath);
  assert.equal(await title(page).inputValue(), "Unsaved blog draft");
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Discard changes", exact: true }).click();
  await list(page).waitFor();
  assert.equal(new URL(page.url()).pathname, directory);
  await page.shell.evaluate(() => history.forward());
  await title(page).waitFor();
  assert.equal(await title(page).inputValue(), initialTitle);
  await page.shell.evaluate(() => history.back());
  await list(page).waitFor();
  assert.equal(await dialog(page).count(), 0);
});

void test("browser Back saves the current language and shared settings before leaving", async (t) => {
  const page = await editor(t);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await title(page).fill("Brouillon enregistré avant retour");
  await page.getByRole("combobox", { name: "Author", exact: true }).selectOption("alex");
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save draft", exact: true }).click();
  assert.equal(await cancel(page).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await dialog(page).isVisible(), true);
  await list(page).waitFor();
  assert.equal(new URL(page.url()).pathname, directory);
  await page.shell.evaluate(() => history.forward());
  await title(page).waitFor();
  assert.equal(await title(page).inputValue(), initialTitle);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(await title(page).inputValue(), "Brouillon enregistré avant retour");
  assert.equal(
    await page.getByRole("combobox", { name: "Author", exact: true }).inputValue(),
    "alex",
  );
});

void test("browser Back validation and storage errors retain the blog draft", async (t) => {
  const page = await editor(t);
  const slug = page.getByRole("textbox", { name: "Slug", exact: true });
  await slug.fill("Invalid slug");
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await slug.getAttribute("aria-invalid"), "true");
  assert.equal(new URL(page.url()).pathname, editPath);
  await slug.fill("saved-after-failure");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await dialog(page).getByRole("alert").waitFor();
  await cancel(page).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await slug.inputValue(), "saved-after-failure");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.shell.evaluate(() => history.back());
  await dialog(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await list(page).waitFor();
});

void test("Back during a pending blog save stays in the editor; saved drafts leave without a prompt", async (t) => {
  const page = await editor(t);
  await title(page).fill("Saved before leaving");
  await save(page).click();
  await page.shell.evaluate(() => history.back());
  await save(page).waitFor();
  assert.equal(new URL(page.url()).pathname, editPath);
  assert.equal(await title(page).inputValue(), "Saved before leaving");
  assert.equal(await dialog(page).count(), 0);
  await page.shell.evaluate(() => history.back());
  await list(page).waitFor();
  await page.getByRole("link", { name: "Edit: Saved before leaving", exact: true }).waitFor();
});

void test("reload warns about dirty drafts and confirmed link departures do not warn twice", async (t) => {
  for (const action of ["Discard changes", "Save draft"]) {
    const page = await editor(t);
    await title(page).fill("Keep through reload");
    const warnings = [];
    page.on("dialog", async (warning) => {
      warnings.push(warning.type());
      await warning.dismiss();
    });
    const warning = page.waitForEvent("dialog");
    await page.shell.evaluate(() => location.reload());
    await warning;
    assert.equal(await title(page).inputValue(), "Keep through reload");
    await page.getByRole("link", { name: "← Back to posts", exact: true }).click();
    await dialog(page).getByRole("button", { name: action, exact: true }).click();
    await list(page).waitFor();
    assert.deepEqual(warnings, ["beforeunload"]);
  }
});

void test("confirmed article deletion returns to the list without a stale-draft prompt", async (t) => {
  const page = await editor(t);
  await title(page).fill("Discard through deletion");
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await list(page).waitFor();
  assert.equal(await dialog(page).count(), 0);
  assert.equal(
    await page.getByRole("link", { name: `Edit: ${initialTitle}`, exact: true }).count(),
    0,
  );
});

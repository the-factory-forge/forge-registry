import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
const leave = (page) => page.getByRole("dialog", { name: "Keep your changes?", exact: true });
const cancel = (page) => leave(page).getByRole("button", { name: "Cancel", exact: true }).last();
const labelEditor = (page) => page.getByRole("dialog", { name: /^(Edit|New) label$/ });
const cases = [
  {
    name: "blog categories",
    directory: "/en/admin/blogs",
    route: "/en/admin/blogs/categories",
    link: "Manage categories",
    heading: "Blog posts",
    original: "Ideas & practice",
    save: "Save category",
    open: async (page, create) => {
      await page
        .getByRole("button", { name: create ? "Create" : "Ideas & practice", exact: true })
        .click();
    },
    input: (page) =>
      page
        .getByRole("group", { name: "English", exact: true })
        .getByRole("textbox", { name: "Category name", exact: true }),
    saved: (page, name) => page.getByRole("button", { name, exact: true }),
  },
  {
    name: "menu labels",
    directory: "/en/admin/menus",
    route: "/en/admin/menus/taxonomy",
    link: "Categories / Labels",
    heading: "Menu items",
    original: "Vegetarian",
    save: "Save",
    open: async (page, create) => {
      if (create)
        await page
          .locator("section")
          .filter({ has: page.getByRole("heading", { name: "Labels", exact: true }) })
          .last()
          .getByRole("button", { name: "Create", exact: true })
          .click();
      else
        await page
          .getByRole("listitem")
          .filter({ hasText: "Vegetarian" })
          .getByRole("button", { name: "Edit label", exact: true })
          .click();
    },
    input: (page) =>
      labelEditor(page).getByRole("textbox", { name: "Name (English) *", exact: true }),
    saved: (page, name) => page.getByText(`${name} (dietary)`, { exact: true }),
  },
];
async function editor(t, config, create = false, fail = false) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base + config.directory);
  await page.getByRole("link", { name: config.link, exact: true }).click();
  if (fail) await page.getByLabel("Simulate action failures", { exact: true }).check();
  await config.open(page, create);
  await config.input(page).waitFor();
  return page;
}
for (const config of cases) {
  void test(`${config.name}: Back cancel preserves edits and discard preserves Forward history`, async (t) => {
    const page = await editor(t, config);
    await config.input(page).fill("Unsaved taxonomy");
    await page.shell.evaluate(() => history.back());
    await cancel(page).click();
    await leave(page).waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).pathname, config.route);
    assert.equal(await config.input(page).inputValue(), "Unsaved taxonomy");
    await page.shell.evaluate(() => history.back());
    await leave(page).getByRole("button", { name: "Discard changes", exact: true }).click();
    await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, config.directory);
    await page.shell.evaluate(() => history.forward());
    await config.open(page, false);
    assert.equal(await config.input(page).inputValue(), config.original);
    await page.shell.evaluate(() => history.back());
    await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
    assert.equal(await leave(page).count(), 0);
  });
  void test(`${config.name}: Back saves edited and newly created records before continuing`, async (t) => {
    for (const create of [false, true]) {
      const page = await editor(t, config, create);
      const name = create ? "Created before Back" : "Saved before Back";
      await config.input(page).fill(name);
      if (config.name === "menu labels" && create)
        await labelEditor(page)
          .getByRole("combobox", { name: "Label type", exact: true })
          .selectOption("dietary");
      await page.shell.evaluate(() => history.back());
      await leave(page).getByRole("button", { name: config.save, exact: true }).click();
      assert.equal(await cancel(page).isDisabled(), true);
      await page.keyboard.press("Escape");
      assert.equal(await leave(page).isVisible(), true);
      await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, config.directory);
      await page.shell.evaluate(() => history.forward());
      await config.saved(page, name).waitFor();
    }
  });
  void test(`${config.name}: failed saves keep the dialog and draft available`, async (t) => {
    const page = await editor(t, config, false, true);
    await config.input(page).fill("Keep failed taxonomy");
    await page.shell.evaluate(() => history.back());
    await leave(page).getByRole("button", { name: config.save, exact: true }).click();
    await leave(page).getByRole("alert").waitFor();
    await cancel(page).click();
    await leave(page).waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).pathname, config.route);
    assert.equal(await config.input(page).inputValue(), "Keep failed taxonomy");
    if (config.name === "menu labels") {
      await labelEditor(page).getByRole("button", { name: "Cancel", exact: true }).click();
      await labelEditor(page).waitFor({ state: "hidden" });
    }
    await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
    if (config.name === "menu labels") await config.open(page, false);
    await page.shell.evaluate(() => history.back());
    await leave(page).getByRole("button", { name: config.save, exact: true }).click();
    await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
  });
  void test(`${config.name}: ordinary saves block Back until persistence completes`, async (t) => {
    const page = await editor(t, config);
    const name = "Saved during Back";
    await config.input(page).fill(name);
    const save =
      config.name === "menu labels"
        ? labelEditor(page).getByRole("button", { name: config.save, exact: true })
        : page.locator("form").getByRole("button", { name: config.save, exact: true });
    await save.click();
    await page.shell.evaluate(() => history.back());
    await config.saved(page, name).waitFor();
    if (config.name === "menu labels") await labelEditor(page).waitFor({ state: "hidden" });
    else await page.waitForFunction(() => !document.querySelector("form fieldset[disabled]"));
    assert.equal(new URL(page.url()).pathname, config.route);
    assert.equal(await leave(page).count(), 0);
    await page.shell.evaluate(() => history.back());
    await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
    assert.equal(await leave(page).count(), 0);
  });
  void test(`${config.name}: native reload warnings retain edits`, async (t) => {
    const page = await editor(t, config);
    await config.input(page).fill("Keep through reload");
    const warnings = [];
    page.on("dialog", async (warning) => {
      warnings.push(warning.type());
      await warning.dismiss();
    });
    const warning = page.waitForEvent("dialog");
    await page.shell.evaluate(() => location.reload());
    await warning;
    assert.equal(await config.input(page).inputValue(), "Keep through reload");
    assert.deepEqual(warnings, ["beforeunload"]);
  });
}
void test("menu label Back validation returns to the open editor without losing fields", async (t) => {
  const config = cases[1];
  const page = await editor(t, config);
  await config.input(page).fill("");
  await page.shell.evaluate(() => history.back());
  await leave(page).getByRole("button", { name: "Save", exact: true }).click();
  await leave(page).waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).pathname, config.route);
  assert.equal(await config.input(page).evaluate((node) => node.validity.valueMissing), true);
  await config.input(page).fill("Valid after correction");
  await page.shell.evaluate(() => history.back());
  await leave(page).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: config.heading, exact: true }).waitFor();
});

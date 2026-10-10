import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3100";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function open(t, path, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

async function focused(control) {
  await control
    .page()
    .waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
  assert.equal(await control.evaluate((node) => node === document.activeElement), true);
  assert.equal(await control.getAttribute("aria-invalid"), "true");
}

async function sticky(button) {
  const state = await button.evaluate((node) => {
    const bar = node.closest(".sticky");
    const rect = node.getBoundingClientRect();
    return {
      sticky: bar && getComputedStyle(bar).position,
      visible: rect.top >= 0 && rect.bottom <= innerHeight,
    };
  });
  assert.deepEqual(state, { sticky: "sticky", visible: true });
}

for (const width of [1440, 390]) {
  void test(`blog guides successive corrections and keeps actions visible at ${width}px`, async (t) => {
    const page = await open(t, "/en/admin/blogs/b1000000-0000-4000-8000-000000000004", width);
    if (width === 390) await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const save = page.getByRole("button", { name: "Save draft", exact: true });
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await page.getByRole("textbox", { name: "Title", exact: true }).scrollIntoViewIfNeeded();
    await sticky(save);
    assert.equal(await page.getByText("Publishing requires", { exact: false }).count(), 0);
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    const slug = page.getByRole("textbox", { name: "Slug", exact: true });
    const markdown = page.getByRole("textbox", { name: "Markdown", exact: true });
    await title.fill(" ");
    await slug.fill("");
    await save.click();
    await actionToast(page, "Draft saved.");
    await publish.click();
    await focused(title);
    await page.screenshot({ path: `/tmp/editor-validation-${width}.png` });
    await title.fill("Corrected title");
    assert.equal(await title.evaluate((node) => node === document.activeElement), true);
    assert.equal(await title.getAttribute("aria-invalid"), "false");
    await save.click();
    await actionToast(page, "Draft saved.");
    await publish.click();
    await focused(slug);
    await slug.fill("corrected-title");
    await save.click();
    await actionToast(page, "Draft saved.");
    await publish.click();
    await focused(markdown);
    await sticky(save);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await markdown.fill("Ready to publish.");
    await save.click();
    await actionToast(page, "Draft saved.");
    await publish.click();
    await actionToast(page, "This language is now published.");
  });
}

void test("menu errors focus price, then reveal the missing base translation", async (t) => {
  const page = await open(t, "/en/admin/menus/new", 390);
  const save = page.getByRole("button", { name: "Save", exact: true });
  const price = page.getByRole("textbox", { name: "Price (CHF)", exact: true });
  await price.fill("-1");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await save.click();
  await focused(price);
  await price.fill("12.50");
  await save.click();
  await focused(page.getByRole("textbox", { name: "Name *", exact: true }));
  await sticky(save);
  await page.screenshot({ path: "/tmp/menu-editor-validation-mobile.png" });
});

void test("publishing points to a selected category missing its translation", async (t) => {
  const page = await open(t, "/en/admin/blogs/categories");
  await page
    .getByRole("group", { name: "English", exact: true })
    .getByLabel("Category name", { exact: true })
    .fill("English only");
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await actionToast(page, "Category saved.");
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("link", { name: "An idea for tomorrow", exact: true }).click();
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Article");
  await page.getByRole("textbox", { name: "Slug", exact: true }).fill("article");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("Contenu");
  const category = page.getByRole("checkbox", { name: "English only", exact: true });
  await category.check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await focused(category);
  await page.getByRole("alert").filter({ hasText: "Translate this category" }).waitFor();
  await category.uncheck();
  assert.equal(await category.getAttribute("aria-invalid"), "false");
});

for (const [path, action, name] of [
  ["/en/customers/new", "Create customer", "Full name *"],
  ["/en/projects/new", "Create project", "Name *"],
]) {
  void test(`${path} uses shared correction focus and sticky actions`, async (t) => {
    const page = await open(t, path, 390);
    const button = page.getByRole("button", { name: action, exact: true });
    await button.click();
    const field = page.getByRole("textbox", { name, exact: true });
    await focused(field);
    await sticky(button);
    await field.fill("Corrected name");
    assert.equal(await field.getAttribute("aria-invalid"), "false");
    assert.equal(await field.evaluate((node) => node === document.activeElement), true);
  });
}

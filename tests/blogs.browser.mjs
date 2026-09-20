import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const existing = "b1000000-0000-4000-8000-000000000001";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t, path = "/en/blogs", options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}
async function saved(page) {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Draft saved." }).waitFor();
}
test("public listing, filtering, translated article, Markdown SSR, and responsive themes", async (t) => {
  const page = await preview(t);
  assert.equal(await page.locator("article").count(), 3);
  await page.getByRole("link", { name: "Inside the studio (1)", exact: true }).click();
  await page
    .getByRole("heading", { name: "Make room for better ideas", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("link", { name: "All categories", exact: true }).click();
  await page.getByRole("heading", { name: "Make room for better ideas", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search posts", exact: true }).fill("quieter");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("heading", { name: "A quieter kind of productivity", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Notes from our workbench", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  await page.getByRole("heading", { name: "Faire de la place aux idées", exact: true }).waitFor();
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("link", { name: "Faire de la place aux idées", exact: true }).click();
  await page.getByRole("heading", { name: "Commencer par une question", exact: true }).waitFor();
  const html = await (await fetch(`${baseURL}/en/blogs/make-room-for-better-ideas`)).text();
  assert.match(html, /Begin with a question/);
  assert.doesNotMatch(html, /An idea for tomorrow/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-blogs-mobile-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("heading", { name: "Our blog", exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/forge-blogs-desktop-light.png", fullPage: true });
});
test("create, retained failures, duplicate prevention, drafts, attribution, and public navigation", async (t) => {
  const page = await preview(t, "/en/admin/blogs");
  await page.getByRole("link", { name: "New post", exact: true }).click();
  await page.getByLabel("Title *", { exact: true }).fill("A browser-created post");
  await page.getByRole("button", { name: "Create draft", exact: true }).dblclick();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("## A useful heading\n\n**Careful writing** matters.");
  await page.getByRole("heading", { name: "A useful heading", exact: true }).waitFor();
  await page.getByLabel("Fail mutations", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.match(
    await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
    /Careful writing/,
  );
  await page.getByLabel("Fail mutations", { exact: true }).uncheck();
  await saved(page);
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "This language is now published" }).waitFor();
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("link", { name: "A browser-created post", exact: true }).click();
  await page.getByText("Alex Morgan", { exact: true }).last().waitFor();
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search posts", exact: true }).fill("browser-created");
  await page.getByRole("link", { name: "A browser-created post", exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Make room for better ideas", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("row").count(), 2);
  await page.getByRole("link", { name: "A browser-created post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("An unfinished rewrite");
  await saved(page);
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("link", { name: "A browser-created post", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "An unfinished rewrite", exact: true }).count(),
    0,
  );
});
test("image upload failure/retry, Markdown insertion, keyboard toolbar, deletion focus and read-only", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`);
  const upload = page.getByLabel("Upload image — Thumbnail", { exact: true }),
    file = new URL("../public/blogs/studio-2.png", import.meta.url).pathname;
  await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
  await upload.setInputFiles(file);
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  await upload.setInputFiles(file);
  await page.getByRole("status").filter({ hasText: "Image uploaded." }).waitFor();
  assert.match(await page.getByLabel("Thumbnail", { exact: true }).inputValue(), /^[\da-f-]+$/);
  const text = page.getByRole("textbox", { name: "Markdown", exact: true });
  await text.fill("A new paragraph");
  await text.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Bold", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await text.inputValue(), "**A new paragraph**");
  await page.getByLabel("Insert image", { exact: true }).setInputFiles(file);
  await page.getByRole("status").filter({ hasText: "Image uploaded." }).waitFor();
  assert.match(await text.inputValue(), /\.\/assets\/[\da-f-]+/);
  await saved(page);
  const trigger = page.getByRole("button", { name: "Delete article", exact: true });
  await trigger.click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await page.getByLabel("Read-only", { exact: true }).check();
  assert.equal(await page.getByRole("button", { name: "Save draft", exact: true }).count(), 0);
  assert.equal(await text.isDisabled(), true);
  await page.getByLabel("Read-only", { exact: true }).uncheck();
  await trigger.click();
  await page.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Make room for better ideas", exact: true }).count(),
    0,
  );
});
test("categories, optional translations, required publication fields, directory states", async (t) => {
  const page = await preview(t, "/en/admin/blogs/categories");
  const english = page.getByRole("group", { name: "English", exact: true }),
    french = page.getByRole("group", { name: "Français", exact: true });
  await english.getByLabel("Category name", { exact: true }).fill("New category");
  await french.getByLabel("Category name", { exact: true }).fill("Nouvelle catégorie");
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Categories", exact: true })
    .getByRole("button", { name: "New category", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await page.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByLabel("Directory state", { exact: true }).selectOption("loading");
  await page.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await page.getByLabel("Directory state", { exact: true }).selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Unable to load blog posts." }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("link", { name: "An idea for tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Check your fields" }).waitFor();
  await page.getByLabel("Language", { exact: true }).selectOption("fr");
  await page.getByLabel("Title", { exact: true }).fill("Une idée");
  await page.getByLabel("Slug", { exact: true }).fill("une-idee");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("Un nouveau texte.");
  await saved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "This language is now published" }).waitFor();
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  await page.getByRole("link", { name: "Une idée", exact: true }).waitFor();
});

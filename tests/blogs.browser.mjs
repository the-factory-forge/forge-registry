import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

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
  await actionToast(page, "Draft saved.");
}
void test("editor publication badge saves immediately and protects drafts on failure", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`, {
    viewport: { width: 1440, height: 1000 },
  });
  const badge = page.getByRole("button", { name: "Publication status", exact: true });
  assert.equal(await badge.getAttribute("aria-pressed"), "true");
  await badge.focus();
  await page.keyboard.press("Space");
  assert.equal(await badge.isDisabled(), true);
  assert.equal(await badge.getAttribute("aria-pressed"), "false");
  await actionToast(page, "This language is no longer public");
  assert.equal(await badge.textContent(), "Draft");
  assert.equal(await badge.getAttribute("aria-pressed"), "false");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(await badge.textContent(), "Published");
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await badge.focus();
  await page.keyboard.press("Enter");
  await actionToast(page, "This language is now published");
  assert.equal(await badge.getAttribute("aria-pressed"), "true");

  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("A protected revision");
  assert.equal(await badge.isDisabled(), true);
  await saved(page);
  assert.equal(await badge.textContent(), "Unpublished changes");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await badge.click();
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await badge.textContent(), "Unpublished changes");
  assert.equal(await badge.getAttribute("aria-pressed"), "true");
  assert.equal(await title.inputValue(), "A protected revision");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await badge.click();
  await actionToast(page, "This language is no longer public");
  assert.equal(await badge.textContent(), "Draft");
  assert.equal(await title.inputValue(), "A protected revision");
  await page.getByRole("tabpanel").locator("header").screenshot({
    path: "/tmp/forge-blog-toggle-editor-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("tabpanel").locator("header").screenshot({
    path: "/tmp/forge-blog-toggle-editor-mobile-dark.png",
  });
  await page.getByLabel("Read-only", { exact: true }).check();
  assert.equal(await badge.count(), 0);
});

void test("table language badges toggle independently and roll back invalid or failed publication", async (t) => {
  const page = await preview(t, "/en/admin/blogs", {
    viewport: { width: 1440, height: 1000 },
  });
  const row = page.getByRole("row").filter({
    has: page.locator(`a[href="/en/admin/blogs/${existing}"]`),
  });
  const english = row.getByRole("button", { name: "Publication status: EN", exact: true });
  const french = row.getByRole("button", { name: "Publication status: FR", exact: true });
  await english.click();
  assert.equal(await english.isDisabled(), true);
  assert.equal(await french.isDisabled(), true);
  assert.equal(await english.getAttribute("aria-pressed"), "false");
  await actionToast(page, "This language is no longer public");
  assert.equal(await english.getAttribute("aria-pressed"), "false");
  assert.equal(await french.getAttribute("aria-pressed"), "true");
  await english.focus();
  await page.keyboard.press("Enter");
  await actionToast(page, "This language is now published");
  assert.equal(await english.getAttribute("aria-pressed"), "true");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await french.click();
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await french.getAttribute("aria-pressed"), "true");
  assert.equal(await english.getAttribute("aria-pressed"), "true");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await french.click();
  await actionToast(page, "This language is no longer public");
  assert.equal(await french.getAttribute("aria-pressed"), "false");
  await row.screenshot({ path: "/tmp/forge-blog-toggle-table-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await french.scrollIntoViewIfNeeded();
  await row.getByRole("cell").nth(2).screenshot({
    path: "/tmp/forge-blog-toggle-table-mobile-dark.png",
  });
  const draft = page.getByRole("row").filter({ hasText: "An idea for tomorrow" });
  const draftBadge = draft.getByRole("button", { name: "Publication status: EN", exact: true });
  await draftBadge.click();
  await page.getByRole("alert").filter({ hasText: "Check your fields" }).waitFor();
  assert.equal(await draftBadge.getAttribute("aria-pressed"), "false");
  await page.getByLabel("Read-only", { exact: true }).check();
  assert.equal(await row.getByRole("button", { name: /^Publication status:/ }).count(), 0);
});

test("publish is hidden until the selected translation has unpublished changes", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  const unpublish = page.getByRole("button", { name: "Unpublish", exact: true });
  assert.equal(await publish.count(), 0);
  assert.equal(await unpublish.isEnabled(), true);

  await page.getByLabel("Title", { exact: true }).fill("A revised title");
  assert.equal(await publish.count(), 0);
  await saved(page);
  assert.equal(await publish.isEnabled(), true);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(await publish.count(), 0);
  await page.getByRole("tab", { name: "English", exact: true }).click();
  assert.equal(await publish.isEnabled(), true);
  await publish.click();
  await actionToast(page, "This language is now published");
  assert.equal(await publish.count(), 0);
  assert.equal(await unpublish.isEnabled(), true);

  await unpublish.click();
  await actionToast(page, "This language is no longer public");
  assert.equal(await publish.isEnabled(), true);
  assert.equal(await unpublish.count(), 0);
});
test("admin categories stay readable and long table text truncates in both themes", async (t) => {
  const page = await preview(t, "/en/admin/blogs", { viewport: { width: 1440, height: 1000 } });
  const row = page.getByRole("row").filter({
    has: page.locator(`a[href="/en/admin/blogs/${existing}"]`),
  });
  await page.getByRole("columnheader", { name: "Categories", exact: true }).waitFor();
  assert.equal(await row.getByRole("cell").nth(1).textContent(), "Ideas & practice, Design");
  const draft = page.getByRole("row").filter({ hasText: "An idea for tomorrow" });
  assert.equal(await draft.getByRole("cell").nth(1).textContent(), "—");
  await page.getByRole("link", { name: "Manage categories", exact: true }).click();
  await page.getByRole("button", { name: "Ideas & practice", exact: true }).click();
  const categoryName = "A category with a name that is far too long to fit in a compact table cell";
  await page
    .getByRole("group", { name: "English", exact: true })
    .getByLabel("Category name", { exact: true })
    .fill(categoryName);
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await actionToast(page, "Category saved.");
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await row.getByRole("link", { name: "Make room for better ideas", exact: true }).click();
  const title =
    "A post title that is far too long to fit in a compact table cell without truncation";
  await page.getByLabel("Title", { exact: true }).fill(title);
  await saved(page);
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const link = row.getByRole("link", { name: title, exact: true });
    const category = row.getByRole("cell").nth(1).locator("p");
    assert.equal(await link.getAttribute("title"), title);
    assert.deepEqual(
      (await category.getAttribute("title")).split(", ").sort(),
      [categoryName, "Design"].sort(),
    );
    for (const text of [link, category]) {
      assert.equal(
        await text.evaluate((node) => {
          const style = getComputedStyle(node);
          return style.textOverflow === "ellipsis" && node.scrollWidth > node.clientWidth;
        }),
        true,
      );
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await row.getByRole("button", { name: `Delete post: ${title}`, exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.screenshot({ path: `/tmp/forge-blogs-categories-${theme}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  const frenchRow = page.getByRole("row").filter({
    has: page.locator(`a[href="/fr/admin/blogs/${existing}"]`),
  });
  assert.deepEqual((await frenchRow.getByRole("cell").nth(1).textContent()).split(", ").sort(), [
    "Design",
    "Idées et pratique",
  ]);
});
test("editor groups child categories with their parent and preserves linked selection", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`, {
    viewport: { width: 1440, height: 1000 },
  });
  const group = page.getByRole("group", { name: "Categories", exact: true });
  const parent = group.getByRole("checkbox", { name: "Ideas & practice", exact: true });
  const child = group.getByRole("checkbox", { name: "Design", exact: true });
  const parentItem = group.locator(":scope > ul > li").filter({
    has: page.getByRole("checkbox", { name: "Design", exact: true }),
  });
  assert.equal(
    await parentItem.locator("ul").getByRole("checkbox", { name: "Design", exact: true }).count(),
    1,
  );
  assert.equal(
    await parentItem.getByRole("checkbox", { name: "Inside the studio", exact: true }).count(),
    0,
  );
  await parent.uncheck();
  assert.equal(await child.isChecked(), false);
  await child.press("Space");
  assert.equal(await parent.isChecked(), true);
  assert.equal(await child.isChecked(), true);
  await saved(page);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(
    await group.getByRole("checkbox", { name: "Idées et pratique", exact: true }).isChecked(),
    true,
  );
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    const nested = parentItem.locator("ul");
    assert.equal(await nested.evaluate((node) => getComputedStyle(node).borderLeftWidth), "1px");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await group.screenshot({ path: `/tmp/forge-blog-category-hierarchy-${theme}.png` });
  }
  await page.getByLabel("Read-only", { exact: true }).check();
  assert.equal(await child.isDisabled(), true);
});
test("list deletion confirms the selected post, retains failures, and respects permissions", async (t) => {
  const page = await preview(t, "/en/admin/blogs");
  const title = "Make room for better ideas";
  const trigger = page.getByRole("button", { name: `Delete post: ${title}`, exact: true });
  const post = page.getByText(title, { exact: true });
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Delete post: ${title}`, exact: true });
  await dialog.waitFor();
  await dialog
    .getByText("This removes every translation and publication.", { exact: false })
    .waitFor();
  assert.equal(await post.count(), 1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  assert.equal(await post.count(), 1);
  await page.getByLabel("Read-only", { exact: true }).check();
  assert.equal(await page.getByRole("button", { name: /^Delete post:/ }).count(), 0);
  await page.getByLabel("Read-only", { exact: true }).uncheck();
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await trigger.click();
  const confirmBeforeFailure = dialog.getByRole("button", {
    name: "Delete permanently",
    exact: true,
  });
  const beforeFailure = await confirmBeforeFailure.boundingBox();
  await confirmBeforeFailure.click();
  await dialog.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal((await confirmBeforeFailure.boundingBox()).y, beforeFailure.y);
  assert.equal(await post.count(), 1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.screenshot({ path: "/tmp/forge-blogs-delete-desktop-light.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await trigger.click();
  await dialog.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-blogs-delete-mobile-dark.png", fullPage: true });
  const confirm = dialog.getByRole("button", { name: "Delete permanently", exact: true });
  await confirm.click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await post.count(), 0);
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  assert.equal(await page.getByRole("link", { name: title, exact: true }).count(), 0);
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  assert.equal(
    await page.getByRole("link", { name: "Faire de la place aux idées", exact: true }).count(),
    0,
  );
});
test("showroom illustrations load without cropping in both themes", async (t) => {
  const page = await preview(t);
  const paths = await page
    .locator("article h2 a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const seen = new Set();
  for (const path of ["/en/blogs", ...paths]) {
    await page.goto(baseURL + path);
    await page.locator('[data-preview-ready="true"]').waitFor();
    for (const theme of ["Light", "Dark"]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
        await toggle.click();
      for (const image of await page
        .locator('article img[src^="https://assets.the-corner.io/images/"]')
        .all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node) => node.decode());
        const state = await image.evaluate((node) => ({
          src: node.getAttribute("src"),
          alt: node.alt,
          width: node.naturalWidth,
          fit: getComputedStyle(node).objectFit,
          filter: getComputedStyle(node).filter,
        }));
        assert.ok(state.width > 0);
        assert.ok(state.alt.length > 0);
        assert.equal(state.fit, "contain");
        assert.equal(state.filter, theme === "Dark" ? "invert(1)" : "none");
        seen.add(state.src);
      }
    }
  }
  assert.equal(seen.size, 6);
});
void test("public search debounces typing, clears filters, and keeps Enter submission", async (t) => {
  const page = await preview(t);
  await page.clock.install();
  await page.getByRole("link", { name: "Ideas & practice (2)", exact: true }).click();
  const category = new URL(page.url()).searchParams.get("category");
  const search = page.getByRole("searchbox", { name: "Search posts", exact: true });
  const form = page.locator("form").filter({ has: search });
  assert.equal(await form.getByRole("button").count(), 0);
  await form.evaluate((node) => {
    node.dataset.submissions = "0";
    node.addEventListener("submit", () => {
      node.dataset.submissions = String(Number(node.dataset.submissions) + 1);
    });
  });
  await search.fill("quiet");
  await page.clock.runFor(200);
  await search.fill("quieter");
  await page.clock.runFor(299);
  assert.equal(await form.getAttribute("data-submissions"), "0");
  await page.clock.runFor(1);
  await page.waitForURL((url) => url.searchParams.get("search") === "quieter");
  assert.equal(new URL(page.url()).searchParams.get("category"), category);
  assert.equal(await page.locator("article").count(), 1);
  assert.equal(await form.getAttribute("data-submissions"), "1");

  await search.fill("");
  await page.clock.runFor(300);
  await page.waitForURL((url) => !url.searchParams.has("search"));
  assert.equal(new URL(page.url()).searchParams.get("category"), category);
  assert.equal(await page.locator("article").count(), 2);
  await search.fill("quieter");
  await search.press("Enter");
  await page.waitForURL((url) => url.searchParams.get("search") === "quieter");
  await page.clock.runFor(500);
  assert.equal(await form.getAttribute("data-submissions"), "3");

  await search.dispatchEvent("compositionstart");
  await search.fill("ideas");
  await page.clock.runFor(500);
  assert.equal(await form.getAttribute("data-submissions"), "3");
  await search.dispatchEvent("compositionend");
  await page.clock.runFor(300);
  await page.waitForURL((url) => url.searchParams.get("search") === "ideas");
  assert.equal(await form.getAttribute("data-submissions"), "4");

  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 390],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await search.focus();
    await page.screenshot({ path: `/tmp/forge-blog-auto-search-${theme}.png`, fullPage: true });
  }
  await search.fill("pending");
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  await page.clock.runFor(500);
  assert.equal(new URL(page.url()).pathname, "/fr/blogs");
  assert.notEqual(new URL(page.url()).searchParams.get("search"), "pending");
});
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
  await page.getByRole("searchbox", { name: "Search posts", exact: true }).fill("quieter");
  await page.waitForURL(`${baseURL}/en/blogs?search=quieter`);
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
  assert.equal(await page.getByRole("navigation", { name: "Languages", exact: true }).count(), 0);
  const html = await (await fetch(`${baseURL}/en/blogs/make-room-for-better-ideas`)).text();
  assert.match(html, /Begin with a question/);
  assert.doesNotMatch(html, /An idea for tomorrow/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-blogs-mobile-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.waitForURL(`${baseURL}/fr/blogs`);
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
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.match(
    await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
    /Careful writing/,
  );
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await saved(page);
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("link", { name: "A browser-created post", exact: true }).click();
  await page.getByText("Alex Morgan", { exact: true }).last().waitFor();
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor();
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search posts", exact: true }).fill("browser-created");
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
    file = {
      name: "upload.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
        "base64",
      ),
    };
  await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
  await upload.setInputFiles(file);
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  await upload.setInputFiles(file);
  await actionToast(page, "Image uploaded.");
  assert.match(await page.getByLabel("Thumbnail", { exact: true }).inputValue(), /^[\da-f-]+$/);
  const text = page.getByRole("textbox", { name: "Markdown", exact: true });
  await text.fill("A new paragraph");
  await text.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Bold", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await text.inputValue(), "**A new paragraph**");
  await page.getByLabel("Insert image", { exact: true }).setInputFiles(file);
  await actionToast(page, "Image uploaded.");
  assert.match(await text.inputValue(), /\.\/assets\/[\da-f-]+/);
  await saved(page);
  const trigger = page.getByRole("button", { name: "Delete post", exact: true });
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
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
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
  await page
    .getByRole("combobox", { name: "Parent category", exact: true })
    .selectOption({ label: "Ideas & practice" });
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await actionToast(page, "Category saved.");
  const navigation = page.getByRole("navigation", { name: "Categories", exact: true });
  await navigation.getByRole("button", { name: "New category", exact: true }).waitFor();
  const parentGroup = navigation.locator(":scope > ul > li").filter({
    has: page.getByRole("button", { name: "Ideas & practice", exact: true }),
  });
  assert.deepEqual(await parentGroup.getByRole("button").allTextContents(), [
    "Ideas & practice",
    "Design",
    "New category",
  ]);
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByLabel("Directory state", { exact: true }).selectOption("loading");
  await page.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await page.getByLabel("Directory state", { exact: true }).selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Unable to load blog posts." }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("link", { name: "An idea for tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "This field is required to publish." }).waitFor();
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Une idée");
  await page.getByLabel("Slug", { exact: true }).fill("une-idee");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("Un nouveau texte.");
  await saved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await page.getByRole("link", { name: "French blog", exact: true }).click();
  await page.getByRole("link", { name: "Une idée", exact: true }).waitFor();
});

test("language tabs support keyboard selection and protect unsaved translations", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`);
  const english = page.getByRole("tab", { name: "English", exact: true });
  const french = page.getByRole("tab", { name: "Français", exact: true });
  assert.equal(await english.getAttribute("aria-selected"), "true");
  await english.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  assert.equal(await french.getAttribute("aria-selected"), "true");
  await page.getByRole("tabpanel", { name: "Français", exact: true }).waitFor();
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  assert.equal(await title.inputValue(), "Faire de la place aux idées");
  await title.fill("Une traduction modifiée");
  assert.equal(await english.isDisabled(), true);
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await english.isDisabled(), true);
  assert.equal(await title.inputValue(), "Une traduction modifiée");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await saved(page);
  assert.equal(await english.isDisabled(), false);
  await english.click();
  assert.equal(await title.inputValue(), "Make room for better ideas");
  await french.click();
  assert.equal(await title.inputValue(), "Une traduction modifiée");
  await page.screenshot({ path: "/tmp/forge-blog-language-tabs-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-blog-language-tabs-mobile-dark.png", fullPage: true });

  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("link", { name: "New post", exact: true }).click();
  const newTitle = page.getByRole("textbox", { name: "Title *", exact: true });
  await french.click();
  await newTitle.fill("Un nouveau brouillon");
  await english.click();
  assert.equal(await newTitle.inputValue(), "Un nouveau brouillon");
  await french.click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Markdown", exact: true }).waitFor();
  await french.click();
  assert.equal(await title.inputValue(), "Un nouveau brouillon");
});

test("editor and list badges use success, pending and not-started colors", async (t) => {
  const page = await preview(t, `/en/admin/blogs/${existing}`);
  const palettes = {
    Published: [
      ["rgb(220, 252, 231)", "rgb(22, 101, 52)"],
      ["rgb(5, 46, 22)", "rgb(134, 239, 172)"],
    ],
    "Unpublished changes": [
      ["rgb(255, 237, 213)", "rgb(154, 52, 18)"],
      ["rgb(67, 20, 7)", "rgb(253, 186, 116)"],
    ],
    Draft: [
      ["rgb(243, 244, 246)", "rgb(75, 85, 99)"],
      ["rgb(31, 41, 55)", "rgb(209, 213, 219)"],
    ],
  };
  for (const [label, colors] of Object.entries(palettes)) {
    if (label === "Unpublished changes") {
      await page.getByRole("textbox", { name: "Title", exact: true }).fill("A revised title");
      await saved(page);
    } else if (label === "Draft") {
      await page.getByRole("button", { name: "Unpublish", exact: true }).click();
      await page.getByText(label, { exact: true }).waitFor();
    }
    for (const [index, theme] of ["Light", "Dark"].entries()) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
        await toggle.click();
      assert.deepEqual(
        await page.getByText(label, { exact: true }).evaluate((node) => {
          const style = getComputedStyle(node);
          return [style.backgroundColor, style.color];
        }),
        colors[index],
      );
      if (label === "Published") {
        await page
          .getByRole("tabpanel")
          .locator("header")
          .screenshot({
            path: `/tmp/forge-blog-published-${theme.toLowerCase()}.png`,
          });
      }
      await page.getByRole("link", { name: "Manage posts", exact: true }).click();
      const row = page.getByRole("row").filter({
        has: page.locator(`a[href="/en/admin/blogs/${existing}"]`),
      });
      assert.deepEqual(
        await row
          .locator(`[title="${label}"]`)
          .first()
          .evaluate((node) => {
            const style = getComputedStyle(node);
            return [style.backgroundColor, style.color];
          }),
        colors[index],
      );
      await row.getByRole("link").first().click();
    }
  }
});

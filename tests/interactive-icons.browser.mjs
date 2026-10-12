import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { openDriveFolderDialog, closeDriveNavigation } from "./drive-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, path, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}${path}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

async function folderState(link, open) {
  const icon = link.locator(".lucide-folder-open");
  await link
    .page()
    .waitForFunction(({ element, expected }) => getComputedStyle(element).opacity === expected, {
      element: await icon.elementHandle(),
      expected: open ? "1" : "0",
    });
  assert.ok(
    Math.abs(
      Number(
        await link.locator(".lucide-folder").evaluate((icon) => getComputedStyle(icon).opacity),
      ) - (open ? 0 : 1),
    ) < 0.001,
  );
}

async function translate(icon, expected) {
  await icon
    .page()
    .waitForFunction(({ element, expected }) => getComputedStyle(element).translate === expected, {
      element: await icon.elementHandle(),
      expected,
    });
}

void test("Drive folders open on hover and keyboard focus without shifting rows", async (t) => {
  for (const width of [1440, 390])
    for (const dark of [false, true]) {
      const page = await preview(t, "/en/drive", {
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      if (dark) await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      const portal = page.getByRole("link", { name: "Customer portal", exact: true });
      await folderState(portal, false);
      await portal.scrollIntoViewIfNeeded();
      const bounds = await portal.boundingBox();
      await portal.hover();
      await folderState(portal, true);
      assert.deepEqual(await portal.boundingBox(), bounds);
      await page.mouse.move(0, 0);
      await folderState(portal, false);
      await page.keyboard.press("Tab");
      await portal.focus();
      await folderState(portal, true);
      await page.screenshot({
        path: `/tmp/forge-icons-drive-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.keyboard.press("Enter");
      await openDriveFolderDialog(page);
      const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
      await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Documents");
      await dialog.getByRole("button", { name: "Create", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await closeDriveNavigation(page);
      const folder = page
        .getByRole("table")
        .getByRole("link", { name: "Documents", exact: true })
        .and(page.locator('[aria-disabled="false"]'));
      await folderState(folder, false);
      await folder.hover();
      await folderState(folder, true);
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await folder.focus();
      await folderState(folder, true);
      const toggle = page.getByRole("button", { name: "Drive navigation", exact: true });
      if (await toggle.isVisible()) await toggle.click();
      const nav = page.getByRole("navigation", { name: "Drive navigation", exact: true });
      const treeFolder = nav.getByRole("link", { name: "Folder: Documents", exact: true });
      await treeFolder.hover();
      await folderState(treeFolder, true);
      await nav.getByRole("button", { name: "Expand folder: Documents", exact: true }).click();
      await page.mouse.move(0, 0);
      await folderState(treeFolder, true);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-icons-tree-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.close();
    }
});

void test("navigation arrows respond to intent and stay still when disabled or motion is reduced", async (t) => {
  const page = await preview(t, "/table-pagination");
  const nav = page.getByRole("navigation", { name: "Blog post pages", exact: true });
  const next = nav.getByRole("button", { name: "Next page" });
  const previous = nav.getByRole("button", { name: "Previous page" });
  const bounds = await next.boundingBox();
  await previous.hover();
  await translate(previous.locator("svg"), "none");
  await next.hover();
  await translate(next.locator("svg"), "2px");
  assert.deepEqual(await next.boundingBox(), bounds);
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await next.focus();
  await translate(next.locator("svg"), "2px");
  await page.keyboard.press("Enter");
  assert.match(await nav.innerText(), /2\/3/);
  await previous.hover();
  await translate(previous.locator("svg"), "-2px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await translate(previous.locator("svg"), "none");
  await next.hover();
  await translate(next.locator("svg"), "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const back = page.getByRole("link", { name: "All components", exact: true }).first();
  await back.hover();
  await translate(back.locator("svg"), "-2px");
});

void test("whole blog cards link to articles and animate arrows on hover and keyboard focus", async (t) => {
  for (const width of [1440, 390])
    for (const dark of [false, true]) {
      const page = await preview(t, "/en/blogs", { viewport: { width, height: 1000 } });
      if (dark) await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      const card = page.getByRole("link", { name: "Make room for better ideas", exact: true });
      const article = page.locator("article").filter({ has: card });
      const arrow = card.locator(".lucide-arrow-up-right");
      assert.equal(await article.getByRole("link").count(), 1);
      await card.scrollIntoViewIfNeeded();
      const bounds = await card.boundingBox();
      await card.locator("p").hover();
      await translate(arrow, "2px -2px");
      assert.deepEqual(await card.boundingBox(), bounds);
      assert.equal(await card.evaluate((node) => getComputedStyle(node).cursor), "pointer");
      await page.mouse.move(0, 0);
      await translate(arrow, "none");
      await card.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await card.evaluate((node) => node.matches(":focus-visible")), true);
      await translate(arrow, "2px -2px");
      assert.equal(await card.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-blog-card-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await translate(arrow, "none");
      await card.locator("p").hover();
      await translate(arrow, "none");
      await page.keyboard.press("Enter");
      await page.waitForURL("**/en/blogs/make-room-for-better-ideas");
      await page.goBack();
      await page.locator('[data-preview-ready="true"]').waitFor();
      const restored = await card.boundingBox();
      await card.click({ position: { x: restored.width / 2, y: restored.height - 10 } });
      await page.waitForURL("**/en/blogs/make-room-for-better-ideas");
      await page.close();
    }
});

void test("Drive directory actions open every space, including read-only spaces", async (t) => {
  for (const width of [1440, 390])
    for (const dark of [false, true]) {
      const page = await preview(t, "/en/drive", { viewport: { width, height: 1000 } });
      if (dark) await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      for (const name of ["Customer portal", "Studio website", "Team handbook"]) {
        const title = page.getByRole("link", { name, exact: true });
        const open = page.getByRole("link", { name: `Open folder: ${name}`, exact: true });
        await open.waitFor();
        assert.equal(await open.getAttribute("href"), await title.getAttribute("href"));
        assert.equal(await open.innerText(), "");
        assert.equal(await open.locator(".lucide-folder-open[aria-hidden=true]").count(), 1);
        const target = await open.boundingBox();
        assert.ok(target.width >= (width < 768 ? 40 : 32));
        assert.ok(target.height >= (width < 768 ? 40 : 32));
      }
      const open = page.getByRole("link", { name: "Open folder: Customer portal", exact: true });
      const record = page.getByRole("link", {
        name: "Open linked record: Customer portal",
        exact: true,
      });
      await open.scrollIntoViewIfNeeded();
      const openBox = await open.boundingBox();
      const recordBox = await record.boundingBox();
      assert.ok(recordBox.x - (openBox.x + openBox.width) >= 8);
      assert.notEqual(await open.getAttribute("href"), await record.getAttribute("href"));
      await open.hover();
      await page
        .getByRole("tooltip", { name: "Open folder: Customer portal", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await open.focus();
      await page
        .getByRole("tooltip", { name: "Open folder: Customer portal", exact: true })
        .waitFor();
      await page.screenshot({
        path: `/tmp/forge-drive-open-${width}-${dark ? "dark" : "light"}.png`,
      });
      await page.keyboard.press("Enter");
      await page.locator('[aria-busy="false"] table').waitFor();
      await page
        .getByRole("navigation", { name: "Folder navigation", exact: true })
        .getByRole("link", { name: "Drive", exact: true })
        .click();
      await page.getByRole("link", { name: "Open folder: Team handbook", exact: true }).click();
      await page.getByText("Welcome.txt", { exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Upload files", exact: true }).count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.close();
    }
});

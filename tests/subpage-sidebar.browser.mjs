import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { chromium } from "playwright";

import { openDriveFolderDialog, closeDriveNavigation } from "./drive-helpers.mjs";

await suite("Subpage sidebar browser", async () => {
  const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
  let browser;
  before(async () => {
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
  });

  async function preview(t, path, width = 1440, theme = "light") {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    t.after(() => context.close());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.goto(`${baseURL}${path}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    return page;
  }

  async function navigation(page, label = "Drive navigation") {
    const trigger = page.getByRole("button", { name: label, exact: true });
    if (
      (await trigger.isVisible()) &&
      !(await page.getByRole("dialog", { name: label, exact: true }).isVisible())
    )
      await trigger.click();
    return page.getByRole("navigation", { name: label, exact: true });
  }

  async function createFolder(page, name) {
    await openDriveFolderDialog(page);
    const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await closeDriveNavigation(page);
    await page.getByRole("table").getByRole("link", { name, exact: true }).waitFor();
  }

  await test("subpage sidebar navigates linked parents and nested pages, and manages mobile focus", async (t) => {
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        const page = await preview(t, "/subpage-sidebar", width, theme);
        let nav = await navigation(page, "Page navigation");
        await nav.getByRole("button", { name: "Expand Documents", exact: true }).click();
        await nav.getByRole("link", { name: "Design brief", exact: true }).click();
        await page.getByRole("heading", { name: "Design brief", exact: true }).waitFor();
        if (width < 768) {
          await page
            .getByRole("dialog", { name: "Page navigation", exact: true })
            .waitFor({ state: "hidden" });
          const trigger = page.getByRole("button", { name: "Page navigation", exact: true });
          assert.equal(
            await trigger.evaluate((element) => element === document.activeElement),
            true,
          );
          await trigger.click();
          await page.keyboard.press("Escape");
          await page
            .getByRole("dialog", { name: "Page navigation", exact: true })
            .waitFor({ state: "hidden" });
          assert.equal(
            await trigger.evaluate((element) => element === document.activeElement),
            true,
          );
        }
        nav = await navigation(page, "Page navigation");
        assert.equal(
          await nav
            .getByRole("link", { name: "Design brief", exact: true })
            .getAttribute("aria-current"),
          "page",
        );
        await nav.getByRole("button", { name: "Guides", exact: true }).click();
        await nav.getByRole("link", { name: "Project handover", exact: true }).click();
        await page.getByRole("heading", { name: "Project handover", exact: true }).waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `/private/tmp/subpage-sidebar-${width}-${theme}.png`,
          fullPage: true,
        });
        await page.close();
      }
  });

  await test("Drive sidebar expands folders, selects descendants and returns from Trash in both layouts", async (t) => {
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        const page = await preview(t, "/en/drive/project/website", width, theme);
        await page.getByText("This folder is empty.", { exact: true }).waitFor();
        await createFolder(page, "Assets");
        await createFolder(page, "Archive");
        await page.getByRole("table").getByRole("link", { name: "Assets", exact: true }).click();
        await page.getByRole("heading", { name: "Assets", exact: true }).waitFor();
        await createFolder(page, "Brand");
        let nav = await navigation(page);
        await nav.getByRole("link", { name: "Studio website", exact: true }).click();
        await page.getByRole("table").getByRole("link", { name: "Assets", exact: true }).waitFor();
        nav = await navigation(page);
        await nav.getByRole("button", { name: "Expand folder: Assets", exact: true }).click();
        await nav.getByRole("link", { name: "Folder: Brand", exact: true }).click();
        await page.getByRole("heading", { name: "Brand", exact: true }).waitFor();
        nav = await navigation(page);
        assert.equal(
          await nav
            .getByRole("link", { name: "Folder: Brand", exact: true })
            .getAttribute("aria-current"),
          "page",
        );
        await page.waitForFunction(
          () => !document.querySelector('nav[aria-label="Drive navigation"] [aria-busy="true"]'),
        );
        await page.screenshot({
          path: `/private/tmp/drive-sidebar-${width}-${theme}.png`,
          fullPage: width >= 768,
        });
        await nav.getByRole("button", { name: "Trash", exact: true }).click();
        await page.getByRole("table", { name: "Trash", exact: true }).waitFor();
        if (width < 768)
          await page
            .getByRole("dialog", { name: "Drive navigation", exact: true })
            .waitFor({ state: "hidden" });
        nav = await navigation(page);
        assert.equal(
          await nav
            .getByRole("button", { name: "Trash", exact: true })
            .getAttribute("aria-current"),
          "page",
        );
        await nav.getByRole("link", { name: "Studio website", exact: true }).click();
        await page.getByRole("table").getByRole("link", { name: "Archive", exact: true }).waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (width < 768)
          await page.screenshot({
            path: `/private/tmp/drive-sidebar-closed-${width}-${theme}.png`,
            fullPage: true,
          });
        await page.close();
      }
  });

  await test("Drive folder loading replaces icons without visible text or shifting navigation", async (t) => {
    for (const width of [390, 1440])
      for (const theme of ["light", "dark"]) {
        const page = await preview(t, "/en/drive/project/website", width, theme);
        await createFolder(page, "Assets");
        let nav = await navigation(page);
        const root = nav.getByRole("link").first();
        const folder = nav.getByRole("link", { name: "Folder: Assets", exact: true });
        await root.locator(".lucide-folder-open").waitFor();
        const position = await root.boundingBox();
        const now = new Date();
        await page.clock.install({ time: now });
        await page.clock.pauseAt(new Date(now.getTime() + 1000));
        await nav.getByRole("button", { name: "Expand folder: Assets", exact: true }).click();
        const spinner = folder.locator(".lucide-loader-circle");
        await spinner.waitFor();
        assert.equal(await folder.locator(".lucide-folder-open").count(), 0);
        assert.equal(
          await spinner.evaluate((icon) => getComputedStyle(icon).animationName),
          "none",
        );
        assert.equal(
          await nav.getByRole("status").evaluate((node) => !!node.closest(".sr-only")),
          true,
        );
        const folderPosition = await folder.boundingBox();
        const trashPosition = await nav
          .getByRole("button", { name: "Trash", exact: true })
          .boundingBox();
        await page.screenshot({ path: `/tmp/drive-folder-spinner-${width}-${theme}.png` });
        await page.clock.runFor(200);
        await folder.locator(".lucide-folder-open").waitFor();
        assert.deepEqual(await folder.boundingBox(), folderPosition);
        assert.deepEqual(
          await nav.getByRole("button", { name: "Trash", exact: true }).boundingBox(),
          trashPosition,
        );
        const treeHeights = await nav.locator('[aria-busy="false"]').evaluateAll((trees) =>
          trees.map((tree) => ({
            actual: tree.getBoundingClientRect().height,
            folders: tree.querySelector(":scope > ul").getBoundingClientRect().height,
          })),
        );
        for (const { actual, folders } of treeHeights)
          assert.equal(actual, folders, "Folder trees must not reserve empty feedback rows");
        await page.clock.resume();
        await closeDriveNavigation(page);
        await page.getByLabel("Directory state").selectOption("loading");
        nav = await navigation(page);
        await root.locator(".lucide-loader-circle").waitFor();
        assert.deepEqual(await root.boundingBox(), position);
        assert.equal(
          await nav
            .getByRole("status")
            .evaluateAll((nodes) => nodes.every((node) => !!node.closest(".sr-only"))),
          true,
        );
        await page.emulateMedia({ reducedMotion: "no-preference" });
        assert.equal(
          await root
            .locator(".lucide-loader-circle")
            .evaluate((icon) => getComputedStyle(icon).animationName),
          "spin",
        );
        await page.screenshot({ path: `/tmp/drive-root-spinner-${width}-${theme}.png` });
        await closeDriveNavigation(page);
        await page.getByLabel("Directory state").selectOption("error");
        nav = await navigation(page);
        await root.locator(".lucide-folder-open").waitFor();
        await nav.getByRole("alert").first().waitFor();
        assert.equal(await root.locator(".lucide-loader-circle").count(), 0);
        await closeDriveNavigation(page);
        await page.getByLabel("Directory state").selectOption("ready");
        nav = await navigation(page);
        await root.locator(".lucide-folder-open").waitFor();
        await page.waitForFunction(
          () => !document.querySelector('nav[aria-label="Drive navigation"] [aria-busy="true"]'),
        );
        assert.equal(await nav.getByRole("status").count(), 0);
        await page.close();
      }
  });

  await test("Drive tree paginates folders and recovers from listing errors", async (t) => {
    const page = await preview(t, "/en/drive/project/website");
    for (let index = 0; index < 11; index++) {
      await openDriveFolderDialog(page);
      const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
      await dialog
        .getByRole("textbox", { name: "Name", exact: true })
        .fill(`Folder ${String(index).padStart(2, "0")}`);
      await dialog.getByRole("button", { name: "Create", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await closeDriveNavigation(page);
    }
    const nav = await navigation(page);
    await nav.getByRole("button", { name: "Load more folders", exact: true }).click();
    await nav.getByRole("link", { name: "Folder: Folder 10", exact: true }).waitFor();
    const positions = async () => ({
      folder: await nav
        .getByRole("link", { name: "Folder: Folder 00", exact: true })
        .evaluate((node) => ({
          top:
            node.getBoundingClientRect().top -
            node.closest("[aria-busy]").getBoundingClientRect().top,
          height: node.getBoundingClientRect().height,
        })),
      trash: await nav.getByRole("button", { name: "Trash", exact: true }).boundingBox(),
    });
    const settled = await positions();
    await page.getByLabel("Directory state").selectOption("loading");
    await nav.getByRole("status").waitFor();
    assert.deepEqual(await positions(), settled);
    await page.getByLabel("Directory state").selectOption("error");
    await nav.getByRole("alert").waitFor();
    assert.deepEqual((await positions()).folder, settled.folder);
    await nav.getByRole("button", { name: /Retry$/ }).click();
    await nav.getByRole("alert").waitFor();
    assert.deepEqual((await positions()).folder, settled.folder);
    await page.getByLabel("Directory state").selectOption("ready");
    await nav.getByRole("link", { name: "Folder: Folder 00", exact: true }).waitFor();
    await nav.getByRole("alert").waitFor({ state: "hidden" });
  });

  await test("homepage discovers the sidebar under All and Component", async (t) => {
    const page = await preview(t, "/");
    const card = page
      .getByRole("link")
      .filter({ has: page.getByRole("heading", { name: "Subpage sidebar", exact: true }) });
    await card.waitFor();
    await page.getByRole("button", { name: /^Component/ }).click();
    await card.click();
    await page.getByRole("heading", { name: "Subpage sidebar", exact: true }).waitFor();
  });

  await test("intranet navigation keeps its nested links, profile, and global toggle", async (t) => {
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/intranet-sidebar", width);
      const toggle = page.getByRole("button", {
        name: "Toggle side navigation",
        exact: true,
        includeHidden: true,
      });
      if (width < 768) await toggle.click();
      const nav = page.getByRole("navigation", { name: "Side navigation", exact: true });
      await nav.getByRole("button", { name: "Contracts", exact: true }).click();
      await nav.getByRole("link", { name: "Customer", exact: true }).click();
      await page.waitForURL((url) => url.hash === "#contracts/customer");
      if (width < 768) await toggle.click();
      await nav
        .getByRole("link", { name: "Customer", exact: true })
        .and(nav.locator('[aria-current="page"]'))
        .waitFor();
      await page.getByRole("button", { name: "User menu", exact: true }).click();
      await page.getByRole("menuitem", { name: "Profile settings", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      if (width < 768) await page.keyboard.press("Escape");
      await toggle.focus();
      const previous = await toggle.getAttribute("aria-expanded");
      await page.keyboard.press("Control+b");
      assert.notEqual(await toggle.getAttribute("aria-expanded"), previous);
      await page.close();
    }
  });
});

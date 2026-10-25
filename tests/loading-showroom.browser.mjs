import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import { chromium } from "playwright";

import { openPreviewControls } from "./showroom-helpers.mjs";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
void test("refresh shows one stable navbar indicator in both locales, themes and viewport sizes", async (t) => {
  for (const width of [1440, 390])
    for (const locale of ["en", "fr"])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        t.after(() => context.close());
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${base}/${locale}/admin/reservations`);
        await page.locator('[data-preview-ready="true"]').waitFor();
        const bar = page.locator('[data-slot="loading-indicator"]');
        await bar.waitFor({ state: "hidden" });
        await openPreviewControls(page);
        await page.getByLabel("Slow responses", { exact: true }).check();
        const themeButton = page.getByRole("button", {
          name: theme === "dark" ? "Dark mode" : "Light mode",
          exact: true,
        });
        if (await themeButton.count()) await themeButton.click();
        if (width < 640) await page.getByRole("button", { name: "Settings", exact: true }).click();
        const heading = page.getByRole("heading", { level: 1 });
        const headingBox = await heading.boundingBox();
        const refresh = page.getByRole("button", {
          name: locale === "fr" ? "Actualiser" : "Refresh",
          exact: true,
        });
        await refresh.click();
        await bar.waitFor();
        assert.equal(
          await page
            .getByRole("progressbar", { name: locale === "fr" ? "Chargement…" : "Loading…" })
            .count(),
          1,
        );
        const box = await bar.boundingBox();
        assert.equal(box.y, 56);
        assert.equal(box.width, width);
        assert.equal(box.height, 4);
        assert.deepEqual(await heading.boundingBox(), headingBox);
        assert.equal(await refresh.evaluate((el) => document.activeElement === el), true);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `/private/tmp/loading-navbar-${width}-${locale}-${theme}.png`,
        });
        await bar.waitFor({ state: "hidden" });
        assert.deepEqual(errors, []);
        await context.close();
      }
});
void test("data states across plugins share the indicator and navigation releases unfinished reads", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const bar = page.locator('[data-slot="loading-indicator"]');
  for (const route of [
    "/en/employees",
    "/en/customers",
    "/en/projects",
    "/en/admin/blogs",
    "/en/admin/menus",
  ]) {
    await page.goto(base + route);
    await page.locator('[data-preview-ready="true"]').waitFor();
    await bar.waitFor({ state: "hidden" });
    await page.getByLabel("Directory state").selectOption("loading");
    await bar.waitFor();
    await page.getByLabel("Directory state").selectOption("ready");
    await bar.waitFor({ state: "hidden" });
    await page.getByLabel("Directory state").selectOption("loading");
    await bar.waitFor();
    await page.getByRole("link", { name: "All components", exact: true }).click();
    await page.waitForURL(base + "/");
    await bar.waitFor({ state: "hidden" });
  }
  assert.deepEqual(errors, []);
});
void test("failed refresh ends shared activity while retaining inline recovery", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(base + "/en/reservations/manage/missing");
  await page.locator('[data-preview-ready="true"]').waitFor();
  const bar = page.locator('[data-slot="loading-indicator"]');
  await bar.waitFor({ state: "hidden" });
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await bar.waitFor();
  await bar.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("alert").isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Refresh", exact: true }).isEnabled(), true);
});

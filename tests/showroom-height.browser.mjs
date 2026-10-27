import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

void test("full-page previews fit below the showroom header and scroll when content needs room", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseURL);

  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => localStorage.setItem("forge-showroom-theme", theme), theme);
    for (const path of ["login", "forgot-password", "reset-password"]) {
      await page.goto(`${baseURL}/en/${path}`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const preview = page.locator("#factory-showroom-preview");
      const header = await preview.locator("header").boundingBox();
      const footer = await preview.locator("footer").boundingBox();
      assert.ok(header.y >= 56, `${theme}/${path}: page header stays below showroom navigation`);
      assert.ok(footer.y + footer.height <= 1000, `${theme}/${path}: footer fits at first load`);
      assert.equal(await page.shell.evaluate(() => document.documentElement.scrollHeight), 1000);
    }
  }

  for (const viewport of [
    { width: 1440, height: 500 },
    { width: 375, height: 800 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/en/login`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const preview = page.locator("#factory-showroom-preview");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).scrollIntoViewIfNeeded();
    await preview.locator("footer").scrollIntoViewIfNeeded();
    const footer = await preview.locator("footer").boundingBox();
    assert.ok(footer.y >= 56 && footer.y + footer.height <= viewport.height + 1);
    const header = await preview.locator("header").boundingBox();
    const main = await preview.locator("main").boundingBox();
    assert.ok(main.y >= header.y + header.height, "form does not overlap the page header");
    assert.ok(footer.y >= main.y + main.height, "footer does not overlap the form");
  }
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

await test("lightbox traps focus, preserves image clicks and restores focus after dismissal", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/lightbox`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const trigger = page.getByRole("button", { name: "Click to enlarge : Forge logo" });
  const dialog = page.getByRole("dialog", { name: "Forge logo", exact: true });
  for (const [width, dark] of [
    [1440, false],
    [320, true],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    const theme = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
    await trigger.focus();
    await trigger.press("Enter");
    await dialog.waitFor();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await close.focus();
    for (const key of ["Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      await close.and(page.locator(":focus")).waitFor();
    }
    await dialog.getByRole("img", { name: "Forge logo" }).click();
    assert.equal(await dialog.isVisible(), true);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `/tmp/forge-lightbox-${width}.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
    await trigger.click();
    await close.click();
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
    await trigger.click();
    await dialog.waitFor();
    await page.mouse.click(2, 2);
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
  }
  const placeholder = page.getByRole("figure", { name: "Missing photo" });
  assert.match(await placeholder.textContent(), /Photo coming soon/);
  assert.deepEqual(errors, []);
});

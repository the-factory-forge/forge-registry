import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";
import { openPreviewControls } from "./showroom-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

await test("reservation dialogs expose a translated top-right close control on desktop and mobile", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/fr/admin/reservations`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await openPreviewControls(page);
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("apartment");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const dark of [false, true]) {
      const theme = page.shell.getByRole("button", { name: "Dark mode", exact: true });
      if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
      const trigger = page.getByRole("button", { name: /Jamie Taylor · Apartment stay/ }).first();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Jamie Taylor", exact: true });
      const close = dialog
        .getByRole("button", { name: "Fermer", exact: true })
        .filter({ has: page.locator("svg") });
      const heading = dialog.getByRole("heading", { name: "Jamie Taylor", exact: true });
      await close.waitFor();
      const [popup, button, title] = await Promise.all([
        dialog.boundingBox(),
        close.boundingBox(),
        heading.boundingBox(),
      ]);
      assert.ok(button.x >= title.x + title.width, "close must not overlap the title");
      assert.ok(
        button.y >= popup.y && button.y + button.height < 844,
        "close is visible without scrolling",
      );
      assert.ok(button.x + button.width <= popup.x + popup.width);
      assert.ok(button.width >= (width < 768 ? 40 : 32));
      await close.hover();
      await page.getByRole("tooltip", { name: "Fermer", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await dialog.isVisible(), true, "Escape dismisses the tooltip first");
      await page.mouse.move(0, 0);
      await close.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await page.getByRole("tooltip", { name: "Fermer", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.screenshot({ path: `/tmp/dialog-close-${width}-${dark ? "dark" : "light"}.png` });
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
    }
  }
  assert.deepEqual(errors, []);
});

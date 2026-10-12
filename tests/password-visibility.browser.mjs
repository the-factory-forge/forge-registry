import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

void test("every password field has a keyboard-accessible eye suffix without changing its value", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const captureDir = process.env.TEST_CAPTURE_DIR;
  if (captureDir) await mkdir(captureDir, { recursive: true });

  for (const path of [
    "login",
    "reset-password",
    "change-password",
    "account",
    "employees",
    "customers/new",
  ]) {
    await page.goto(`${baseURL}/en/${path}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    if (path === "account") {
      await page.getByLabel("Email and password account").check();
      await page.getByRole("tab", { name: "Security", exact: true }).click();
    }
    if (path === "employees")
      await page.getByRole("button", { name: "Create employee", exact: true }).click();
    const input = page.locator('input[type="password"]');
    assert.equal(await input.count(), 1, path);
    const field = page.locator(`[id="${await input.getAttribute("id")}"]`);
    const show = page.getByRole("button", { name: "Show password", exact: true });
    const hide = page.getByRole("button", { name: "Hide password", exact: true });
    await field.fill("A-test-password-123!");
    assert.equal(await show.getAttribute("type"), "button");
    assert.equal(await show.getAttribute("aria-controls"), await field.getAttribute("id"));
    assert.equal(await show.getAttribute("aria-pressed"), "false");
    assert.equal(await field.getAttribute("spellcheck"), "false");
    await show.hover();
    const tooltip = page.getByRole("tooltip", { name: "Show password", exact: true });
    await tooltip.waitFor();
    await show.focus();
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
    await page.mouse.move(0, 0);
    await field.focus();
    // Customer generation and copy controls precede the suffix in the tab order.
    for (let tabs = 0; tabs < 3; tabs++) {
      await page.keyboard.press("Tab");
      if (await show.evaluate((node) => node === document.activeElement)) break;
    }
    assert.equal(await show.evaluate((node) => node === document.activeElement), true);
    await tooltip.waitFor();
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
    const initial = await field.boundingBox();
    await show.press("Enter");
    assert.equal(await field.getAttribute("type"), "text");
    assert.equal(await hide.getAttribute("aria-pressed"), "true");
    assert.equal(await field.inputValue(), "A-test-password-123!");
    assert.deepEqual(await field.boundingBox(), initial);
    await hide.press("Space");
    assert.equal(await field.getAttribute("type"), "password");
    assert.equal(await field.inputValue(), "A-test-password-123!");

    for (const theme of ["light", "dark"]) {
      // A modal keeps the showroom header inert, so apply the existing theme class directly.
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.classList.toggle("light", theme === "light");
      }, theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 950 });
        await field.scrollIntoViewIfNeeded();
        const fieldBox = await field.boundingBox();
        const toggleBox = await show.boundingBox();
        assert.ok(toggleBox.x >= fieldBox.x + fieldBox.width - toggleBox.width - 1, path);
        assert.ok(toggleBox.x + toggleBox.width <= fieldBox.x + fieldBox.width + 1, path);
        assert.ok(toggleBox.height >= 40 && toggleBox.width >= 40, path);
        assert.ok(
          await field.evaluate((node) => parseFloat(getComputedStyle(node).paddingRight) >= 40),
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          path,
        );
        if (
          captureDir &&
          ["reset-password", "change-password", "employees", "customers/new"].includes(path)
        )
          await field
            .locator("../..")
            .screenshot({ path: `${captureDir}/${path.replace("/", "-")}-${theme}-${width}.png` });
      }
    }
  }
  assert.deepEqual(errors, []);
});

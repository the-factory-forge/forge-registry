import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

void test("select arrows keep their inset across previews, themes and narrow screens", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(baseURL);
  assert.equal(await page.locator('main a[href="/native-select"]').count(), 1);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.locator('main a[href="/native-select"]').click();
  await page.locator('[data-preview-ready="true"]').waitFor();
  const state = page.getByRole("combobox", { name: "Directory state", exact: true });
  await state.focus();
  assert.equal(await state.evaluate((element) => element === document.activeElement), true);
  await state.selectOption("loading");
  assert.equal(await state.inputValue(), "loading");
  await state.selectOption("unavailable");
  assert.equal(
    await page.getByRole("combobox", { name: "Unavailable directory" }).isDisabled(),
    true,
  );

  for (const dark of [false, true]) {
    const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/native-select",
        "/en/projects/new",
        "/en/employees",
        "/en/admin/blogs/categories",
        "/en/admin/menus/print",
        "/en/reservations",
        "/en/admin/reservations",
      ]) {
        await page.goto(`${baseURL}${path}`);
        await page.locator('[data-preview-ready="true"]').waitFor();
        await page.locator("select").first().waitFor();
        const selects = await page.locator("select:visible").evaluateAll((controls) =>
          controls.map((select) => {
            const icon = select.nextElementSibling;
            const field = select.getBoundingClientRect();
            const arrow = icon.getBoundingClientRect();
            return {
              inset: field.right - arrow.right,
              padding: parseFloat(getComputedStyle(select).paddingInlineEnd),
              centered: Math.abs(field.top + field.height / 2 - arrow.top - arrow.height / 2),
              decorative: icon.getAttribute("aria-hidden"),
              interactive: getComputedStyle(icon).pointerEvents,
            };
          }),
        );
        assert.ok(selects.length, path);
        for (const select of selects) {
          assert.equal(select.inset, 12, path);
          assert.equal(select.padding, 40, path);
          assert.ok(select.centered < 1, path);
          assert.equal(select.decorative, "true", path);
          assert.equal(select.interactive, "none", path);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          path,
        );
      }
    }
  }
  await page.goto(`${baseURL}/native-select`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.locator("html").evaluate((element) => {
    element.dir = "rtl";
  });
  assert.equal(
    await state.evaluate((element) => {
      const field = element.getBoundingClientRect();
      const arrow = element.nextElementSibling.getBoundingClientRect();
      return arrow.left - field.left;
    }),
    12,
  );
  await page.emulateMedia({ forcedColors: "active" });
  assert.equal(await state.evaluate((element) => getComputedStyle(element).appearance), "auto");
  assert.equal(
    await state.evaluate((element) => getComputedStyle(element.nextElementSibling).display),
    "none",
  );
});

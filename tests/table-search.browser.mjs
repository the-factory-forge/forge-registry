import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("homepage search starts expanded and stays visible through filtering, clearing and blur", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const search = page.getByRole("searchbox", { name: "Search examples" });
  assert.equal(await search.isVisible(), true);
  assert.equal(await search.evaluate((el) => el === document.activeElement), false);
  const allCount = await page.locator("main a h2").count();
  await page.getByRole("button", { name: "Plugin", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await search.evaluate((el) => el === document.activeElement), true);
  await search.fill("hairdresser");
  assert.equal(await page.locator('main a[href="/en/reservations"]').count(), 1);
  assert.equal(await page.locator("main a h2").count(), 1);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.getByText("No examples found.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear search examples", exact: true }).click();
  assert.equal(await search.inputValue(), "");
  assert.equal(await search.evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.locator('main a[href="/table-search"]').count(), 1);
  assert.equal(await page.locator('main a[href="/en/reservations"]').count(), 0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  assert.equal(await search.isVisible(), true);
  assert.equal(await page.locator("main a h2").count(), allCount);
  await search.fill("no matching example");
  await search.press("Escape");
  assert.equal(await search.inputValue(), "");
  assert.equal(await page.locator("main a h2").count(), allCount);
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await search.isVisible(), true);
      assert.equal(await search.getAttribute("aria-hidden"), "false");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
  }
  assert.deepEqual(errors, []);
});

test("table searches are independent, keyboard accessible and contained on narrow screens", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.locator('main a[href="/table-search"]').click();
  await page.locator('[data-preview-ready="true"]').waitFor();
  const employees = page.getByRole("region", { name: "Employees", exact: true });
  const projects = page.getByRole("region", { name: "Projects", exact: true });
  const employeeSearch = employees.getByRole("searchbox");
  await employees.getByRole("button", { name: "Search employees", exact: true }).focus();
  assert.equal(await employeeSearch.evaluate((el) => el === document.activeElement), true);
  await employeeSearch.fill("zoe developer");
  assert.equal(await employees.getByRole("row").count(), 2);
  assert.equal(await projects.getByRole("row").count(), 4);
  await projects.getByRole("button", { name: "Search projects", exact: true }).click();
  await projects.getByRole("searchbox").fill("cafe");
  assert.equal(await projects.getByRole("row").count(), 2);
  assert.equal(await employeeSearch.inputValue(), "zoe developer");
  await employees.getByRole("button", { name: "Clear search employees" }).click();
  assert.equal(await employees.getByRole("row").count(), 4);
  assert.equal(await employeeSearch.evaluate((el) => el === document.activeElement), true);
  assert.equal(await projects.getByRole("searchbox").inputValue(), "cafe");
  await employeeSearch.fill("missing");
  await employees.getByRole("status").waitFor();
  await employeeSearch.press("Escape");
  assert.equal(await employees.getByRole("row").count(), 4);
  await employees.getByRole("button", { name: "Show all" }).focus();
  assert.equal(await employeeSearch.count(), 0);
  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await employees.getByRole("button", { name: "Search employees", exact: true }).click();
      await employeeSearch.fill("admin");
      assert.equal(
        await employeeSearch.evaluate((el) => getComputedStyle(el.parentElement).overflow),
        "hidden",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.equal(
        await employeeSearch.evaluate((el) => {
          const search = el.parentElement.getBoundingClientRect();
          const action = el.parentElement.nextElementSibling.getBoundingClientRect();
          return search.right <= action.left || search.bottom <= action.top;
        }),
        true,
      );
      await employees.getByRole("button", { name: "Show all" }).click();
    }
  }
});

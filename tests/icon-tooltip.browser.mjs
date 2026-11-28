import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function hint(page, control, label) {
  await control.hover();
  const tooltip = page.getByRole("tooltip", { name: label, exact: true });
  await tooltip.waitFor();
  await control.press("Escape");
  await tooltip.waitFor({ state: "hidden" });
  await page.mouse.move(0, 0);
  await control.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await tooltip.waitFor();
  assert.equal(await control.evaluate((el) => el === document.activeElement), true);
  await control.press("Escape");
  await tooltip.waitFor({ state: "hidden" });
}

void test("icon tooltips preserve actions, links, disabled states, dialog focus and layout", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/icon-tooltip`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const edit = page.getByRole("button", { name: "Edit example", exact: true });
  const before = await edit.boundingBox();
  await hint(page, edit, "Edit example");
  assert.deepEqual(await edit.boundingBox(), before);
  await edit.click();
  await page.getByText("Edit actions: 1", { exact: true }).waitFor();
  const link = page.getByRole("link", { name: "Open pagination example", exact: true });
  await hint(page, link, "Open pagination example");
  assert.equal(await link.getAttribute("href"), "/table-pagination");
  assert.equal(
    await page.getByRole("button", { name: "Delete unavailable example" }).isDisabled(),
    true,
  );
  const remove = page.getByRole("button", { name: "Delete example", exact: true });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Delete example", exact: true });
  await dialog.waitFor();
  const close = dialog.getByRole("button", { name: "Close confirmation", exact: true });
  await hint(page, close, "Close confirmation");
  await close.click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await remove.evaluate((el) => el === document.activeElement), true);

  for (const dark of [false, true]) {
    const toggle = page.shell.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await edit.hover();
      const tooltip = page.getByRole("tooltip", { name: "Edit example", exact: true });
      await tooltip.waitFor();
      const box = await tooltip.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await edit.press("Escape");
      await page.mouse.move(0, 0);
    }
  }
  await link.click();
  await page.waitForURL("**/table-pagination");
  assert.deepEqual(errors, []);
});

void test("plugin icon tooltips use translated names and calendar navigation still changes dates", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/fr/employees",
    "/en/customers",
    "/en/projects",
    "/en/admin/blogs",
    "/en/admin/menus",
    "/en/drive",
  ]) {
    await page.goto(`${baseURL}${path}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const control = page
      .locator("main [data-base-ui-tooltip-trigger][aria-label]:not([disabled])")
      .filter({ visible: true })
      .first();
    const label = await control.getAttribute("aria-label");
    await control.hover();
    await page.getByRole("tooltip", { name: label, exact: true }).waitFor();
    await control.press("Escape");
  }
  await page.goto(`${baseURL}/en/admin/reservations?view=reservationsMonth`);
  const next = page
    .locator(".reservations-calendar")
    .getByRole("button", { name: "Next", exact: true });
  await next.waitFor();
  const firstDate = page.locator(".reservations-calendar [data-date]").first();
  const initialDate = await firstDate.getAttribute("data-date");
  await hint(page, next, "Next");
  await next.click();
  await page.waitForFunction(
    (initial) =>
      document.querySelector(".reservations-calendar [data-date]")?.getAttribute("data-date") !==
      initial,
    initialDate,
  );
  await page
    .locator(".reservations-calendar")
    .getByRole("button", { name: "Previous", exact: true })
    .click();
  await page.waitForFunction(
    (initial) =>
      document.querySelector(".reservations-calendar [data-date]")?.getAttribute("data-date") ===
      initial,
    initialDate,
  );
  assert.deepEqual(errors, []);
});

void test("responsive controls dismiss their icon hint when the label becomes visible", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  for (const [path, name, label, breakpoint] of [
    ["/table-pagination", "Search registry", "Search registry (⌘K / Ctrl+K)", 1024],
    ["/en/agents?operation=blogs", "Attach file", "Attach file", 640],
    ["/en/admin/menus", "Settings", "Settings", 640],
  ]) {
    await page.setViewportSize({ width: breakpoint - 1, height: 900 });
    await page.goto(baseURL + path);
    const scope =
      path === "/en/admin/menus" ? page.locator("[data-menu-workspace-section]").first() : page;
    const button = scope.getByRole("button", { name, exact: true });
    const tooltip = page.getByRole("tooltip", { name: label, exact: true });
    await button.hover();
    await tooltip.waitFor();
    await page.setViewportSize({ width: breakpoint, height: 900 });
    await tooltip.waitFor({ state: "hidden" });
    assert.equal(await button.getAttribute("data-base-ui-tooltip-trigger"), null);
    await page.setViewportSize({ width: breakpoint - 1, height: 900 });
    await page.mouse.move(0, 0);
    await button.focus();
    await button.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await tooltip.waitFor();
    await button.press("Escape");
  }
});

void test("Offers shows the Actions hint only when collapsed and keeps numbered reorder handles tooltip-free", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(baseURL + "/en/offers/studio");
  const actions = page.getByRole("button", { name: "Actions", exact: true });
  assert.equal(await actions.getAttribute("aria-expanded"), "true");
  assert.equal(await actions.getAttribute("data-base-ui-tooltip-trigger"), null);
  const handle = page.getByRole("button", { name: "Reorder line 1", exact: true });
  assert.equal(await handle.getAttribute("data-base-ui-tooltip-trigger"), null);
  await actions.click();
  await page.mouse.move(0, 0);
  await hint(page, actions, "Actions");
  await actions.press("Enter");
  assert.equal(await actions.getAttribute("data-base-ui-tooltip-trigger"), null);
});

void test("touch activation works without an extra tooltip tap", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${baseURL}/icon-tooltip`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Edit example", exact: true }).tap();
  await page.getByText("Edit actions: 1", { exact: true }).waitFor();
});

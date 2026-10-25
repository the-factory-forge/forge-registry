import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

await test("device previews use real viewports, retain navigation, and disappear on phones", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/en/projects?search=Studio#details`);
  await page
    .frameLocator("#factory-device-preview")
    .locator('[data-preview-ready="true"]')
    .waitFor();
  const control = page.getByRole("button", { name: /preview — switch to/ });
  assert.equal(await control.count(), 1);
  assert.equal(await control.getAttribute("aria-label"), "Big preview — switch to small");
  assert.equal(await control.locator("svg.lucide-laptop").count(), 1);
  assert.equal(
    await control.evaluate((button) => getComputedStyle(button).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await control.evaluate((button) => button.previousElementSibling?.getAttribute("aria-label")),
    "Dark mode",
  );
  await control.focus();
  await page.getByRole("tooltip", { name: "Big preview — switch to small" }).waitFor();
  await page.keyboard.press("Escape");
  await control.press("Enter");
  const iframe = page.locator("#factory-device-preview");
  const preview = page.frameLocator("#factory-device-preview");
  await preview.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(await control.getAttribute("aria-label"), "Small preview — switch to medium");
  assert.equal(await control.locator("svg.lucide-smartphone").count(), 1);
  assert.notEqual(
    await control.evaluate((button) => getComputedStyle(button).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(await control.evaluate((button) => button === document.activeElement), true);
  assert.equal(new URL(page.url()).searchParams.get("search"), "Studio");
  assert.equal(new URL(page.url()).hash, "#details");
  assert.equal(await preview.getByRole("navigation", { name: "Showroom navigation" }).count(), 0);
  const inner = await iframe.elementHandle().then((handle) => handle.contentFrame());
  assert.equal(await inner.evaluate(() => innerWidth), 390);
  assert.equal(await inner.evaluate(() => matchMedia("(min-width: 640px)").matches), false);
  await inner.evaluate(() => {
    window.previewStateCheck = "retained";
  });
  await control.press("Space");
  await page.waitForURL(/previewDevice=tablet/);
  assert.equal(await control.getAttribute("aria-label"), "Medium preview — switch to big");
  assert.equal(await control.locator("svg.lucide-tablet").count(), 1);
  assert.notEqual(
    await control.evaluate((button) => getComputedStyle(button).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(await control.evaluate((button) => button === document.activeElement), true);
  assert.equal(await inner.evaluate(() => innerWidth), 768);
  assert.equal(await inner.evaluate(() => window.previewStateCheck), "retained");
  await page.goBack();
  await page.waitForURL(/previewDevice=phone/);
  assert.equal(await inner.evaluate(() => innerWidth), 390);
  await page.goForward();
  await page.waitForURL(/previewDevice=tablet/);
  await page.reload();
  await preview.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(await control.getAttribute("aria-label"), "Medium preview — switch to big");
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await preview.locator("html.dark").waitFor();
  await preview.getByRole("link", { name: "Create project", exact: true }).click();
  await page.waitForURL(/\/en\/projects\/new/);
  assert.equal(new URL(page.url()).searchParams.get("previewDevice"), "tablet");
  await control.click();
  await page.waitForURL((url) => !url.searchParams.has("previewDevice"));
  assert.equal(await control.getAttribute("aria-label"), "Big preview — switch to small");
  await page.mouse.move(0, 0);
  assert.equal(
    await control.evaluate((button) => getComputedStyle(button).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  await page
    .frameLocator("#factory-device-preview")
    .locator('[data-preview-ready="true"]')
    .waitFor();
  assert.equal(await iframe.count(), 1);
  assert.equal(new URL(page.url()).pathname, "/en/projects/new");
  await control.click();
  await page.waitForURL(/previewDevice=phone/);
  assert.equal(await control.getAttribute("aria-label"), "Small preview — switch to medium");
  await preview.locator('[data-preview-ready="true"]').waitFor();
  await page.setViewportSize({ width: 375, height: 800 });
  await page
    .frameLocator("#factory-device-preview")
    .locator('[data-preview-ready="true"]')
    .waitFor();
  assert.equal(await control.isVisible(), false);
  assert.equal(await iframe.count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 640, height: 800 });
  await preview.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(await control.isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(`${baseURL}/en/projects?previewDevice=invalid`);
  await page
    .frameLocator("#factory-device-preview")
    .locator('[data-preview-ready="true"]')
    .waitFor();
  assert.equal(await control.getAttribute("aria-label"), "Big preview — switch to small");
  assert.equal(await iframe.count(), 1);
  assert.deepEqual(errors, []);
});

await test("sample edits, unsaved drafts and open dialogs survive every device switch", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const preview = page.frameLocator("#factory-device-preview");
  await page.goto(`${baseURL}/en/customers/acme`);
  await preview.locator('[data-preview-ready="true"]').waitFor();
  const company = preview.getByRole("textbox", { name: "Company name", exact: true });
  await company.fill("Preserved Studio");
  await preview.getByLabel("Simulate action failures").check();
  const inner = page.frame({ name: "factory-device-preview" });
  await inner.evaluate(() => {
    window.previewLifetime = "original";
  });
  for (const size of ["small", "medium", "big", "small", "medium", "big"]) {
    await page.getByRole("button", { name: new RegExp(`switch to ${size}$`) }).click();
    assert.equal(await company.inputValue(), "Preserved Studio");
    assert.equal(await preview.getByLabel("Simulate action failures").isChecked(), true);
    assert.equal(await inner.evaluate(() => window.previewLifetime), "original");
  }
  await preview.getByLabel("Simulate action failures").uncheck();
  await preview.getByRole("button", { name: "Save changes", exact: true }).click();
  await preview.getByRole("heading", { name: "Preserved Studio", exact: true }).waitFor();
  await preview.getByRole("link", { name: "Back to customers", exact: true }).click();
  const row = preview
    .getByRole("row", { includeHidden: true })
    .filter({ hasText: "Preserved Studio" });
  await row.getByRole("button", { name: "Delete customer", exact: true }).click();
  const dialog = preview.getByRole("dialog", { name: "Delete customer", exact: true });
  await dialog.waitFor();
  for (const size of ["small", "medium", "big"]) {
    await page.getByRole("button", { name: new RegExp(`switch to ${size}$`) }).click();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await row.count(), 1);
    assert.equal(await inner.evaluate(() => window.previewLifetime), "original");
  }
  await page.setViewportSize({ width: 375, height: 800 });
  assert.equal(await page.getByRole("button", { name: /preview — switch to/ }).isVisible(), false);
  assert.equal(await dialog.isVisible(), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await row.count(), 1);
});

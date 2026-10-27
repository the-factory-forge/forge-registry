import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

await test("device control changes only the main page CSS width without frames or navigation", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/en/projects?search=Studio#details`);
  const control = page.getByRole("button", { name: /preview — switch to/ });
  const main = page.locator(".showroom-content");
  const mounted = await main.elementHandle();
  const header = page.getByRole("navigation", { name: "Showroom navigation" });
  const headerBounds = await header.boundingBox();
  const url = page.url();
  const historyLength = await page.evaluate(() => history.length);
  const documents = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
  });
  assert.equal(await control.getAttribute("aria-label"), "Big preview — switch to small");
  assert.equal(await control.locator("svg.lucide-laptop").count(), 1);
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 1440);
  await control.focus();
  await page.getByRole("tooltip", { name: "Big preview — switch to small" }).waitFor();
  await page.keyboard.press("Escape");
  for (const [key, width, icon, label] of [
    ["Enter", 390, "smartphone", "Small preview — switch to medium"],
    ["Space", 768, "tablet", "Medium preview — switch to big"],
    ["Enter", 1440, "laptop", "Big preview — switch to small"],
  ]) {
    await control.press(key);
    assert.equal(await control.getAttribute("aria-label"), label);
    assert.equal(await control.locator(`svg.lucide-${icon}`).count(), 1);
    assert.equal(await control.evaluate((button) => button === document.activeElement), true);
    assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), width);
    assert.equal(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--showroom-device-width"),
      ),
      width === 1440 ? "100%" : `${width}px`,
    );
    assert.equal(await mounted.evaluate((element) => element.isConnected), true);
    assert.deepEqual(await header.boundingBox(), headerBounds);
    assert.equal(page.url(), url);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    assert.equal(page.frames().length, 1);
    assert.equal(await page.evaluate(() => innerWidth), 1440);
  }
  assert.deepEqual(documents, []);
  await control.click();
  await control.click();
  await page.getByRole("link", { name: "Create project", exact: true }).click();
  await page.waitForURL(/\/en\/projects\/new/);
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 768);
  await page.goBack();
  await page.waitForURL(url);
  await page.goForward();
  await page.waitForURL(/\/en\/projects\/new/);
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 768);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.locator("html.dark").waitFor();
  await page.setViewportSize({ width: 375, height: 800 });
  assert.equal(await control.isVisible(), false);
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 375);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-css-preview-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 768);
  await page.screenshot({ path: "/tmp/forge-css-preview-desktop.png" });
  await page.reload();
  assert.equal(await control.getAttribute("aria-label"), "Big preview — switch to small");
  assert.equal(await main.evaluate((element) => element.getBoundingClientRect().width), 1440);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.deepEqual(errors, []);
});

await test("sample edits, unsaved drafts and open dialogs survive every device switch", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const preview = page;
  await page.goto(`${baseURL}/en/customers/acme`);
  await preview.locator('[data-preview-ready="true"]').waitFor();
  const company = preview.getByRole("textbox", { name: "Company name", exact: true });
  await company.fill("Preserved Studio");
  await preview.getByLabel("Simulate action failures").check();
  const inner = page;
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
  await page.setViewportSize({ width: 375, height: 800 });
  assert.equal(await page.getByRole("button", { name: /preview — switch to/ }).isVisible(), false);
  assert.equal(await dialog.isVisible(), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await dialog.isVisible(), true);
  await dialog
    .getByRole("button", { name: "Cancel", exact: true })
    .filter({ hasText: "Cancel" })
    .click();
  assert.equal(await row.count(), 1);
});

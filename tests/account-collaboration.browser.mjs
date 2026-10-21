import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
async function preview(t, path, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

void test("account tabs restore URL state and email confirmation preserves the current address", async (t) => {
  const page = await preview(t, "/en/account?tab=employee", {
    viewport: { width: 390, height: 900 },
  });
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Customer", exact: true }).click();
  assert.ok(page.url().includes("tab=customer"));
  await page.goBack();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  await page.getByLabel("Allow administrator email change").check();
  await page.getByLabel("Simulate action failures").check();
  await page.getByLabel("New email address").fill("new@example.test");
  await page.getByRole("button", { name: "Send confirmation" }).click();
  await page.getByRole("tab", { name: "Customer", exact: true }).click();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Sending…" }).isDisabled(), true);
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("New email address").inputValue(), "new@example.test");
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Send confirmation" }).click();
  await page.getByRole("tab", { name: "Employee", exact: true }).click();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  await page.getByText("Check your email to confirm the change.", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), "alex@example.com");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({
    path: "/private/tmp/registry-intranet-account-mobile.png",
    fullPage: true,
  });
});

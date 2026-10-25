import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { openPreviewControls } from "./showroom-helpers.mjs";

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
  const page = await preview(t, "/en/account?employees=true&tab=employee", {
    viewport: { width: 390, height: 900 },
  });
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  assert.ok(page.url().includes("tab=security"));
  await page.goBack();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  await openPreviewControls(page);
  await page.getByLabel("Allow email change").check();
  await page.getByLabel("Simulate action failures").check();
  const email = page.getByRole("textbox", { name: "New email address", exact: true });
  assert.equal(await email.getAttribute("required"), "");
  const marker = page.locator('label:has-text("New email address") [aria-hidden="true"]');
  assert.equal(await marker.textContent(), "*");
  assert.equal(await marker.isVisible(), true);
  await email.fill("new@example.test");
  const buttonOffset = () =>
    page.getByLabel("New email address").evaluate((field) => {
      const form = field.closest("form");
      return (
        form.querySelector("button").getBoundingClientRect().top - form.getBoundingClientRect().top
      );
    });
  const initialButtonOffset = await buttonOffset();
  await email.evaluate((field) => {
    field.form.requestSubmit();
    field.form.requestSubmit();
  });
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Sending…" }).isDisabled(), true);
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  assert.equal(await page.getByTestId("requested-email").textContent(), "new@example.test");
  await email.evaluate((field) => field.form.requestSubmit());
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  assert.equal(await buttonOffset(), initialButtonOffset);
  assert.equal(await page.getByLabel("New email address").inputValue(), "new@example.test");
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Send confirmation" }).click();
  await page.getByRole("tab", { name: "Employee", exact: true }).click();
  await page.getByRole("tab", { name: "About you", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email to confirm the change." })
    .waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  assert.equal(await buttonOffset(), initialButtonOffset);
  assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), "alex@example.com");
  assert.equal(await email.inputValue(), "");
  await email.fill("another@example.test");
  await page.getByRole("button", { name: "Send confirmation" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email to confirm the change." })
    .waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "3");
  assert.equal(await page.getByTestId("requested-email").textContent(), "another@example.test");
  assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), "alex@example.com");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({
    path: "/private/tmp/registry-intranet-account-mobile.png",
    fullPage: true,
  });
});

void test("account name retains drafts while plugin panels mount, hide and unmount", async (t) => {
  const page = await preview(t, "/en/account?employees=true");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Alex Taylor");
  const pluginContent = await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .elementHandle();
  assert.ok(pluginContent);
  assert.equal(await pluginContent.isVisible(), false);
  const employeeTab = page.getByRole("tab", { name: "Employee", exact: true });
  await employeeTab.click();
  assert.equal(await pluginContent.isVisible(), true);
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  assert.equal(await pluginContent.evaluate((node) => node.isConnected), true);
  await employeeTab.click();
  await employeeTab.press("ArrowLeft");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByRole("tab", { name: "About you", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await name.inputValue(), "Alex Taylor");
  assert.equal(await pluginContent.evaluate((node) => node.isConnected), true);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  assert.equal(await employeeTab.getAttribute("aria-selected"), "true");
  assert.equal(await pluginContent.isVisible(), true);
  await page.getByLabel("Simulate Employees plugin").uncheck();
  assert.equal(await pluginContent.evaluate((node) => node.isConnected), false);
  assert.equal(await name.inputValue(), "Alex Taylor");
  await page.getByLabel("Simulate Employees plugin").check();
  await employeeTab.click();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  assert.equal(await pluginContent.evaluate((node) => node.isConnected), false);
});

void test("account plugin simulation is opt-in and follows navigation history", async (t) => {
  const page = await preview(t, "/en/account");
  const tabs = page.getByRole("tab");
  assert.deepEqual(await tabs.allTextContents(), ["About you", "Security"]);
  await page.getByLabel("Simulate Employees plugin").check();
  await page.getByRole("tab", { name: "Employee", exact: true }).click();
  assert.ok(page.url().includes("employees=true"));
  await page.reload();
  assert.equal(await page.getByLabel("Simulate Employees plugin").isChecked(), true);
  assert.equal(
    await page.getByRole("tab", { name: "Employee", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  await page.getByLabel("Simulate Employees plugin").uncheck();
  await page.getByRole("tab", { name: "Employee", exact: true }).waitFor({ state: "hidden" });
  assert.equal(
    await page.getByRole("tab", { name: "About you", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  await page.goBack();
  await page
    .getByText("The host supplies employee account fields here.", { exact: true })
    .waitFor();
  await page.goForward();
  assert.deepEqual(await tabs.allTextContents(), ["About you", "Security"]);
  await page.goto(base + "/en/account?tab=employee&employees=false");
  assert.equal(
    await page.getByRole("tab", { name: "About you", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  await page.goto(base + "/en/account?tab=customer");
  assert.deepEqual(await tabs.allTextContents(), ["About you", "Security"]);
});

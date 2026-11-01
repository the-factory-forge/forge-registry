import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

for (const [shortcut, width] of [
  ["Meta+Enter", 1440],
  ["Control+Enter", 390],
]) {
  void test(`Agents sends once with ${shortcut} at ${width}px and preserves multiline input`, async (t) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(`${baseURL}/en/agents?operation=blogs`);
    const message = page.getByRole("textbox", { name: "Message", exact: true });
    await message.fill("Shortcut message");
    await message.press("Enter");
    assert.equal(await message.inputValue(), "Shortcut message\n");
    assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
    await message.press(shortcut);
    await page.getByText("Awaiting approval", { exact: true }).waitFor();
    assert.equal(await message.inputValue(), "");
    assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).count(), 1);
    assert.equal(await message.isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Send", exact: true }).isDisabled(), true);
    await message.dispatchEvent("keydown", {
      key: "Enter",
      metaKey: shortcut.startsWith("Meta"),
      ctrlKey: shortcut.startsWith("Control"),
    });
    assert.equal(await message.inputValue(), "");
    assert.equal(await page.getByText("Completed", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).count(), 1);
  });
}

void test("newsletter shortcuts retain validation and recover from failure", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/newsletter`);
  const email = page.getByRole("textbox", { name: "Email address", exact: true });
  await email.press("Meta+Enter");
  await page.getByRole("alert").filter({ hasText: "valid email" }).waitFor();
  await email.fill("shortcut@example.test");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await email.press("Control+Enter");
  await page.getByRole("alert").filter({ hasText: "Could not subscribe." }).waitFor();
  assert.equal(await email.inputValue(), "shortcut@example.test");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await email.press("Meta+Enter");
  await page.getByRole("status").filter({ hasText: "Subscription received." }).waitFor();
});

void test("nested portal shortcuts do not submit the surrounding editor", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/en/admin/blogs/categories`);
  await page
    .getByRole("navigation", { name: "Categories", exact: true })
    .getByRole("button")
    .first()
    .click();
  // A portal's React event bubbles through the editor, but it is outside its DOM form.
  await page.evaluate(() => {
    const form = document.querySelector("#factory-showroom-preview form");
    window.shortcutSubmissions = 0;
    form.addEventListener("submit", () => window.shortcutSubmissions++);
  });
  await page.getByRole("button", { name: "Delete category", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.focus();
  await page.keyboard.press("Control+Enter");
  assert.equal(await page.evaluate(() => window.shortcutSubmissions), 0);
  assert.equal(await dialog.isVisible(), true);
});

void test("standalone blog saves its draft with the keyboard", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/en/admin/blogs/b1000000-0000-4000-8000-000000000004`);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("Shortcut draft");
  await title.press("Control+Enter");
  await actionToast(page, "Draft saved.");
  assert.equal(await title.inputValue(), "Shortcut draft");
});

for (const [path, name] of [
  ["/en/customers/new", "Full name *"],
  ["/en/projects/new", "Name *"],
  ["/en/admin/menus/new", "Price (CHF)"],
]) {
  void test(`${path} keeps validation and correction focus with keyboard submission`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    t.after(() => page.close());
    await page.goto(baseURL + path);
    const field = page.getByRole("textbox", { name, exact: true });
    if (name === "Price (CHF)") await field.fill("-1");
    await field.press("Meta+Enter");
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("aria-invalid") === "true",
    );
    assert.equal(await field.evaluate((node) => node === document.activeElement), true);
    assert.equal(await field.getAttribute("aria-invalid"), "true");
  });
}

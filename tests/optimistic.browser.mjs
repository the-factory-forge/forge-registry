import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t, path) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  // Stretch only mock request timers so assertions prove the pre-response state.
  await page.addInitScript(() => {
    const timeout = window.setTimeout;
    window.setTimeout = (handler, delay, ...args) =>
      timeout(handler, [250, 400, 900].includes(delay) ? 1800 : delay, ...args);
  });
  await page.goto(`${baseURL}${path}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

void test("verification is immediate, rolls back on failure, and retries", async (t) => {
  const page = await preview(t, "/en/customers");
  const row = page.getByRole("row").filter({ hasText: "Acme Studio" });
  await page.getByLabel("Simulate action failures").check();
  await row
    .getByRole("button", { name: "Email verification for Acme Studio: Unverified", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: "Verified", exact: true }).click();
  const changed = row.getByRole("button", {
    name: "Email verification for Acme Studio: Verified",
    exact: true,
  });
  await changed.waitFor({ timeout: 700 });
  assert.equal(await changed.isDisabled(), true);
  await row
    .getByRole("button", { name: "Email verification for Acme Studio: Unverified", exact: true })
    .waitFor();
  await page.getByRole("menu").getByRole("alert").waitFor();
  await page.keyboard.press("Escape");
  await page.getByLabel("Simulate action failures").uncheck();
  await row
    .getByRole("button", { name: "Email verification for Acme Studio: Unverified", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: "Verified", exact: true }).click();
  await changed.waitFor({ timeout: 700 });
  await actionToast(page, "Customer updated");
  assert.equal(await changed.isEnabled(), true);
});

void test("project save updates its summary immediately and restores it without losing the draft", async (t) => {
  const page = await preview(t, "/en/projects/website");
  await page.getByLabel("Simulate action failures").check();
  await page.getByLabel("Name *", { exact: true }).fill("Optimistic website");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("heading", { name: "Optimistic website", exact: true })
    .waitFor({ timeout: 700 });
  await page.getByRole("heading", { name: "Studio website", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Name *", { exact: true }).inputValue(), "Optimistic website");
  await page.getByRole("alert").waitFor();
});

void test("deleting a project removes the row before the response and restores it after failure", async (t) => {
  const page = await preview(t, "/en/projects");
  await page.getByLabel("Simulate action failures").check();
  const row = page.locator("tbody tr").filter({ hasText: "Studio website" });
  await row.getByRole("button", { name: "Delete project", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await row.waitFor({ state: "hidden", timeout: 700 });
  await row.waitFor();
  await page.getByRole("alert").waitFor();
  const dialog = page.getByRole("dialog", { name: "Delete project", exact: true });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await row.getByRole("button", { name: "Delete project", exact: true }).isEnabled(),
    true,
  );
});

void test("Drive rename previews the new name and rolls back with the input retained", async (t) => {
  const page = await preview(t, "/en/drive/project/portal");
  await page.getByLabel("Simulate action failures").check();
  const row = page.getByRole("row").filter({ hasText: "Design brief.txt" });
  await row.waitFor();
  await row.getByRole("button", { name: "Rename", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
  await dialog.getByRole("textbox").fill("Changed brief.txt");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator("tbody tr").filter({ hasText: "Changed brief.txt" }).waitFor({ timeout: 700 });
  await page.locator("tbody tr").filter({ hasText: "Design brief.txt" }).waitFor();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByRole("textbox").inputValue(), "Changed brief.txt");
});

void test("menu order changes before save and rolls back on failure", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.getByLabel("Simulate action failures").check();
  const names = page.locator("tbody tr td:first-child");
  const handle = page.getByRole("button", {
    name: "Reorder item: Burrata with tomatoes",
    exact: true,
  });
  await handle.waitFor();
  const original = await names.allTextContents();
  await handle.press("ArrowDown");
  await page.waitForFunction(
    () => document.querySelector("tbody tr td")?.textContent === "House pasta",
    { timeout: 700 },
  );
  assert.notDeepEqual(await names.allTextContents(), original);
  await page.getByRole("alert").first().waitFor();
  assert.deepEqual(await names.allTextContents(), original);
});

void test("blog publication state changes immediately and rolls back", async (t) => {
  const page = await preview(t, "/en/admin/blogs/b1000000-0000-4000-8000-000000000001");
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await page.getByText("Draft", { exact: true }).waitFor({ timeout: 700 });
  await page.getByRole("alert").waitFor();
  await page.getByText("Published", { exact: true }).waitFor();
});

void test("employee creation appears immediately and disappears on failure without losing inputs", async (t) => {
  const page = await preview(t, "/en/employees");
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Create employee", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create employee", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Optimistic employee");
  await dialog.getByLabel("Email", { exact: true }).fill("optimistic@example.test");
  await dialog.getByLabel("Temporary password", { exact: true }).fill("temporary-password");
  await dialog.getByRole("button", { name: "Create employee", exact: true }).click();
  const row = page.locator("tbody tr").filter({ hasText: "optimistic@example.test" });
  await row.waitFor({ timeout: 700 });
  await row.waitFor({ state: "hidden" });
  await dialog.getByRole("alert").waitFor();
  assert.equal(
    await dialog.getByLabel("Email", { exact: true }).inputValue(),
    "optimistic@example.test",
  );
});

void test("reservation cancellation is immediate and restores the booking on rejection", async (t) => {
  const page = await preview(t, "/en/reservations");
  await page
    .getByRole("combobox", { name: "Practitioner or resource", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: /09:00.*GMT/ }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Optimistic guest");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("guest@example.test");
  await page.getByRole("button", { name: "Review booking", exact: true }).click();
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await page.getByText("Your reservation has been saved.", { exact: false }).waitFor();
  await page.getByRole("link", { name: "Manage latest reservation" }).click();
  await page.getByLabel("Slow responses").check();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Cancel reservation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel reservation", exact: true }).click();
  await page
    .locator("span")
    .filter({ hasText: /^Cancelled$/ })
    .waitFor({ timeout: 700 });
  await dialog.getByRole("alert").waitFor();
  assert.equal(
    await page
      .locator("span")
      .filter({ hasText: /^Cancelled$/ })
      .count(),
    0,
  );
  await dialog.getByRole("button", { name: "Keep reservation", exact: true }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).waitFor();
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, path, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

test("Drive shortcuts validate, create once, retain failed edits, and exclude delete dialogs", async (t) => {
  const page = await preview(t, "/en/projects/portal/drive");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const create = page.getByRole("dialog", { name: "New folder", exact: true });
  const name = create.getByRole("textbox", { name: "Name", exact: true });
  await name.press("Meta+Enter");
  assert.equal(await name.evaluate((input) => input.validity.valueMissing), true);
  assert.equal(await create.isVisible(), true);
  await name.fill("Shortcut folder");
  await page.screenshot({ path: "/tmp/forge-modal-shortcut-desktop.png" });
  await name.press("Meta+Enter");
  await create.waitFor({ state: "hidden" });
  const row = page.getByRole("row").filter({ hasText: "Shortcut folder" });
  await row.waitFor();
  assert.equal(await row.count(), 1);

  await page.getByLabel("Simulate action failures").check();
  await row.getByRole("button", { name: "Rename", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Rename", exact: true });
  await rename.getByRole("textbox").fill("Renamed by shortcut");
  await rename.getByRole("textbox").press("Control+Enter");
  await rename.getByRole("alert").waitFor();
  assert.equal(await rename.getByRole("textbox").inputValue(), "Renamed by shortcut");
  await rename.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await row.getByRole("button", { name: "Rename", exact: true }).click();
  await rename.getByRole("textbox").fill("Renamed by shortcut");
  await rename.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Control+Enter");
  await rename.waitFor({ state: "hidden" });
  const renamed = page.getByRole("row").filter({ hasText: "Renamed by shortcut" });
  await renamed.waitFor();
  await renamed.getByRole("button", { name: "Delete", exact: true }).click();
  const deleting = page.getByRole("dialog", { name: "Delete files and folders", exact: true });
  await deleting.locator('button[type="submit"]').waitFor();
  await deleting.focus();
  await page.keyboard.press("Meta+Enter");
  assert.equal(await deleting.isVisible(), true);
  await deleting.getByRole("button", { name: "Cancel", exact: true }).click();
  await renamed.waitFor();
});

test("employee creation and editing support both platform shortcuts", async (t) => {
  const page = await preview(t, "/en/employees");
  await page.getByRole("button", { name: "Create employee", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create employee", exact: true });
  await create.getByLabel("Name", { exact: true }).fill("Shortcut Employee");
  await create.getByLabel("Email", { exact: true }).fill("shortcut@example.test");
  await create.getByLabel("Temporary password", { exact: true }).fill("temporary-password");
  await create.getByLabel("Temporary password", { exact: true }).press("Control+Enter");
  await create.waitFor({ state: "hidden" });
  const row = page.getByRole("row").filter({ hasText: "shortcut@example.test" });
  await row.getByRole("button", { name: /Edit.*Shortcut Employee/ }).click();
  const edit = page.getByRole("dialog");
  await edit.getByLabel("Name", { exact: true }).fill("Updated Shortcut Employee");
  await edit.getByLabel("Name", { exact: true }).press("Meta+Enter");
  await edit.waitFor({ state: "hidden" });
  await row.getByText("Updated Shortcut Employee", { exact: true }).waitFor();
});

test("menu dialogs submit their implicit save button on narrow dark screens", async (t) => {
  const page = await preview(t, "/en/admin/menus/taxonomy", {
    viewport: { width: 390, height: 844 },
  });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "New category", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New category", exact: true });
  await dialog.getByRole("textbox", { name: /Name.*English/ }).fill("Shortcut category");
  await page.screenshot({ path: "/tmp/forge-modal-shortcut-mobile-dark.png" });
  await dialog.getByRole("textbox", { name: /Name.*English/ }).press("Control+Enter");
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Shortcut category", { exact: true }).waitFor();
});

test("reservation rescheduling shortcuts respect disabled saves and submit the selected time", async (t) => {
  const page = await preview(t, "/en/reservations");
  await page.getByRole("button", { name: /09:00.*GMT/ }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Shortcut Guest");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("shortcut@example.test");
  await page.getByRole("button", { name: "Review booking", exact: true }).click();
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await page.getByText("Your reservation has been saved.", { exact: false }).waitFor();
  await page.getByRole("link", { name: "Manage latest reservation" }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.getByRole("button", { name: "Save new time" }).isDisabled(), true);
  await dialog.focus();
  await page.keyboard.press("Control+Enter");
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await dialog.getByRole("alert").count(), 0);
  await dialog.getByRole("button", { name: /(?:13:00|01:00.*PM).*GMT/ }).click();
  await page.keyboard.press("Meta+Enter");
  await dialog.waitFor({ state: "hidden" });
});

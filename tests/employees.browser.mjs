import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

test("website visibility saves immediately, preserves account drafts and rolls back failures", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100"}/en/employees`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const row = page.getByRole("row", { includeHidden: true }).filter({ hasText: "Alex Morgan" });
  const edit = page.getByRole("dialog", { name: "Edit employee", exact: true });
  const toggle = edit.getByRole("button", { name: "Website", exact: true });

  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
  await edit.getByLabel("Name", { exact: true }).fill("Unsaved name");
  await toggle.press("Space");
  await edit.getByRole("button", { name: "Website", pressed: false }).waitFor();
  assert.equal(await toggle.isDisabled(), true);
  await edit
    .getByRole("alert")
    .filter({ hasText: "Could not change website visibility" })
    .waitFor();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(await edit.getByLabel("Name", { exact: true }).inputValue(), "Unsaved name");
  await row.getByText("Visible on website", { exact: true }).waitFor();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
  await edit.getByLabel("Name", { exact: true }).fill("Unsaved name");
  await toggle.click();
  await actionToast(page, "Website visibility updated.");
  assert.equal(await edit.getByLabel("Name", { exact: true }).inputValue(), "Unsaved name");
  await row.getByText("Hidden on website", { exact: true }).waitFor();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
  assert.equal(await edit.getByLabel("Name", { exact: true }).inputValue(), "Alex Morgan");
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await toggle.press("Enter");
  await actionToast(page, "Website visibility updated.");
  await row.getByText("Visible on website", { exact: true }).waitFor();
});

test("employee pages show content only to administrators", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100"}/en/employees`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByRole("table").waitFor();
  for (const [name, status] of [
    ["Alex Morgan", "Visible on website"],
    ["Sam Rivera", "Hidden on website"],
  ]) {
    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByText(status, { exact: true }).waitFor();
    const editor = page.getByRole("dialog", { name: "Edit employee", exact: true });
    for (const [width, theme] of [
      [1440, "light"],
      [390, "dark"],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark")) {
        await toggle.click();
      }
      await row.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
      await editor.getByText(status, { exact: true }).waitFor();
      assert.equal(await editor.getByRole("checkbox").count(), 0);
      assert(await editor.evaluate((node) => node.scrollWidth <= node.clientWidth));
      if (process.env.TEST_CAPTURE_DIR) {
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/${name.split(" ")[0]}-${width}.png`,
        });
      }
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (process.env.TEST_CAPTURE_DIR) {
    await page.screenshot({ path: `${process.env.TEST_CAPTURE_DIR}/table.png` });
  }
  for (const label of ["Email verified", "Email not verified"]) {
    const indicator = page.getByRole("button", { name: label, exact: true });
    assert.equal(await indicator.textContent(), "");
    await indicator.hover();
    const tooltip = page.getByRole("tooltip", { name: label, exact: true });
    await tooltip.waitFor();
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
    await page.mouse.move(0, 0);
    await indicator.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await indicator.evaluate((node) => node === document.activeElement), true);
    await tooltip.waitFor();
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
  }
  for (const role of ["user", ""]) {
    await page.getByLabel("Preview as").selectOption(role);
    await page.getByRole("table").waitFor({ state: "hidden" });
    assert.equal(await page.getByText("alex@example.test", { exact: true }).count(), 0);
    assert.equal(
      await page.getByRole("button", { name: "Create employee", exact: true }).count(),
      0,
    );
  }
  await page.getByLabel("Preview as").selectOption("admin");
  await page.getByRole("button", { name: "Create employee", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create employee", exact: true });
  await dialog.getByLabel("Email", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await dialog.getByLabel("Name", { exact: true }).fill("Taylor Jordan");
  await dialog.getByLabel("Email", { exact: true }).fill("taylor@example.test");
  await dialog.getByLabel("Temporary password", { exact: true }).fill("temporary-password");
  await dialog.getByRole("button", { name: "Create employee", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("taylor@example.test", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Taylor Jordan", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit employee", exact: true });
  await edit.getByText("Hidden on website", { exact: true }).waitFor();
  await edit.getByLabel("Name", { exact: true }).fill("Taylor Lee");
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  await actionToast(page, "Employee updated.");
  await page
    .getByRole("row")
    .filter({ hasText: "Taylor Lee" })
    .getByText("Hidden on website", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Send verification email to Taylor Lee", exact: true })
    .click();
  await actionToast(page, "Verification email sent.");
  assert.deepEqual(errors, []);
});

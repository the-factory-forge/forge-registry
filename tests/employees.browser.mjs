import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

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
  assert.deepEqual(errors, []);
});

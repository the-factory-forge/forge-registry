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
  await page.getByRole("table").waitFor();
  await page.locator("summary").filter({ hasText: "Preview controls" }).click();
  for (const role of ["user", ""]) {
    await page.getByLabel("Preview as").selectOption(role);
    await page.getByRole("table").waitFor({ state: "hidden" });
    assert.equal(await page.getByText("alex@example.test", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Create User", exact: true }).count(), 0);
  }
  await page.getByLabel("Preview as").selectOption("admin");
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create User", exact: true });
  await dialog.getByLabel("Email", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await dialog.getByLabel("Name", { exact: true }).fill("Taylor Jordan");
  await dialog.getByLabel("Email", { exact: true }).fill("taylor@example.test");
  await dialog.getByLabel("Temporary password", { exact: true }).fill("temporary-password");
  await dialog.getByRole("button", { name: "Create User", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("taylor@example.test", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

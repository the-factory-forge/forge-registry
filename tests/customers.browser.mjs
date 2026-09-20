import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, route = "", options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}/en/customers${route}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.locator("summary").filter({ hasText: "Preview controls" }).click();
  return page;
}

test("directory search, loading/error states, optional actions and sync extension", async (t) => {
  const page = await preview(t);
  const search = page.getByRole("textbox", { name: "Search customers", exact: true });
  await search.fill("ACME");
  await page.getByRole("row").filter({ hasText: "Sam Rivera" }).waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("row").count(), 2);
  await search.fill("unknown");
  await page.getByText("No customers found.", { exact: true }).waitFor();
  await search.fill("");
  await page.getByLabel("Directory state").selectOption("loading");
  await page.getByText("Loading customers...", { exact: true }).waitFor();
  await page.getByLabel("Directory state").selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Unable to load customers" }).waitFor();
  await page.getByLabel("Directory state").selectOption("ready");
  await page.getByRole("checkbox", { name: "Account actions", exact: true }).uncheck();
  for (const name of ["Verify customer", "Impersonate customer", "Delete Customer"])
    assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
  await page.getByRole("checkbox", { name: "Host integration example" }).check();
  await page.getByRole("columnheader", { name: "Host sync" }).waitFor();
  await page.getByText("Host toolbar", { exact: true }).waitFor();
});

test("verification and impersonation callbacks support errors and retry", async (t) => {
  const page = await preview(t);
  const row = page.getByRole("row").filter({ hasText: "Acme Studio" });
  await page.getByLabel("Simulate action failures").check();
  await row.getByRole("button", { name: "Verify customer", exact: true }).click();
  await row.getByRole("alert").waitFor();
  await page.getByLabel("Simulate action failures").uncheck();
  await row.getByRole("button", { name: "Verify customer", exact: true }).click();
  await row.getByRole("button", { name: "Unverify customer", exact: true }).waitFor();
  await row.getByRole("button", { name: "Impersonate customer" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Impersonation callback received for Alex Morgan" })
    .waitFor();
});

test("editing retains drafts across rerenders and failures, then refreshes saved data", async (t) => {
  const page = await preview(t, "/acme");
  const company = page.getByRole("textbox", { name: "Company name", exact: true });
  await company.fill("Updated Studio");
  await page.getByLabel("Simulate action failures").check();
  assert.equal(await company.inputValue(), "Updated Studio");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
  assert.equal(await company.inputValue(), "Updated Studio");
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByRole("heading", { name: "Updated Studio", exact: true }).waitFor();
  await page.getByRole("status").filter({ hasText: "Customer updated successfully" }).waitFor();
  await page.getByRole("link", { name: "Back to Customers" }).click();
  await page.getByRole("row").filter({ hasText: "Updated Studio" }).waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "Sam Rivera" })
    .getByRole("link", { name: "Edit customer details" })
    .click();
  assert.equal(await page.getByLabel("Full name *", { exact: true }).inputValue(), "Sam Rivera");
  await page.getByLabel("Email *", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
});

test("creation validates fields, handles clipboard failures and never displays invitations", async (t) => {
  const page = await preview(t, "/new");
  const submit = page.getByRole("button", { name: "Create Customer", exact: true });
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Enter a full name" }).waitFor();
  await page.getByLabel("Full name *", { exact: true }).fill("   ");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Enter a full name" }).waitFor();
  await page.getByLabel("Full name *", { exact: true }).fill("Taylor Casey");
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
  await page.getByLabel("Email", { exact: true }).fill("");
  const password = page.getByLabel("Temporary password", { exact: true });
  await password.fill("short");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Use 12–128 characters" }).waitFor();
  await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Generate and copy a strong password" }).click();
  await page.getByRole("alert").filter({ hasText: "Could not copy the password" }).waitFor();
  assert.equal((await password.inputValue()).length, 20);
  assert.equal(await password.getAttribute("maxlength"), "128");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.getByRole("button", { name: "Copy password", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Password copied." }).waitFor();
  await page.getByLabel("Email *", { exact: true }).fill("taylor@example.com");
  await page.getByLabel("Simulate action failures").check();
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
  assert.equal((await password.inputValue()).length, 20);
  await page.getByLabel("Simulate action failures").uncheck();
  await page.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  assert.equal(
    await page.getByRole("button", { name: "Please wait...", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("heading", { name: "Taylor Casey", exact: true }).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(await page.getByText(/invitation/i).count(), 0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByRole("link", { name: "Back to Customers" }).click();
  await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
  assert.equal(await page.getByRole("row").filter({ hasText: "Taylor Casey" }).count(), 1);
  await page.getByRole("link", { name: "Create Customer" }).click();
  assert.equal(await page.getByLabel("Temporary password", { exact: true }).inputValue(), "");
});

test("a customer can be created without email or credentials", async (t) => {
  const page = await preview(t, "/new");
  await page.getByLabel("Full name *", { exact: true }).fill("Offline Contact");
  await page.getByRole("button", { name: "Create Customer", exact: true }).click();
  await page.getByRole("heading", { name: "Offline Contact", exact: true }).waitFor();
});

test("delete confirmation restores focus on Escape and retains failures for retry", async (t) => {
  const page = await preview(t, "/sam");
  const trigger = page.getByRole("button", { name: "Delete Customer", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Delete Customer" });
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Cancel" })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
  await page.getByLabel("Simulate action failures").check();
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
  assert.equal(await page.getByRole("row").filter({ hasText: "Sam Rivera" }).count(), 0);
});

test("Projects and Sync are empty by default and accept host content", async (t) => {
  const page = await preview(t, "/acme");
  for (const section of ["Projects", "Sync"]) {
    await page.getByRole("link", { name: section, exact: true }).click();
    await page.locator('nav a[aria-current="page"]').filter({ hasText: section }).waitFor();
    assert.equal(
      await page.getByRole("link", { name: section, exact: true }).getAttribute("aria-current"),
      "page",
    );
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.getByText(/Host (projects|sync) content/).count(), 0);
  }
  await page.getByLabel("Host integration example").check();
  await page.getByText("Host sync content", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByText("Host projects content", { exact: true }).waitFor();
});

test("desktop and mobile pages fit in both themes", async (t) => {
  for (const colorScheme of ["light", "dark"]) {
    for (const { name, viewport } of [
      { name: "desktop", viewport: { width: 1600, height: 1100 } },
      { name: "mobile", viewport: { width: 390, height: 844 } },
    ]) {
      const page = await preview(t, "/acme", { colorScheme, viewport });
      await page.getByRole("heading", { name: "Billing address" }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-customers-${name}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "Back to Customers" }).click();
      await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-customers-list-${name}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "Create Customer", exact: true }).click();
      await page.getByRole("heading", { name: "New Customer", exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-customers-new-${name}-${colorScheme}.png`,
        fullPage: true,
      });
    }
  }
});

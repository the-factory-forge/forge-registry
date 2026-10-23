import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

await suite("Customers browser", async () => {
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
    if (options.colorScheme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    return page;
  }

  await test("directory search, loading/error states, optional actions and sync extension", async (t) => {
    const page = await preview(t);
    await page.getByRole("button", { name: "Search customers", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "Search customers", exact: true });
    await search.fill("ACME");
    await page.getByRole("row").filter({ hasText: "Sam Rivera" }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("row").count(), 2);
    await search.fill("unknown");
    await page.getByText("No customers found.", { exact: true }).waitFor();
    await search.fill("");
    await page.getByLabel("Directory state").selectOption("loading");
    await page.locator('table[aria-busy="true"]').waitFor();
    assert.ok((await page.getByRole("row").count()) > 1);
    await page.getByLabel("Directory state").selectOption("error");
    await page.getByRole("alert").filter({ hasText: "Unable to load customers" }).waitFor();
    await page.getByLabel("Directory state").selectOption("ready");
    await page.getByRole("checkbox", { name: "Account actions", exact: true }).uncheck();
    for (const name of ["Verify customer", "Impersonate customer", "Delete customer"])
      assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
    await page.getByRole("checkbox", { name: "Host integration example" }).check();
    await page.getByRole("columnheader", { name: "Host sync" }).waitFor();
    await page.getByText("Host toolbar", { exact: true }).waitFor();
  });

  await test("verification and impersonation callbacks support errors and retry", async (t) => {
    const page = await preview(t);
    const row = page.getByRole("row").filter({ hasText: "Acme Studio" });
    await page.getByLabel("Simulate action failures").check();
    await row
      .getByRole("button", { name: "Email verification for Acme Studio: Unverified", exact: true })
      .click();
    await page.getByRole("menuitemradio", { name: "Verified", exact: true }).click();
    await page.getByRole("menu").getByRole("alert").waitFor();
    await page.keyboard.press("Escape");
    await page.getByLabel("Simulate action failures").uncheck();
    await row
      .getByRole("button", { name: "Email verification for Acme Studio: Unverified", exact: true })
      .click();
    await page.getByRole("menuitemradio", { name: "Verified", exact: true }).click();
    await actionToast(page, "Customer updated");
    await row
      .getByRole("button", { name: "Email verification for Acme Studio: Verified", exact: true })
      .waitFor();
    await row.getByRole("button", { name: "Impersonate customer" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Impersonation callback received for Alex Morgan" })
      .waitFor();
  });

  await test("editing retains drafts across rerenders and failures, then refreshes saved data", async (t) => {
    const page = await preview(t, "/acme");
    const company = page.getByRole("textbox", { name: "Company name", exact: true });
    await company.fill("Updated Studio");
    await page.getByLabel("Simulate action failures").check();
    assert.equal(await company.inputValue(), "Updated Studio");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
    assert.equal(await company.inputValue(), "Updated Studio");
    await page.getByLabel("Simulate action failures").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("heading", { name: "Updated Studio", exact: true }).waitFor();
    await actionToast(page, "Customer updated");
    await page.getByRole("link", { name: "Back to customers" }).click();
    await page.getByRole("row").filter({ hasText: "Updated Studio" }).waitFor();
    await page
      .getByRole("row")
      .filter({ hasText: "Sam Rivera" })
      .getByRole("link", { name: "Edit customer details" })
      .click();
    assert.equal(await page.getByLabel("Full name *", { exact: true }).inputValue(), "Sam Rivera");
    await page.getByLabel("Email *", { exact: true }).fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
  });

  await test("creation validates contact fields without collecting a password", async (t) => {
    const page = await preview(t, "/new");
    const submit = page.getByRole("button", { name: "Create customer", exact: true });
    await submit.click();
    await page.getByRole("alert").filter({ hasText: "Enter a full name" }).waitFor();
    await page.getByLabel("Full name *", { exact: true }).fill("   ");
    await submit.click();
    await page.getByRole("alert").filter({ hasText: "Enter a full name" }).waitFor();
    await page.getByLabel("Full name *", { exact: true }).fill("Taylor Casey");
    await page.getByLabel("Email *", { exact: true }).fill("invalid-email");
    await submit.click();
    await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
    await page.getByLabel("Email *", { exact: true }).fill("");
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.getByLabel("Email *", { exact: true }).fill("taylor@example.com");
    await page.getByLabel("Simulate action failures").check();
    await submit.click();
    await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
    assert.equal(
      await page.getByLabel("Email *", { exact: true }).inputValue(),
      "taylor@example.com",
    );
    await page.getByLabel("Simulate action failures").uncheck();
    await page.locator("form").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    assert.equal(
      await page.getByRole("button", { name: "Please wait…", exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("heading", { name: "Taylor Casey", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Hide password", exact: true }).count(), 0);
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    assert.equal(await page.getByText(/invitation/i).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.getByRole("link", { name: "Back to customers" }).click();
    await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
    assert.equal(await page.getByRole("row").filter({ hasText: "Taylor Casey" }).count(), 1);
    await page.getByRole("link", { name: "Create customer" }).click();
    assert.equal(await page.locator('input[type="password"]').count(), 0);
  });

  await test("customer creation requires email and never collects credentials", async (t) => {
    const page = await preview(t, "/new");
    await page.getByLabel("Full name *", { exact: true }).fill("Offline Contact");
    await page.getByRole("button", { name: "Create customer", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Enter a valid email" }).waitFor();
    assert.equal(await page.getByLabel("Email *", { exact: true }).getAttribute("required"), "");
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.getByLabel("Email *", { exact: true }).fill("contact@example.test");
    await page.getByRole("button", { name: "Create customer", exact: true }).click();
    await page.getByRole("heading", { name: "Offline Contact", exact: true }).waitFor();
  });

  await test("delete confirmation restores focus on Escape and retains failures for retry", async (t) => {
    const page = await preview(t, "/sam");
    const trigger = page.getByRole("button", { name: "Delete customer", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Delete customer" });
    await dialog.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === "Cancel");
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

  await test("customer projects show sample records by default without an unused Sync tab", async (t) => {
    const page = await preview(t, "/acme/projects");
    await page.getByRole("row").filter({ hasText: "Studio website" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Sync", exact: true }).count(), 0);
    assert.equal(
      await page.getByRole("link", { name: "Projects", exact: true }).getAttribute("aria-current"),
      "page",
    );
    await page.reload();
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.getByRole("row").filter({ hasText: "Studio website" }).waitFor();
    await page.getByLabel("Projects integration", { exact: true }).uncheck();
    await page.getByLabel("Host integration example").check();
    await page.getByText("Host projects content", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Sync", exact: true }).count(), 0);
    await page.goto(`${baseURL}/en/customers/acme/sync`);
    await page.getByRole("heading", { name: "Customer page not found" }).waitFor();
  });

  await test("desktop and mobile pages fit in both themes", async (t) => {
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
        await page.getByRole("link", { name: "Projects", exact: true }).click();
        await page.getByRole("row").filter({ hasText: "Studio website" }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Sync", exact: true }).count(), 0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `/tmp/forge-customer-projects-${name}-${colorScheme}.png`,
          fullPage: true,
        });
        await page.getByRole("link", { name: "Back to customers" }).click();
        await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `/tmp/forge-customers-list-${name}-${colorScheme}.png`,
          fullPage: true,
        });
        await page.getByRole("link", { name: "Create customer", exact: true }).click();
        await page.getByRole("heading", { name: "New customer", exact: true }).waitFor();
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

  await test("customer detail verification preserves drafts and follows host permissions", async (t) => {
    const page = await preview(t, "/acme");
    const company = page.getByRole("textbox", { name: "Company name", exact: true });
    await company.fill("Unsaved company");
    const badge = page.getByRole("button", { name: /Email verification for Acme Studio:/ });
    await badge.click();
    await page.getByRole("menuitemradio", { name: "Verified", exact: true }).click();
    await actionToast(page, "Customer updated");
    assert.equal(await company.inputValue(), "Unsaved company");
    await page.getByRole("heading", { name: "Acme Studio", exact: true }).waitFor();
    await page.getByLabel("Account actions", { exact: true }).uncheck();
    assert.equal(await badge.count(), 0);
    await page.getByText("Verified", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Back to customers", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: "Acme Studio" });
    await row.getByText("Verified", { exact: true }).waitFor();
    await page.getByLabel("Account actions", { exact: true }).check();
    await page.getByLabel("Directory state").selectOption("loading");
    assert.equal(await row.getByRole("button", { name: /Email verification/ }).isDisabled(), true);
  });
});

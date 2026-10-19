import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto((process.env.TEST_BASE_URL ?? "http://127.0.0.1:3101") + "/en/account");
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}
void test("account keeps its intranet navigation for default and host content on desktop and mobile", async (t) => {
  const page = await preview(t);
  const navigation = page.getByRole("navigation", { name: "Side navigation", exact: true });
  await navigation.waitFor();
  const profile = navigation.getByRole("link", { name: "Profile settings", exact: true });
  assert.equal(await profile.getAttribute("href"), "/en/account");
  assert.equal(await profile.getAttribute("aria-current"), "page");
  await page.getByLabel("Host profile content").check();
  await page.getByRole("heading", { name: "Host profile summary" }).waitFor();
  await navigation.waitFor();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "Toggle side navigation", exact: true }).click();
  await profile.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.keyboard.press("Escape");
  await navigation.waitFor({ state: "hidden" });
});
void test("account preserves failed drafts, blocks duplicate callbacks, and clears one-time keys", async (t) => {
  const page = await preview(t);
  await page.getByLabel("Simulate action failures").check();
  await page.getByLabel("Name", { exact: true }).fill("Updated name");
  await page
    .getByRole("tabpanel")
    .locator("form")
    .evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Updated name");
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("heading", { name: "Updated name", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await page.getByText("You signed in with GitHub", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Reset password", exact: true }).count(), 0);
  await page.getByRole("cell", { name: "Expired", exact: true }).waitFor();
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const expiry = dialog.getByLabel("Expiry date and time");
  const { defaultLifetime, maxLifetime, max } = await expiry.evaluate((input) => ({
    defaultLifetime: new Date(input.value).getTime() - Date.now(),
    maxLifetime: new Date(input.max).getTime() - Date.now(),
    max: input.max,
  }));
  assert.ok(defaultLifetime > 29 * 86400000 && defaultLifetime <= 30 * 86400000);
  assert.ok(maxLifetime > 89 * 86400000 && maxLifetime <= 90 * 86400000);
  await dialog.getByLabel("Name", { exact: true }).fill("Integration");
  await dialog.getByLabel("Expiry date and time").fill("2020-01-01T12:00");
  await dialog.getByRole("button", { name: "Create key", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  for (const offset of [60000, 86400000]) {
    await expiry.fill(new Date(Date.parse(`${max}Z`) + offset).toISOString().slice(0, 16));
    await dialog.getByRole("button", { name: "Create key", exact: true }).click();
    assert.equal(await expiry.evaluate((input) => input.validity.rangeOverflow), true);
    assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  }
  const future = new Date(Date.now() + 86400000);
  future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
  await dialog.getByLabel("Expiry date and time").fill(future.toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Integration");
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await dialog.getByText("Could not create the key. Try again.").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "3");
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "Integration");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Integration");
  await expiry.fill(await expiry.getAttribute("max"));
  await dialog.getByRole("button", { name: "Create key", exact: true }).click();
  await page.getByRole("heading", { name: "Key created", exact: true }).waitFor();
  assert.match(await page.getByLabel("New agent key").inputValue(), /^forge_key_preview/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("New agent key").waitFor({ state: "detached" });
  assert.equal(
    await page
      .evaluate(() =>
        JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
      )
      .then((value) => value.includes("forge_key_preview")),
    false,
  );
  await page.getByRole("button", { name: "Delete Integration", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("cell", { name: "Integration", exact: true }).waitFor({ state: "hidden" });
});
void test("account retries loading, resets credential passwords, and revokes only other sessions", async (t) => {
  const page = await preview(t);
  await page.getByLabel("Email and password account").check();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  const password = page.getByLabel("New password", { exact: true });
  assert.equal(await page.locator('input[type="password"]').count(), 2);
  await page.getByLabel("Current password", { exact: true }).fill("old-password");
  await password.fill("new-password-123");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await actionToast(page, "Password changed successfully");
  assert.equal(await password.inputValue(), "");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await page.getByRole("button", { name: "Reset email sent", exact: true }).waitFor();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByText("Could not sign out this session. Refresh and try again.").waitFor();
  await page.getByText("Other session", { exact: true }).waitFor();
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByText("Other session", { exact: true }).waitFor({ state: "hidden" });
  await page.getByText("Current session", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign out", exact: true }).count(), 0);
  await page.getByLabel("Simulate load failure").check();
  await page
    .getByRole("button", { name: "Create key", exact: true })
    .isDisabled()
    .then((value) => assert.equal(value, true));
  await page.getByRole("button", { name: "Try again", exact: true }).first().click();
  await page.getByText("Current session", { exact: true }).waitFor();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
});

void test("host account content replaces default panels and creation remains a host capability", async (t) => {
  const page = await preview(t);
  await page.getByLabel("Host profile content").check();
  await page.getByRole("heading", { name: "Host profile summary" }).waitFor();
  assert.equal(await page.getByRole("tab").count(), 0);
  assert.equal(await page.getByLabel("Name", { exact: true }).count(), 0);
  await page.getByLabel("Company name").fill("Customer-specific draft");
  await page.getByLabel("Simulate action failures").check();
  assert.equal(await page.getByLabel("Company name").inputValue(), "Customer-specific draft");
  await page.getByLabel("Host profile content").uncheck();
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByLabel("Allow key creation").uncheck();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Create key", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Delete Expired integration", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("cell", { name: "Expired integration", exact: true })
    .waitFor({ state: "hidden" });
});

for (const width of [390, 1280]) {
  void test(`agent keys select rows and confirm bulk deletion at ${width}px`, async (t) => {
    const page = await preview(t);
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("tab", { name: "Security", exact: true }).click();
    const all = page.getByRole("checkbox", {
      name: "Select all keys",
      exact: true,
      includeHidden: true,
    });
    const expired = page.getByRole("checkbox", {
      name: "Select key Expired integration",
      exact: true,
      includeHidden: true,
    });
    const active = page.getByRole("checkbox", {
      name: "Select key Reporting integration",
      exact: true,
    });
    const bulk = page.getByRole("button", { name: /Delete selected keys \(/ });
    const state = () => all.evaluate((input) => [input.checked, input.indeterminate]);
    assert.deepEqual(await state(), [false, false]);
    assert.equal(await bulk.isVisible(), true);
    assert.equal(await bulk.isDisabled(), true);
    const tableHeight = (await all.locator("xpath=ancestor::table").boundingBox()).height;
    await expired.focus();
    await page.keyboard.press("Space");
    assert.deepEqual(await state(), [false, true]);
    assert.equal(await bulk.getAttribute("aria-label"), "Delete selected keys (1)");
    assert.equal((await all.locator("xpath=ancestor::table").boundingBox()).height, tableHeight);
    await bulk.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Expired integration", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("Reporting integration", { exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await expired.isChecked(), true);
    assert.equal(await page.getByTestId("callback-count").textContent(), "0");
    await all.click();
    assert.deepEqual(await state(), [true, false]);
    assert.equal(await active.isChecked(), true);
    await all.click();
    assert.deepEqual(await state(), [false, false]);
    assert.equal(await expired.isChecked(), false);
    assert.equal(await active.isChecked(), false);
    assert.equal(await bulk.isVisible(), true);
    assert.equal(await bulk.isDisabled(), true);
    await all.click();
    await bulk.click();
    await dialog.getByRole("heading", { name: "Delete selected keys?", exact: true }).waitFor();
    assert.match(await dialog.textContent(), /Expired integration, Reporting integration/);
    await dialog.getByRole("button", { name: "Delete", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    assert.equal(await all.isDisabled(), true);
    assert.equal(await expired.isDisabled(), true);
    assert.equal(
      await dialog.getByRole("button", { name: "Cancel", exact: true }).isDisabled(),
      true,
    );
    await actionToast(page, "Keys deleted");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.getByTestId("callback-count").textContent(), "2");
    assert.equal(await bulk.count(), 0);
    await page
      .getByText("No agent keys yet. Create a key when you connect an integration.")
      .waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  });
}

void test("bulk key deletion preserves only failed selections and retries without repeating successes", async (t) => {
  const page = await preview(t);
  await page.getByLabel("Fail expired key deletion").check();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  const all = page.getByRole("checkbox", { name: "Select all keys", exact: true });
  await all.check();
  await page.getByRole("button", { name: "Delete selected keys (2)", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  assert.equal(
    await page
      .getByRole("cell", { name: "Reporting integration", exact: true, includeHidden: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Select key Expired integration",
        exact: true,
        includeHidden: true,
      })
      .isChecked(),
    true,
  );
  await dialog.getByText("Expired integration", { exact: true }).waitFor();
  assert.doesNotMatch(await dialog.textContent(), /Reporting integration/);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Fail expired key deletion").uncheck();
  await page.getByRole("button", { name: "Delete selected keys (1)", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await actionToast(page, "Key deleted");
  assert.equal(await page.getByTestId("callback-count").textContent(), "3");
  assert.equal(await all.count(), 0);
});

void test("key selection clears when metadata becomes unavailable", async (t) => {
  const page = await preview(t);
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select all keys", exact: true }).check();
  await page.getByLabel("Simulate load failure").check();
  await page.getByRole("button", { name: "Try again", exact: true }).first().click();
  const all = page.getByRole("checkbox", { name: "Select all keys", exact: true });
  await all.waitFor();
  assert.deepEqual(await all.evaluate((input) => [input.checked, input.indeterminate]), [
    false,
    false,
  ]);
  assert.equal(
    await page.getByRole("button", { name: /Delete selected keys \(/ }).isDisabled(),
    true,
  );
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";
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
  await dialog.getByLabel("Name", { exact: true }).fill("Integration");
  await dialog.getByLabel("Expiry date and time").fill("2020-01-01T12:00");
  await dialog.getByRole("button", { name: "Create key", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
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

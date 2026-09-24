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
async function preview(t, path) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

test("recovery validates email, blocks duplicates, and retains a failed draft", async (t) => {
  const page = await preview(t, "/en/forgot-password");
  const email = page.getByLabel("Email", { exact: true });
  await email.fill("invalid");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  assert.equal(await page.getByTestId("callback-count").textContent(), "0");
  await email.fill("person@example.com");
  await page.getByLabel("Simulate failure").check();
  await page.locator("#main-content form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  assert.equal(await email.inputValue(), "person@example.com");
  await page.getByLabel("Simulate failure").uncheck();
  assert.equal(await email.inputValue(), "person@example.com");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
  await page.getByText("If an account exists for this email", { exact: false }).waitFor();
  assert.equal(await email.count(), 0);
  await page.reload();
  await page.getByLabel("Service available").uncheck();
  await page.getByText("Password recovery is currently unavailable.", { exact: false }).waitFor();
  assert.equal(await email.count(), 0);
});

test("password forms validate, retain failed values, and clear successful credentials", async (t) => {
  const page = await preview(t, "/en/reset-password");
  for (const view of ["reset-password", "change-password"]) {
    await page.goto(`${baseURL}/en/${view}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    if (view === "change-password")
      await page.getByLabel("Current password", { exact: true }).fill("old-password");
    const password = page.getByLabel("New password", { exact: true });
    const confirm = page.getByLabel("Confirm password", { exact: true });
    const button = page.getByRole("button", {
      name: view === "reset-password" ? "Save new password" : "Change password",
      exact: true,
    });
    await password.fill("short");
    await confirm.fill("short");
    await button.click();
    assert.equal(await page.getByTestId("callback-count").textContent(), "0");
    await password.fill("new-password-123");
    await confirm.fill("different-password");
    await button.click();
    await page.getByRole("alert").filter({ hasText: "Passwords do not match." }).waitFor();
    assert.equal(await confirm.getAttribute("aria-invalid"), "true");
    assert.equal(await confirm.evaluate((element) => element === document.activeElement), true);
    await confirm.fill("new-password-123");
    await page.getByLabel("Simulate failure").check();
    await page.locator("#main-content form").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.getByRole("alert").filter({ hasText: "Could not" }).waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "1");
    assert.equal(await password.inputValue(), "new-password-123");
    await page.getByLabel("Simulate failure").uncheck();
    await page.getByLabel("12–16 character password policy").check();
    assert.equal(await password.inputValue(), "new-password-123");
    assert.equal(await password.getAttribute("minlength"), "12");
    assert.equal(await password.getAttribute("maxlength"), "16");
    await button.click();
    await page
      .getByRole("status")
      .filter({
        hasText:
          view === "reset-password"
            ? "Your password has been reset"
            : "Password changed successfully",
      })
      .waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "2");
    if (view === "reset-password") assert.equal(await password.count(), 0);
    else {
      assert.equal(await password.inputValue(), "");
      assert.equal(await confirm.inputValue(), "");
      assert.equal(await page.getByLabel("Current password", { exact: true }).inputValue(), "");
    }
  }
  await page.goto(baseURL + "/en/reset-password");
  await page.getByLabel("Valid reset link").uncheck();
  await page.getByRole("alert").filter({ hasText: "invalid or has expired" }).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  await page.getByRole("link", { name: "Request a new link", exact: true }).click();
  await page.getByRole("heading", { name: "Forgot your password?", exact: true }).waitFor();
});

test("auth pages support keyboard navigation, SSR, both themes, and narrow screens", async (t) => {
  const page = await preview(t, "/en/login");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("link", { name: "Forgot password?", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Forgot your password?", exact: true }).waitFor();
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      for (const path of [
        "forgot-password",
        "reset-password",
        "change-password",
        "access-denied",
      ]) {
        const response = await page.goto(`${baseURL}/en/${path}`);
        assert.equal(response.status(), 200);
        assert.match(await response.text(), /<h1/);
        await page.locator('[data-preview-ready="true"]').waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${path} ${theme} ${width}`,
        );
        if (path === "reset-password")
          await page.screenshot({ path: `/tmp/forge-login-${theme}-${width}.png`, fullPage: true });
      }
    }
  }
  assert.deepEqual(errors, []);
});

test("Google and password sign-in share a lock, preserve drafts on failure, and allow retry", async (t) => {
  const page = await preview(t, "/en/login");
  assert.equal(await page.getByRole("button", { name: /GitHub|example provider/ }).count(), 0);
  await page.getByLabel("Email", { exact: true }).fill("person@example.test");
  await page.getByLabel("Password", { exact: true }).fill("retained-password");
  await page.getByLabel("Simulate sign-in failure").check();
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });
  await google.focus();
  await page.keyboard.press("Enter");
  await page.locator("#main-content form").evaluate((form) => form.requestSubmit());
  await page.getByRole("alert").filter({ hasText: "Could not sign in with Google" }).waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  assert.equal(
    await page.getByLabel("Password", { exact: true }).inputValue(),
    "retained-password",
  );
  await page.getByLabel("Simulate sign-in failure").uncheck();
  await google.click();
  await page.getByRole("status").filter({ hasText: "Google sign-in callback received." }).waitFor();
  assert.equal(await google.isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isDisabled(), true);
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  await page.reload();
  await page.getByLabel("Service available").uncheck();
  assert.equal(await google.isDisabled(), true);
});

test("shared sign-out reports failure, prevents duplicate clicks, and retries", async (t) => {
  const page = await preview(t, "/en/login");
  await page.getByLabel("Simulate sign-in failure").check();
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  await signOut.evaluate((button) => {
    button.click();
    button.click();
  });
  await page.getByRole("alert").filter({ hasText: "Could not sign out" }).waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "1");
  await page.getByLabel("Simulate sign-in failure").uncheck();
  await signOut.click();
  await page.getByRole("status").filter({ hasText: "Sign-out callback received." }).waitFor();
  assert.equal(await page.getByTestId("callback-count").textContent(), "2");
  assert.equal(await signOut.isDisabled(), true);
});

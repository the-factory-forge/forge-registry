import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

await suite("Login browser", async () => {
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

  await test("verification prefills login, confirms once and shows invalid links without success", async (t) => {
    const page = await preview(t, "/en/login");
    await page.getByLabel("Email verification result").selectOption("success");
    const email = page.getByLabel("Email", { exact: true });
    assert.equal(await email.inputValue(), "member+verified@example.test");
    const toast = page
      .getByRole("dialog")
      .filter({ hasText: "Your email address has been verified." });
    await toast.waitFor();
    assert.equal(await toast.count(), 1);
    await email.fill("corrected@example.test");
    await page.getByLabel("Simulate action failures").check();
    assert.equal(await email.inputValue(), "corrected@example.test");
    assert.equal(await toast.count(), 1);
    await actionToast(page, "Your email address has been verified.");
    await page.getByLabel("Email verification result").selectOption("error");
    await page
      .getByRole("alert")
      .filter({ hasText: "This verification link is invalid or has expired." })
      .waitFor();
    assert.equal(await toast.count(), 0);
    assert.equal(await email.inputValue(), "member+verified@example.test");
  });

  await test("recovery validates email, blocks duplicates, and retains a failed draft", async (t) => {
    const page = await preview(t, "/en/forgot-password");
    const email = page.getByLabel("Email", { exact: true });
    await email.fill("invalid");
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    assert.equal(await page.getByTestId("callback-count").textContent(), "0");
    await email.fill("person@example.com");
    await page.getByLabel("Simulate action failures").check();
    await page.locator("#factory-auth-main-content form").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "1");
    assert.equal(await email.inputValue(), "person@example.com");
    const brokenReferences = await page.evaluate(() =>
      [...document.querySelectorAll("[aria-describedby], [aria-labelledby], label[for]")].flatMap(
        (element) =>
          ["aria-describedby", "aria-labelledby", "for"].flatMap((attribute) =>
            (element.getAttribute(attribute) ?? "")
              .split(/\s+/)
              .filter((id) => id.startsWith("factory-") && !document.getElementById(id)),
          ),
      ),
    );
    assert.deepEqual(brokenReferences, []);

    await page.getByLabel("Simulate action failures").uncheck();
    assert.equal(await email.inputValue(), "person@example.com");
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await page.getByRole("heading", { name: "Check your email", exact: true }).waitFor();
    await page.getByText("If an account exists for this email", { exact: false }).waitFor();
    assert.equal(await email.count(), 0);
    await page.reload();
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.getByLabel("Service available").uncheck();
    await page.getByText("Password recovery is currently unavailable.", { exact: false }).waitFor();
    assert.equal(await email.count(), 0);
  });

  await test("password forms validate, retain failed values, and clear successful credentials", async (t) => {
    const page = await preview(t, "/en/reset-password");
    for (const view of ["reset-password", "account"]) {
      await page.goto(`${baseURL}/en/${view}`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      if (view === "account") {
        await page.getByLabel("Email and password account").check();
        await page.getByRole("tab", { name: "Security", exact: true }).click();
      }
      const password = page.getByLabel("New password", { exact: true });
      const current = page.getByLabel("Current password", { exact: true });
      const requestLink = page.getByRole("link", { name: "Request a new link", exact: true });
      assert.equal(await requestLink.count(), view === "reset-password" ? 1 : 0);
      if (view === "reset-password") {
        assert.equal(await requestLink.getAttribute("href"), "/en/forgot-password");
        assert.equal(await requestLink.evaluate((link) => Boolean(link.closest("form"))), true);
      }
      assert.equal(
        await page.locator('input[type="password"]').count(),
        view === "account" ? 2 : 1,
      );
      assert.deepEqual(
        await password.evaluate((input) => [...new FormData(input.form).keys()]),
        view === "account" ? ["currentPassword", "newPassword"] : ["newPassword"],
      );
      const button = page.getByRole("button", {
        name: view === "reset-password" ? "Save new password" : "Change password",
        exact: true,
      });
      await password.fill("short");
      await button.click();
      assert.equal(await page.getByTestId("callback-count").textContent(), "0");
      await password.fill("new-password-123");
      if (view === "account") {
        await button.click();
        assert.equal(await page.getByTestId("callback-count").textContent(), "0");
        assert.equal(await current.evaluate((input) => input.validity.valueMissing), true);
        assert.equal(await current.getAttribute("autocomplete"), "current-password");
        assert.equal(await current.getAttribute("minlength"), null);
        await current.fill("old-password");
      }
      await page.getByLabel("Simulate action failures").check();
      const visibility = page.locator(
        `button[aria-controls="${await password.getAttribute("id")}"]`,
      );
      await visibility.click();
      const initialPosition = await password.boundingBox();
      await password.evaluate((input) => {
        input.form.requestSubmit();
        input.form.requestSubmit();
      });
      assert.equal(await visibility.isDisabled(), true);
      await page.getByRole("alert").filter({ hasText: "Could not" }).waitFor();
      assert.equal(await visibility.isDisabled(), false);
      assert.equal(await password.getAttribute("type"), "text");
      assert.equal(await page.getByTestId("callback-count").textContent(), "1");
      assert.equal(await password.inputValue(), "new-password-123");
      if (view === "account") assert.equal(await current.inputValue(), "old-password");
      assert.deepEqual(await password.boundingBox(), initialPosition);
      assert.equal(
        await password.evaluate((input) =>
          input
            .getAttribute("aria-describedby")
            .split(" ")
            .some((id) => document.getElementById(id)?.getAttribute("role") === "alert"),
        ),
        true,
      );
      await page.getByLabel("Simulate action failures").uncheck();
      if (view === "reset-password") {
        await page.getByLabel("12–16 character password policy").check();
        assert.equal(await password.getAttribute("minlength"), "12");
        assert.equal(await password.getAttribute("maxlength"), "16");
      }
      assert.equal(await password.inputValue(), "new-password-123");
      await button.click();
      if (view === "reset-password") {
        await page
          .getByRole("status")
          .filter({ hasText: "Your password has been reset" })
          .waitFor();
      } else {
        await actionToast(page, "Password changed successfully");
      }
      assert.equal(await page.getByTestId("callback-count").textContent(), "2");
      if (view === "reset-password") {
        assert.equal(await password.count(), 0);
        assert.equal(await requestLink.count(), 0);
        await page.getByRole("link", { name: "Back to sign in", exact: true }).waitFor();
      } else {
        assert.equal(await password.inputValue(), "");
        assert.equal(await password.getAttribute("type"), "password");
        assert.equal(await current.inputValue(), "");
        assert.equal(await current.getAttribute("type"), "password");
      }
    }
    await page.goto(baseURL + "/en/reset-password");
    await page.getByLabel("Service available").uncheck();
    assert.equal(
      await page.getByRole("link", { name: "Request a new link", exact: true }).count(),
      0,
    );
    await page.getByLabel("Service available").check();
    await page.getByLabel("Valid reset link").uncheck();
    await page.getByRole("alert").filter({ hasText: "invalid or has expired" }).waitFor();
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.getByRole("link", { name: "Request a new link", exact: true }).click();
    await page.getByRole("heading", { name: "Forgot your password?", exact: true }).waitFor();
  });

  await test("auth pages support keyboard navigation, SSR, both themes, and narrow screens", async (t) => {
    const page = await preview(t, "/en/login");
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("link", { name: "Forgot password?", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Forgot your password?", exact: true }).waitFor();
    for (const theme of ["Light", "Dark"]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
        await toggle.click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 950 });
        for (const path of ["forgot-password", "reset-password", "access-denied"]) {
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
            await page.screenshot({
              path: `/tmp/forge-${path}-${theme}-${width}.png`,
              fullPage: true,
            });
        }
      }
    }
    assert.deepEqual(errors, []);
  });

  await test("Google and password sign-in share a lock, preserve drafts on failure, and allow retry", async (t) => {
    const page = await preview(t, "/en/login");
    assert.equal(await page.getByRole("button", { name: /GitHub|example provider/ }).count(), 0);
    await page.getByLabel("Email", { exact: true }).fill("person@example.test");
    await page.getByLabel("Password", { exact: true }).fill("retained-password");
    await page.getByLabel("Simulate action failures").check();
    const google = page.getByRole("button", { name: "Continue with Google", exact: true });
    await google.focus();
    await page.keyboard.press("Enter");
    await page.locator("#factory-auth-main-content form").evaluate((form) => form.requestSubmit());
    await page.getByRole("alert").filter({ hasText: "Could not sign in with Google" }).waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "1");
    assert.equal(
      await page.getByLabel("Password", { exact: true }).inputValue(),
      "retained-password",
    );
    await page.getByLabel("Simulate action failures").uncheck();
    await google.click();
    await page
      .getByRole("status")
      .filter({ hasText: "Google sign-in callback received." })
      .waitFor();
    assert.equal(await google.isDisabled(), true);
    assert.equal(
      await page.getByRole("button", { name: "Sign in", exact: true }).isDisabled(),
      true,
    );
    assert.equal(await page.getByTestId("callback-count").textContent(), "2");
    await page.reload();
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.getByLabel("Service available").uncheck();
    assert.equal(await google.isDisabled(), true);
    assert.equal(
      await page.getByRole("button", { name: "Show password", exact: true }).isDisabled(),
      true,
    );
  });

  await test("shared sign-out reports failure, prevents duplicate clicks, and retries", async (t) => {
    const page = await preview(t, "/en/login");
    await page.getByLabel("Simulate action failures").check();
    const signOut = page.getByRole("button", { name: "Sign out", exact: true });
    await signOut.evaluate((button) => {
      button.click();
      button.click();
    });
    await page.getByRole("alert").filter({ hasText: "Could not sign out" }).waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "1");
    await page.getByLabel("Simulate action failures").uncheck();
    await signOut.click();
    await page.getByRole("status").filter({ hasText: "Sign-out callback received." }).waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "2");
    assert.equal(await signOut.isDisabled(), true);
  });
});

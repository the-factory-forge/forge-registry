import assert from "node:assert/strict";
import { test } from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

await test("website visibility saves immediately, preserves account drafts and rolls back failures", async (t) => {
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
  await edit.getByRole("textbox", { name: "Name", exact: true }).fill("Unsaved name");
  await toggle.press("Space");
  await edit.getByRole("button", { name: "Website", pressed: false }).waitFor();
  assert.equal(await toggle.isDisabled(), true);
  await edit
    .getByRole("alert")
    .filter({ hasText: "Could not change website visibility" })
    .waitFor();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(
    await edit.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Unsaved name",
  );
  await row.getByText("Visible on website", { exact: true }).waitFor();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
  await edit.getByRole("textbox", { name: "Name", exact: true }).fill("Unsaved name");
  await toggle.click();
  await actionToast(page, "Website visibility updated.");
  assert.equal(
    await edit.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Unsaved name",
  );
  await row.getByText("Hidden on website", { exact: true }).waitFor();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
  assert.equal(
    await edit.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Alex Morgan",
  );
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await toggle.press("Enter");
  await actionToast(page, "Website visibility updated.");
  await row.getByText("Visible on website", { exact: true }).waitFor();
});

await test("employee pages show content only to administrators", async (t) => {
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
      const toggle = page.shell.getByRole("button", { name: "Dark mode", exact: true });
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
      await page.getByRole("button", { name: "Invite employee", exact: true }).count(),
      0,
    );
  }
  await page.getByLabel("Preview as").selectOption("admin");
  await page.getByRole("button", { name: "Invite employee", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Invite employee", exact: true });
  await dialog.getByRole("textbox", { name: "Email", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Taylor Jordan");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("taylor@example.test");
  assert.equal(await dialog.locator('input[type="password"]').count(), 0);
  await dialog.getByRole("button", { name: "Send invitation", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Invite employee", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("taylor@example.test", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Taylor Jordan", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit employee", exact: true });
  await edit.getByText("Hidden on website", { exact: true }).waitFor();
  await edit.getByRole("textbox", { name: "Name", exact: true }).fill("Taylor Lee");
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  await actionToast(page, "Employee updated.");
  await page
    .getByRole("row")
    .filter({ hasText: "Taylor Lee" })
    .getByText("Hidden on website", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Resend invitation to Taylor Lee", exact: true }).click();
  await actionToast(page, "Invitation sent.");
  assert.deepEqual(errors, []);
});

await test("a delivery failure keeps the account available for resend without repeating creation", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100"}/en/employees`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByLabel("Simulate invitation delivery failure", { exact: true }).check();
  await page.getByRole("button", { name: "Invite employee", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Invite employee", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Pending invitee");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("pending@example.test");
  await dialog.getByRole("button", { name: "Send invitation", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "The account was created" }).waitFor();
  assert.equal(await dialog.locator("form").count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const rows = page.getByRole("row").filter({ hasText: "pending@example.test" });
  assert.equal(await rows.count(), 1);
  await rows
    .getByRole("button", { name: "Resend invitation to Pending invitee", exact: true })
    .click();
  await actionToast(page, "Invitation sent.");
});

await test("employee row actions stay aligned when verification or self-deletion is unavailable", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100"}/en/employees`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const self = page.getByRole("row").filter({ hasText: "Alex Morgan" });
  const other = page.getByRole("row").filter({ hasText: "Sam Rivera" });
  const actions = (row) => row.locator("td:last-child button");
  const selfDelete = self.getByRole("button", { name: "Delete Alex Morgan", exact: true });
  const selfSend = self.getByRole("button", {
    name: "Send verification email to Alex Morgan",
    exact: true,
  });
  const otherDelete = other.getByRole("button", { name: "Delete Sam Rivera", exact: true });
  const neutralAction = page.getByRole("button", { name: /^Delete selected items \(/ });
  const colors = (control) =>
    control.evaluate(async (button) => {
      await Promise.allSettled(button.getAnimations().map((animation) => animation.finished));
      const style = getComputedStyle(button);
      return { color: style.color, background: style.backgroundColor, opacity: style.opacity };
    });
  assert.equal(await selfDelete.isDisabled(), true);
  assert.equal(await selfSend.isDisabled(), true);
  assert.equal(await otherDelete.isEnabled(), true);
  assert.equal(await actions(other).first().isEnabled(), true);
  await selfDelete.evaluate((button) => button.click());
  await selfSend.evaluate((button) => button.click());
  assert.equal(await page.getByRole("dialog").count(), 0);

  for (const dark of [false, true]) {
    const toggle = page.shell.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await selfDelete.scrollIntoViewIfNeeded();
      for (const row of [self, other]) assert.equal(await actions(row).count(), 3);
      const boxes = async (row) =>
        actions(row).evaluateAll((buttons) =>
          buttons.map((button) => {
            const { x, width, height } = button.getBoundingClientRect();
            return { x, width, height };
          }),
        );
      assert.deepEqual(await boxes(self), await boxes(other));
      assert.deepEqual(await colors(selfDelete), await colors(neutralAction));
      assert.deepEqual(await colors(selfSend), await colors(neutralAction));
      assert.notEqual((await colors(otherDelete)).color, (await colors(neutralAction)).color);
      await selfDelete.hover();
      assert.deepEqual(await colors(selfDelete), await colors(neutralAction));
      assert.equal(
        await selfDelete.evaluate((button) => getComputedStyle(button).cursor),
        "not-allowed",
      );
      await self.getByRole("button", { name: "Edit Alex Morgan", exact: true }).hover();
      const tooltip = page.getByRole("tooltip", { name: "Edit Alex Morgan", exact: true });
      await tooltip.waitFor();
      await page.keyboard.press("Escape");
      await tooltip.waitFor({ state: "hidden" });
      await self.locator("td:last-child").scrollIntoViewIfNeeded();
      if (process.env.TEST_CAPTURE_DIR) {
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/employee-actions-${width}-${dark ? "dark" : "light"}.png`,
        });
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Directory state", { exact: true }).selectOption("loading");
  for (const row of [self, other]) {
    assert.equal(await actions(row).count(), 3);
    for (const button of await actions(row).all()) assert.equal(await button.isDisabled(), true);
  }
  await page.getByLabel("Directory state", { exact: true }).selectOption("ready");
  await otherDelete.focus();
  await otherDelete.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Delete employee", exact: true });
  await dialog.waitFor();
  assert.equal(
    await page.getByRole("row", { includeHidden: true }).filter({ hasText: "Sam Rivera" }).count(),
    1,
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await other.waitFor();
  assert.deepEqual(errors, []);
});

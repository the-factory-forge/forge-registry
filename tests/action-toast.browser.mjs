import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

void test("project success toasts preserve layout, focus and repeated saves in both themes", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      t.after(() => context.close());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/en/projects/website`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      if (colorScheme === "dark")
        await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      const button = page.getByRole("button", { name: "Save changes", exact: true });
      const form = page.locator("form");
      const geometry = () =>
        form.evaluate((element) => ({
          top: element.getBoundingClientRect().top + scrollY,
          height: element.getBoundingClientRect().height,
        }));
      await button.scrollIntoViewIfNeeded();
      const before = await geometry();
      await button.click();
      const toast = page.getByRole("dialog", { name: "Project updated.", exact: true });
      await toast.waitFor();
      assert.equal(await toast.count(), 1);
      assert.deepEqual(await geometry(), before);
      assert.equal(await form.getByText("Project updated.", { exact: true }).count(), 0);
      assert.equal(
        await toast.evaluate((element) => element.contains(document.activeElement)),
        false,
      );
      const bounds = await toast.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900);
      await page.screenshot({
        path: `/private/tmp/forge-feedback-task/project-toast-${width}-${colorScheme}.png`,
      });
      await actionToast(page, "Project updated.");
      await button.click();
      await actionToast(page, "Project updated.");
      await page.getByLabel("Simulate action failures").check();
      await button.click();
      await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
      assert.equal(await toast.count(), 0);
      assert.deepEqual(errors, []);
    }
});

void test("toast expiry pauses on hover, nested providers share one queue, and navigation keeps feedback", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/en/projects/website`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const toast = page.getByRole("dialog", { name: "Project updated.", exact: true });
  await toast.hover();
  await page.waitForTimeout(5500);
  assert.equal(await toast.isVisible(), true);
  await page.getByRole("link", { name: "Back to projects", exact: true }).click();
  await page.getByRole("heading", { name: "Projects", exact: true, level: 2 }).waitFor();
  assert.equal(await toast.count(), 1);
  await toast.waitFor({ state: "hidden", timeout: 8000 });
});

void test("toast example is discoverable and failures retain inline recovery", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(baseURL);
  const link = page.getByRole("link").filter({ hasText: "Action toast" });
  await link.waitFor();
  await page.getByRole("button", { name: /^Component/ }).click();
  await link.click();
  await page.getByRole("heading", { name: "Action toast", exact: true }).waitFor();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await actionToast(page, "Project updated.");
  assert.equal(await page.getByRole("alert").count(), 0);
});

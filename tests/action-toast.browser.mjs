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

void test("toast example remains available directly and failures retain inline recovery", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/action-toast`);
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

void test("background toasts share the confirmation frame and keep footer actions right", async (t) => {
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
      await page.goto(`${baseURL}/action-toast`);
      if (colorScheme === "dark")
        await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      const saved = page.getByRole("dialog", { name: "Project updated.", exact: true });
      await saved.waitFor();
      const now = new Date();
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 1000));
      await page.getByRole("button", { name: "Run background action", exact: true }).click();
      const toast = page.getByRole("dialog", { name: "Background action", exact: true });
      await toast.getByText("Working…", { exact: true }).waitFor();
      const original = await toast.elementHandle();
      assert.equal(await toast.getAttribute("data-type"), "loading");
      assert.equal(await toast.getAttribute("aria-busy"), "true");
      assert.ok(
        (await toast.locator("svg").first().getAttribute("class")).includes(
          "text-status-pending-foreground",
        ),
      );
      assert.equal(
        await toast
          .locator("svg")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      assert.equal(
        await toast.getByRole("button", { name: "Dismiss", exact: true }).isDisabled(),
        true,
      );
      const savedHandle = await saved.elementHandle();
      assert.equal(
        await toast.evaluate((el, other) => el.parentElement === other.parentElement, savedHandle),
        true,
      );
      const viewport = await toast.locator("..").boundingBox();
      assert.equal(viewport.y + viewport.height, 900 - (width >= 640 ? 8 : 0));
      const frame = async (locator) =>
        locator.evaluate((el) => {
          const css = getComputedStyle(el);
          return [css.backgroundColor, css.borderRadius, css.padding, css.boxShadow, css.gap];
        });
      assert.deepEqual(await frame(toast), await frame(saved));
      const checkFooter = async (message) => {
        const status = await toast.getByText(message, { exact: true }).boundingBox();
        const action = await toast
          .getByRole("button", { name: "Dismiss", exact: true })
          .boundingBox();
        assert.ok(status.x + status.width <= action.x);
        assert.ok(status.y < action.y + action.height && action.y < status.y + status.height);
        const bounds = await toast.boundingBox();
        assert.equal(
          action.x + action.width,
          bounds.x + bounds.width - 12 - (colorScheme === "dark" ? 1 : 0),
        );
      };
      await checkFooter("Working…");
      await toast.screenshot({
        path: `/private/tmp/unified-toast-loading-${width}-${colorScheme}.png`,
      });
      await page.clock.runFor(1000);
      await toast.getByText("Completed", { exact: true }).waitFor();
      assert.equal(await toast.evaluate((el, before) => el === before, original), true);
      assert.equal(await toast.getAttribute("data-type"), "success");
      assert.ok(
        (await toast.locator("svg").first().getAttribute("class")).includes(
          "text-status-success-foreground",
        ),
      );
      await checkFooter("Completed");
      await toast.screenshot({
        path: `/private/tmp/unified-toast-success-${width}-${colorScheme}.png`,
      });
      await toast.getByRole("button", { name: "Dismiss", exact: true }).click();
      await page.clock.runFor(500);
      await toast.waitFor({ state: "hidden" });
      await page.getByLabel("Simulate action failures").check();
      await page.getByRole("button", { name: "Run background action", exact: true }).click();
      await page.clock.runFor(1000);
      await toast.getByText("The action failed. Please try again.", { exact: true }).waitFor();
      assert.equal(await toast.getAttribute("data-type"), "error");
      await checkFooter("The action failed. Please try again.");
      await toast.screenshot({
        path: `/private/tmp/unified-toast-error-${width}-${colorScheme}.png`,
      });
      await page.clock.runFor(6000);
      assert.equal(await toast.isVisible(), true);
      await toast.getByRole("button", { name: "Dismiss", exact: true }).click();
      await page.clock.runFor(500);
      await toast.waitFor({ state: "hidden" });
      assert.deepEqual(errors, []);
    }
});

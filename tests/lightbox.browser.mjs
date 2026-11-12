import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

void test("lightbox traps focus, preserves image clicks and restores focus after dismissal", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/lightbox`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const trigger = page.getByRole("button", { name: "Click to enlarge : Forge logo" });
  const dialog = page.getByRole("dialog", { name: "Forge logo", exact: true });
  const image = trigger.getByRole("img", { name: "Forge logo" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.hover();
  assert.deepEqual(
    await image.evaluate((node) => ({
      scale: getComputedStyle(node).scale,
      transition: getComputedStyle(node).transitionDuration,
    })),
    { scale: "none", transition: "0s" },
    "Reduced motion must disable the hover zoom, not just the transform property",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    (node) => Number.parseFloat(getComputedStyle(node).scale) > 1.04,
    await image.elementHandle(),
  );
  await page.mouse.move(0, 0);
  for (const [width, dark] of [
    [1440, false],
    [320, true],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    const theme = page.shell.getByRole("button", { name: "Dark mode", exact: true });
    if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
    await trigger.focus();
    await trigger.press("Enter");
    await dialog.waitFor();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await close.focus();
    for (const key of ["Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      await close.and(page.locator(":focus")).waitFor();
    }
    await dialog.getByRole("img", { name: "Forge logo" }).click();
    assert.equal(await dialog.isVisible(), true);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `/tmp/forge-lightbox-${width}.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
    await trigger.click();
    await close.click();
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
    await trigger.click();
    await dialog.waitFor();
    await page.mouse.click(2, 2);
    await dialog.waitFor({ state: "hidden" });
    await trigger.and(page.locator(":focus")).waitFor();
  }
  const placeholder = page.getByRole("figure", { name: "Missing photo" });
  assert.match(await placeholder.textContent(), /Photo coming soon/);
  assert.deepEqual(errors, []);
});

void test("collection keeps navigation usable across touch, keyboard and image failures", async (t) => {
  const page = await browser.newPage({ hasTouch: true, viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  await page.goto(`${baseURL}/lightbox`);
  const trigger = page.getByRole("button", { name: "Click to enlarge : Second collection image" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("img", { name: "Second collection image" }).waitFor();
  assert.equal(await dialog.locator("output").textContent(), "2 / 3");
  assert.equal(await dialog.getByText("Second image in the example.").isVisible(), true);
  await page.keyboard.press("ArrowRight");
  await dialog.getByText("This image could not be loaded.").waitFor();
  await dialog.getByRole("button", { name: "Next image" }).click();
  const first = dialog.getByRole("img", { name: "First collection image" });
  await first.waitFor();
  const bounds = await first.boundingBox();
  assert.ok(bounds && bounds.width > 72);
  const touch = await page.context().newCDPSession(page);
  const point = { x: bounds.x + bounds.width * 0.8, y: bounds.y + bounds.height / 2 };
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, x: point.x - 68 }],
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await dialog.getByRole("img", { name: "Second collection image" }).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await trigger.and(page.locator(":focus")).waitFor();
});

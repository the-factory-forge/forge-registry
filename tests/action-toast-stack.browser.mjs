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

void test("toast stacks expand with mouse, touch and keyboard and keep every action reachable", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
        reducedMotion: "reduce",
      });
      t.after(() => context.close());
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const activate = (locator) => (width === 390 ? locator.tap() : locator.click());
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/action-toast`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      if (colorScheme === "dark")
        await activate(page.getByRole("button", { name: "Dark mode", exact: true }));
      await activate(page.getByLabel("Simulate action failures"));
      const create = page.getByRole("button", { name: "Run background action", exact: true });
      const toasts = page.getByRole("dialog", { name: "Background action", exact: true });
      for (let i = 0; i < 3; i++) {
        await activate(create);
        await toasts
          .first()
          .getByText("The action failed. Please try again.", { exact: true })
          .waitFor();
      }
      const viewport = toasts.first().locator("..");
      const boxes = await toasts.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      );
      assert.equal(boxes.length, 3);
      assert.ok(boxes[1].width < boxes[0].width && boxes[2].width < boxes[1].width);
      assert.ok(boxes[2].y < boxes[1].y && boxes[1].y < boxes[0].y);
      assert.ok(boxes[0].y - boxes[2].y < boxes[0].height, "Older cards overlap behind the newest");
      assert.ok(boxes.every((box) => box.x >= 0 && box.x + box.width <= width));
      await page.screenshot({
        path: `/private/tmp/forge-toast-stack-task/collapsed-${width}-${colorScheme}.png`,
      });
      if (width === 390) await toasts.first().getByText("Background action", { exact: true }).tap();
      else await toasts.first().hover();
      assert.notEqual(await viewport.getAttribute("data-expanded"), null);
      const expanded = await toasts.evaluateAll((elements) =>
        elements.map((el) => ({
          top: el.getBoundingClientRect().top,
          bottom: el.getBoundingClientRect().bottom,
        })),
      );
      assert.ok(expanded[1].bottom + 7 <= expanded[0].top);
      assert.ok(expanded[2].bottom + 7 <= expanded[1].top);
      await page.screenshot({
        path: `/private/tmp/forge-toast-stack-task/expanded-${width}-${colorScheme}.png`,
      });
      const middle = await toasts.nth(1).elementHandle();
      await activate(toasts.nth(1).getByRole("button", { name: "Dismiss", exact: true }));
      await middle.waitForElementState("hidden");
      assert.equal(await toasts.count(), 2);
      await create.focus();
      await page.mouse.move(0, 0);
      await page.keyboard.press("F6");
      assert.notEqual(await viewport.getAttribute("data-expanded"), null);
      await page.keyboard.press("Tab");
      assert.equal(await viewport.evaluate((el) => el.contains(document.activeElement)), true);
      const front = await toasts.first().elementHandle();
      await page.keyboard.press("Escape");
      await front.waitForElementState("hidden");
      assert.equal(await toasts.count(), 1);
      await create.focus();
      for (let i = 0; i < 8; i++) {
        await activate(create);
        await toasts
          .first()
          .getByText("The action failed. Please try again.", { exact: true })
          .waitFor();
      }
      await page.keyboard.press("F6");
      assert.equal(
        await toasts.count(),
        9,
        "Persistent failures must not be dropped by a count limit",
      );
      assert.equal(await viewport.evaluate((el) => el.scrollHeight > el.clientHeight), true);
      const oldest = await toasts.last().elementHandle();
      await activate(toasts.last().getByRole("button", { name: "Dismiss", exact: true }));
      await oldest.waitForElementState("hidden");
      assert.equal(await toasts.count(), 8, "Even the oldest recovery action is reachable");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
    }
});

void test("toasts animate entry, stacking, expansion, collapse and dismissal with shadcn timing", async (t) => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  t.after(() => page.close());
  await page.goto(`${baseURL}/action-toast`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByLabel("Simulate action failures").check();
  const create = page.getByRole("button", { name: "Run background action", exact: true });
  const toasts = page.getByRole("dialog", { name: "Background action", exact: true });
  const sampleMotion = (toast) =>
    toast.evaluate(async (element) => {
      const animation = element
        .getAnimations()
        .find((item) => item.transitionProperty === "transform");
      const timing = animation?.effect.getTiming();
      const frames = [];
      const start = performance.now();
      while (performance.now() - start < 600) {
        const { x, y, width } = element.getBoundingClientRect();
        frames.push({ x, y, width });
        await new Promise(requestAnimationFrame);
      }
      return { timing, frames };
    });
  await create.click();
  await toasts.first().waitFor();
  const entering = await sampleMotion(toasts.first());
  assert.equal(entering.timing?.duration, 500);
  assert.equal(entering.timing?.easing, "cubic-bezier(0.22, 1, 0.36, 1)");
  assert.ok(
    entering.frames.some((frame) => frame.y > entering.frames.at(-1).y + 3),
    "New toast slides up into place",
  );
  await toasts.first().getByText("The action failed. Please try again.", { exact: true }).waitFor();
  await create.click();
  const stacking = await sampleMotion(toasts.last());
  assert.ok(
    stacking.frames.some((frame) => frame.width > stacking.frames.at(-1).width + 1),
    "Older toast scales back smoothly",
  );
  await toasts.first().getByText("The action failed. Please try again.", { exact: true }).waitFor();
  const collapsed = await toasts.last().boundingBox();
  await toasts.first().hover();
  const expanding = await sampleMotion(toasts.last());
  const expanded = expanding.frames.at(-1);
  assert.ok(
    expanding.frames.some((frame) => frame.y < collapsed.y - 2 && frame.y > expanded.y + 2),
    "Stack fans open through intermediate positions",
  );
  assert.equal(await toasts.last().evaluate((el) => getComputedStyle(el).position), "absolute");
  await page.mouse.move(0, 0);
  const collapsing = await sampleMotion(toasts.last());
  assert.ok(
    collapsing.frames.some((frame) => frame.y > expanded.y + 2 && frame.y < collapsed.y - 2),
    "Stack closes smoothly",
  );
  const closing = await toasts.first().elementHandle();
  await toasts.first().getByRole("button", { name: "Close", exact: true }).click();
  const exit = await sampleMotion(closing);
  assert.equal(exit.timing?.duration, 500);
  assert.ok(
    exit.frames.some((frame) => frame.y > exit.frames[0].y + 3),
    "Dismissed toast slides out",
  );
  await closing.waitForElementState("hidden");
  const swiped = await toasts.first().elementHandle();
  const swipeBounds = await toasts.first().boundingBox();
  await page.mouse.move(swipeBounds.x + 60, swipeBounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(swipeBounds.x + 180, swipeBounds.y + 20, { steps: 5 });
  await page.mouse.up();
  assert.equal(await swiped.getAttribute("data-swipe-direction"), "right");
  const swipe = await sampleMotion(swiped);
  assert.ok(
    swipe.frames.some((frame) => frame.x > swipe.frames[0].x + 3),
    "Swipe dismissal continues in the gesture direction",
  );
  await swiped.waitForElementState("hidden");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await create.click();
  await toasts.first().waitFor();
  assert.equal(
    await toasts.first().evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
});

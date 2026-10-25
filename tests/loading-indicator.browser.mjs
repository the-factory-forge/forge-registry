import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";
let server, browser, base;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
async function fixture(t, options = {}) {
  const page = await browser.newPage(options);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/loading-indicator.html`);
  await page.getByRole("button", { name: "Refresh", exact: true }).waitFor();
  return page;
}
void test("nested providers share one indicator and fast success retains feedback without shifting content", async (t) => {
  const page = await fixture(t, { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const main = await page.locator("main").boundingBox();
  const button = page.getByRole("button", { name: "Fast refresh", exact: true });
  await button.click();
  await page.getByText("Fast success", { exact: true }).waitFor();
  const bar = page.getByRole("progressbar", { name: "Chargement…" });
  assert.equal(await bar.count(), 1);
  assert.equal((await bar.locator("..").boundingBox()).y, 56);
  assert.equal(
    await bar.locator("..").evaluate((el) => getComputedStyle(el).pointerEvents),
    "none",
  );
  assert.equal(
    await bar
      .locator("..")
      .locator("div")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.deepEqual(await page.locator("main").boundingBox(), main);
  assert.equal(await button.evaluate((el) => el === document.activeElement), true);
  await bar.waitFor({ state: "hidden" });
});
void test("overlap, failure and unmount release the shared indicator", async (t) => {
  const page = await fixture(t);
  const button = page.getByRole("button", { name: "Refresh", exact: true });
  const bar = page.getByRole("progressbar");
  await button.click();
  await button.click();
  await bar.waitFor();
  await page.evaluate(() => window.loadingRequests[0].resolve());
  await page.waitForTimeout(350);
  assert.equal(await bar.isVisible(), true);
  await page.evaluate(() => window.loadingRequests[1].reject());
  await page.getByText("Failure", { exact: true }).waitFor();
  assert.equal(await bar.isVisible(), true);
  await bar.waitFor({ state: "hidden" });
  await button.click();
  await bar.waitFor();
  await page.getByRole("button", { name: "Toggle source" }).click();
  await bar.waitFor({ state: "hidden" });
  await page.evaluate(() => window.loadingRequests[2].resolve());
  assert.equal(await bar.count(), 0);
  await page.getByRole("button", { name: "Toggle source" }).click();
  await page.getByRole("button", { name: "Toggle loading" }).click();
  await bar.waitFor();
  await page.getByRole("button", { name: "Toggle source" }).click();
  await bar.waitFor({ state: "hidden" });
});

void test("the loader grows from a fixed left edge and fills before hiding", async (t) => {
  for (const width of [1440, 390]) {
    const page = await fixture(t, {
      viewport: { width, height: 844 },
      reducedMotion: "no-preference",
    });
    await page.getByRole("button", { name: "Toggle loading", exact: true }).click();
    const bar = page.locator('[data-slot="loading-indicator"] > div');
    const motion = await bar.evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = 250;
      const start = el.getBoundingClientRect().toJSON();
      animation.currentTime = 4000;
      const middle = el.getBoundingClientRect().toJSON();
      animation.finish();
      return { start, middle, end: el.getBoundingClientRect().toJSON() };
    });
    assert.equal(motion.start.x, 0);
    assert.equal(motion.middle.x, 0);
    assert.ok(motion.middle.width > motion.start.width);
    assert.ok(motion.end.width < width);
    await page.screenshot({ path: `/tmp/forge-loading-fill-${width}.png` });
    await page.clock.install();
    await page.getByRole("button", { name: "Toggle loading", exact: true }).click();
    assert.equal(await bar.locator("..").getAttribute("data-state"), "complete");
    const completion = await bar.evaluate((el) => {
      const animation = el.getAnimations()[0];
      const duration = animation.effect.getTiming().duration;
      animation.finish();
      return { duration, ...el.getBoundingClientRect().toJSON() };
    });
    assert.equal(completion.x, 0);
    assert.equal(completion.width, (await bar.locator("..").boundingBox()).width);
    assert.equal(completion.duration, 300);
    await page.clock.runFor(299);
    assert.equal(await bar.isVisible(), true);
    await page.clock.runFor(1);
    await bar.waitFor({ state: "hidden" });
  }
});

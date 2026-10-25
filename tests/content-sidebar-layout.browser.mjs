import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}/content-sidebar-layout`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
  return page;
}

async function scroll(page, top) {
  await page.evaluate(async (top) => {
    window.scrollTo(0, top);
    await new Promise(requestAnimationFrame);
  }, top);
}

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    void test(`content sidebar preserves fields and keeps long panels reachable at ${width}px in ${theme}`, async (t) => {
      const page = await preview(t, width);
      if (theme === "dark")
        await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      const trigger = page.getByRole("button", { name: "Details", exact: true });
      const panel = page.getByRole("complementary", { name: "Project details", exact: true });
      const content = page.getByRole("region", { name: "Project brief", exact: true });
      const overview = page.getByRole("textbox", { name: "Overview", exact: true });
      await overview.fill("Keep this working draft");
      const expandedWidth = (await content.boundingBox()).width;
      await trigger.click();
      await panel.waitFor({ state: "hidden" });
      assert.equal(await overview.inputValue(), "Keep this working draft");
      if (width >= 1024) assert.ok((await content.boundingBox()).width > expandedWidth);
      await trigger.click();
      await panel.waitFor();
      assert.equal(await overview.inputValue(), "Keep this working draft");
      await page.getByRole("checkbox", { name: "Long panel", exact: true }).check();
      await scroll(page, width >= 1024 ? 500 : 0);
      const viewport = panel.locator("..");
      const metrics = await viewport.evaluate((element) => ({
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
      }));
      if (width >= 1024) {
        assert.equal((await trigger.boundingBox()).y, 72);
        assert.ok(metrics.bottom <= 884);
        assert.ok(metrics.scrollHeight > metrics.height);
        await panel.getByRole("checkbox").last().focus();
        const last = await panel.getByRole("checkbox").last().boundingBox();
        assert.ok(last.y >= metrics.top && last.y + last.height <= metrics.bottom);
        assert.equal((await trigger.boundingBox()).y, 72);
      } else {
        assert.equal(metrics.scrollHeight, metrics.height);
        assert.ok((await panel.boundingBox()).y < (await content.boundingBox()).y);
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: `/tmp/content-sidebar-layout-${width}-${theme}.png` });
      if (width < 1024) {
        await scroll(page, 800);
        assert.ok((await trigger.boundingBox()).y < 0, "Mobile toolbar stays in page flow");
      }
    });
  }
}

void test("layout is discoverable under All and Layout and opens its example", async (t) => {
  const page = await preview(t);
  await page.goto(base);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const link = page
    .getByRole("region", { name: "Examples", exact: true })
    .locator('a[href="/content-sidebar-layout"]');
  await link.waitFor();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await link.click();
  await page.getByRole("heading", { name: "Content sidebar layout", exact: true }).waitFor();
});

void test("layout can stick without the host header offset", async (t) => {
  const page = await preview(t);
  await page.locator(".showroom-frame").evaluate((element) => {
    element.style.setProperty("--intranet-top-offset", "0rem");
  });
  await scroll(page, 700);
  assert.equal(
    (await page.getByRole("button", { name: "Details", exact: true }).boundingBox()).y,
    16,
  );
});

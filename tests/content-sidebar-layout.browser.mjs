import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

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
        await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
      const trigger = page.getByRole("button", { name: "Details", exact: true });
      const panel = page.getByRole("complementary", { name: "Project details", exact: true });
      const content = page.getByRole("region", { name: "Project brief", exact: true });
      const overview = page.getByRole("textbox", { name: "Overview", exact: true });
      if (width >= 1024) {
        const panelBox = await panel.boundingBox();
        const contentBox = await content.boundingBox();
        const triggerBox = await trigger.boundingBox();
        assert.equal(panelBox.y, contentBox.y);
        assert.ok(triggerBox.y + triggerBox.height < panelBox.y);
      }
      const expandedTriggerWidth = (await trigger.boundingBox()).width;
      await overview.fill("Keep this working draft");
      const expandedWidth = (await content.boundingBox()).width;
      await trigger.click();
      await panel.waitFor({ state: "hidden" });
      const collapsedTrigger = await trigger.boundingBox();
      const collapsedSize = width >= 768 ? 32 : 40;
      assert.equal(collapsedTrigger.width, collapsedSize);
      assert.equal(collapsedTrigger.height, collapsedSize);
      assert.ok(collapsedTrigger.width < expandedTriggerWidth);
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
      assert.equal(await overview.inputValue(), "Keep this working draft");
      if (width >= 1024) assert.ok((await content.boundingBox()).width > expandedWidth);
      await trigger.click();
      await panel.waitFor();
      assert.equal(await overview.inputValue(), "Keep this working draft");
      await page.getByRole("checkbox", { name: "Long panel", exact: true }).check();
      await scroll(page, width >= 1024 ? 500 : 0);
      const metrics = await panel.evaluate((element) => ({
        height: element.clientHeight,
        borderTop: element.clientTop,
        scrollHeight: element.scrollHeight,
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
      }));
      const review = panel.getByRole("heading", { name: "Ready for review", exact: true });
      const handover = panel.getByRole("heading", { name: "Ready for handover", exact: true });
      const stickyTop = width >= 1024 ? metrics.top + metrics.borderTop : 56;
      const scrollChecklist = async (distance) => {
        if (width >= 1024) {
          await panel.evaluate(async (element, top) => {
            element.scrollTop = top;
            await new Promise(requestAnimationFrame);
          }, distance);
        } else {
          await scroll(page, distance);
        }
      };
      const reviewStart = (await review.boundingBox()).y - stickyTop;
      const handoverStart = (await handover.boundingBox()).y - stickyTop;
      await scrollChecklist(reviewStart + 80);
      assert.equal((await review.boundingBox()).y, stickyTop);
      await scrollChecklist(handoverStart + 40);
      assert.equal((await handover.boundingBox()).y, stickyTop);
      const previousHeading = await review.boundingBox();
      assert.ok(previousHeading.y + previousHeading.height <= stickyTop);
      if (width >= 1024) {
        assert.equal((await trigger.boundingBox()).y, 72);
        assert.ok(metrics.bottom <= 884);
        assert.ok(metrics.scrollHeight > metrics.height);
        assert.ok(metrics.borderTop > 0);
        assert.ok(await panel.evaluate((element) => element.scrollTop > 0));
        assert.equal((await panel.boundingBox()).y, metrics.top);
        await panel.getByRole("checkbox").last().focus();
        const last = await panel
          .getByRole("checkbox")
          .last()
          .evaluate((element) => {
            const { y, height } = element.getBoundingClientRect();
            return { y, height };
          });
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

void test("Details shows its tooltip only while the button is icon-only", async (t) => {
  const page = await preview(t);
  const details = page.getByRole("button", { name: "Details", exact: true });
  const tooltip = page.getByRole("tooltip", { name: "Details", exact: true });

  await details.click();
  await page.mouse.move(0, 0);
  await details.hover();
  await tooltip.waitFor();
  await details.press("Escape");
  await tooltip.waitFor({ state: "hidden" });
  await page.mouse.move(0, 0);
  await details.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await tooltip.waitFor();

  await page.keyboard.press("Enter");
  await tooltip.waitFor({ state: "hidden" });
  assert.equal(await details.getAttribute("aria-expanded"), "true");
  assert.ok(await details.evaluate((button) => button === document.activeElement));
  await page.clock.install();
  await details.hover();
  await page.clock.runFor(1000);
  assert.equal(await tooltip.count(), 0);
  await page.mouse.move(0, 0);
  await details.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.clock.runFor(1000);
  assert.equal(await tooltip.count(), 0);
});

void test("sidebar choices survive re-entry and remain scoped to their plugin", async (t) => {
  const page = await preview(t);
  const details = page.getByRole("button", { name: "Details", exact: true });
  const actions = page.getByRole("button", { name: "Actions", exact: true });
  const history = page.getByRole("button", { name: "History", exact: true });
  const article = base + "/en/admin/blogs/b1000000-0000-4000-8000-000000000001";
  const offer = base + "/en/offers/studio";
  const expectOpen = (toggle, open) =>
    toggle.and(page.locator(`[aria-expanded="${open}"]`)).waitFor();

  await details.click();
  await page.goto(offer);
  await expectOpen(actions, true);
  await actions.click();
  await page.goto(article);
  await expectOpen(history, false);
  await history.click();
  await page.waitForURL((url) => url.searchParams.get("history") === "true");
  await page.goBack();
  await expectOpen(history, false);
  await page.goForward();
  await expectOpen(history, true);

  await page.goto(offer);
  await expectOpen(actions, false);
  await actions.click();
  await page.reload();
  await expectOpen(actions, true);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("forge:offers:detail:actions")),
    "open",
  );

  await page.goto(article);
  await expectOpen(history, true);
  await page.goto(article + "?history=false");
  await expectOpen(history, false);
  await page.goto(article);
  await expectOpen(history, true);
  await page.getByRole("button", { name: "Close history", exact: true }).click();
  await expectOpen(history, false);
  await page.goto(base + "/content-sidebar-layout");
  await expectOpen(details, false);
  await page.goto(article);
  await expectOpen(history, false);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("forge:blogs:editor:history")),
    "closed",
  );
});

void test("Details falls back to its default with invalid storage and remains usable with storage blocked", async (t) => {
  const page = await preview(t);
  const details = page.getByRole("button", { name: "Details", exact: true });
  await page.evaluate(() =>
    localStorage.setItem("forge:showroom:content-sidebar-layout:details", "invalid"),
  );
  await page.reload();
  assert.equal(await details.getAttribute("aria-expanded"), "true");
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.reload();
  await details.click();
  assert.equal(await details.getAttribute("aria-expanded"), "false");
  await details.click();
  assert.equal(await details.getAttribute("aria-expanded"), "true");
});

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
    await page
      .getByRole("button", { name: "Details", exact: true })
      .evaluate((element) => element.getBoundingClientRect().top),
    16,
  );
});

void test("layout keeps className sizing when composed inside a flex row", async (t) => {
  const page = await preview(t);
  const container = page.locator('[class~="@container/content-sidebar"]');
  await container.evaluate((element) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;width:900px";
    const sibling = document.createElement("div");
    sibling.style.cssText = "width:200px;flex-shrink:0";
    element.before(row);
    row.append(element, sibling);
  });
  assert.equal((await container.boundingBox()).width, 700);
  assert.ok(
    (await page.getByRole("textbox", { name: "Overview", exact: true }).boundingBox()).width > 600,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

void test("combined table demo supports discovery, search, pagination and stable request states", async (t) => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const card = page.locator('main a[href="/table-pagination"]');
  assert.equal(await card.count(), 1);
  assert.equal(await card.getByRole("heading", { name: "Table", exact: true }).count(), 1);
  assert.equal(await page.locator('main a[href="/table-search"]').count(), 0);
  const directorySearch = page.getByRole("searchbox", { name: "Search examples" });
  for (const category of ["All", "Component"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    for (const query of ["table", "pagination"]) {
      await directorySearch.fill(query);
      assert.equal(await page.locator("main a h2").count(), 1);
      assert.equal(await card.count(), 1);
    }
  }
  await card.click();
  const nav = page.getByRole("navigation", { name: "Blog post pages", exact: true });
  const previous = nav.getByRole("button", { name: "Previous page" });
  const next = nav.getByRole("button", { name: "Next page" });
  const geometry = () =>
    nav.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x: x + scrollX, y: y + scrollY, width, height };
    });
  await nav.waitFor();
  assert.equal(await previous.isDisabled(), true);
  await next.focus();
  await page.keyboard.press("Enter");
  assert.match(await nav.innerText(), /2\/3/);
  await next.click();
  assert.match(await nav.innerText(), /3\/3/);
  assert.equal(await next.isDisabled(), true);
  await previous.click();
  assert.match(await nav.innerText(), /2\/3/);
  const posts = page.getByRole("region", { name: "Blog posts", exact: true });
  await posts.getByRole("button", { name: "Search blog posts", exact: true }).click();
  const search = posts.getByRole("searchbox", { name: "Search blog posts" });
  await search.fill("idea");
  assert.match(await nav.innerText(), /2 posts[\s\S]*1\/1/);
  assert.equal(await posts.getByRole("row").count(), 3);
  assert.equal(await previous.isDisabled(), true);
  assert.equal(await next.isDisabled(), true);
  await search.fill("no matching post");
  await posts.getByText("No matches.", { exact: true }).waitFor();
  assert.match(await nav.innerText(), /0 posts[\s\S]*1\/1/);
  await posts.getByRole("button", { name: "Clear search blog posts" }).click();
  assert.match(await nav.innerText(), /7 posts[\s\S]*1\/3/);
  assert.equal(await posts.getByRole("row").count(), 4);
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  await next.click();
  assert.match(await nav.innerText(), /2\/3/);
  const cursor = page.getByRole("navigation", { name: "File batches" });
  await cursor.getByRole("button", { name: "Next page" }).click();
  await cursor.getByRole("button", { name: "Next page" }).click();
  assert.equal(await cursor.getByRole("button", { name: "Next page" }).isDisabled(), true);
  assert.equal(await cursor.locator("[aria-live]").innerText(), "3");
  await cursor.getByRole("button", { name: "Previous page" }).click();
  assert.equal(await cursor.locator("[aria-live]").innerText(), "2");
  await cursor.getByRole("button", { name: "Previous page" }).click();
  assert.equal(await cursor.getByRole("button", { name: "Previous page" }).isDisabled(), true);
  for (const dark of [false, true]) {
    const theme = page.shell.getByRole("button", { name: "Dark mode", exact: true });
    if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByLabel("Table state", { exact: true }).selectOption("ready");
      await nav.getByText("1/3", { exact: true }).waitFor();
      await posts.evaluate((element) =>
        Promise.allSettled(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        ),
      );
      const ready = await geometry();
      const scroll = posts.getByRole("region", { name: "Scrollable blog posts" });
      const actions = posts.locator("tr > :last-child");
      const bounds = () =>
        actions.evaluateAll((cells) =>
          cells.map((cell) => {
            const box = cell.getBoundingClientRect();
            const container = cell.closest("table").parentElement.getBoundingClientRect();
            return {
              x: box.x,
              right: box.right,
              edge: container.right,
              position: getComputedStyle(cell).position,
            };
          }),
        );
      await scroll.evaluate((element) => {
        element.scrollLeft = 0;
      });
      const before = await bounds();
      await scroll.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const after = await bounds();
      for (let index = 0; index < after.length; index++) {
        assert.equal(after[index].position, "sticky");
        assert.ok(Math.abs(after[index].x - before[index].x) <= 1);
        assert.ok(Math.abs(after[index].right - after[index].edge) <= 1);
      }
      if (width === 320) assert.ok(await scroll.evaluate((element) => element.scrollLeft > 0));
      for (const state of ["loading", "error"]) {
        await page.getByLabel("Table state", { exact: true }).selectOption(state);
        await posts
          .getByText(
            state === "loading" ? "Loading posts…" : "Could not load posts. Select Ready to retry.",
            { exact: true },
          )
          .waitFor();
        assert.deepEqual(await geometry(), ready);
        assert.equal(await next.isDisabled(), true);
        assert.equal(await previous.isDisabled(), true);
        assert.equal(
          await posts
            .getByRole("button", { name: /^Edit / })
            .first()
            .isDisabled(),
          true,
        );
      }
      await page.getByLabel("Table state", { exact: true }).selectOption("empty");
      assert.match(await nav.innerText(), /0 posts[\s\S]*1\/1/);
      assert.equal(await next.isDisabled(), true);
      assert.equal(await previous.isDisabled(), true);
      assert.equal(
        await next.evaluate((element) => element.getBoundingClientRect().height),
        width < 768 ? 40 : 32,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.getByLabel("Table state", { exact: true }).selectOption("ready");
      await posts.getByRole("button", { name: "Search blog posts", exact: true }).click();
      await search.fill("idea");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await search.press("Escape");
      await posts.evaluate((element) =>
        Promise.allSettled(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        ),
      );
      await page.screenshot({
        path: `/private/tmp/table-pagination-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
});

void test("post actions preserve confirmation, validation and the last-page boundary; URL restores navigation", async (t) => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${baseURL}/table-pagination?postPage=2&cursor=1`);
  const nav = page.getByRole("navigation", { name: "Blog post pages", exact: true });
  await nav.getByText("2/3", { exact: true }).waitFor();
  await nav.getByRole("button", { name: "Next page" }).click();
  await nav.getByText("3/3", { exact: true }).waitFor();
  await page.goBack();
  await nav.getByText("2/3", { exact: true }).waitFor();
  await page.goForward();
  await page.reload();
  await nav.getByText("3/3", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("navigation", { name: "File batches" }).locator("[aria-live]").innerText(),
    "2",
  );
  await page.getByRole("button", { name: "Edit Small improvements", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const title = dialog.getByLabel("Title");
  await title.fill("   ");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await dialog.getByRole("alert").waitFor();
  await title.fill("A better table");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  const edit = page.getByRole("button", { name: "Edit A better table", exact: true });
  await edit.waitFor();
  await nav.getByRole("button", { name: "Previous page" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.getByRole("tooltip", { name: "Edit A better table", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  const remove = page.getByRole("button", { name: "Delete A better table", exact: true });
  await remove.click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await remove.count(), 1);
  await remove.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await nav.getByText("2/2", { exact: true }).waitFor();
  assert.equal(await nav.getByRole("button", { name: "Next page" }).isDisabled(), true);
  assert.equal(await remove.count(), 0);
  await page.goto(`${baseURL}/table-pagination?postPage=invalid&cursor=-1&q=123`);
  await nav.getByText("1/3", { exact: true }).waitFor();
});

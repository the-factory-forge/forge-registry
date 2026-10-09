import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

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
  assert.equal(await card.getByRole("heading", { name: "Table search & pagination" }).count(), 1);
  assert.equal(await page.locator('main a[href="/table-search"]').count(), 0);
  const directorySearch = page.getByRole("searchbox", { name: "Search examples" });
  for (const category of ["All", "Component"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    for (const query of ["table search", "pagination"]) {
      await directorySearch.fill(query);
      assert.equal(await page.locator("main a h2").count(), 1);
      assert.equal(await card.count(), 1);
    }
  }
  await card.click();
  const nav = page.getByRole("navigation", { name: "Blog post pages", exact: true });
  const previous = nav.getByRole("button", { name: "Previous page" });
  const next = nav.getByRole("button", { name: "Next page" });
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
    const theme = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByLabel("Table state", { exact: true }).selectOption("ready");
      const ready = await nav.boundingBox();
      for (const state of ["loading", "error"]) {
        await page.getByLabel("Table state", { exact: true }).selectOption(state);
        assert.deepEqual(await nav.boundingBox(), ready);
        assert.equal(await next.isDisabled(), true);
        assert.equal(await previous.isDisabled(), true);
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
      await page.screenshot({
        path: `/private/tmp/table-pagination-${dark ? "dark" : "light"}-${width}.png`,
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
});

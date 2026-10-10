import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const plugins = [
  {
    route: "/en/admin/blogs",
    control: "Directory state",
    search: "Search posts",
    pagination: true,
  },
  {
    route: "/en/employees",
    control: "Directory state",
    search: "Search employees",
    pagination: true,
  },
  { route: "/en/customers", control: "Directory state", search: "Search customers" },
  { route: "/en/projects", control: "Directory state", search: "Search projects" },
  { route: "/en/admin/menus", control: "Directory state", search: "Search menu items" },
];

void test("plugin tables retain headers, loaded rows and paging through loading, empty and error states", async (t) => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const plugin of plugins) {
    await page.goto(baseURL + plugin.route);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const table = page.locator("main table").first();
    const state = page.getByLabel(plugin.control);
    await table.locator("tbody tr").first().waitFor();
    await page.waitForFunction(
      () => document.querySelector("main table")?.getAttribute("aria-busy") !== "true",
    );
    const headers = await table.getByRole("columnheader").allTextContents();
    const rows = await table.locator("tbody tr").allTextContents();
    const tableHandle = await table.elementHandle();
    assert.ok(headers.length >= 3);
    for (const dark of [false, true]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const headerY = (await table.locator("thead").boundingBox()).y;
        await state.selectOption("loading");
        await page.locator('main table[aria-busy="true"]').waitFor();
        assert.deepEqual(await table.locator("tbody tr").allTextContents(), rows, plugin.route);
        assert.equal((await table.locator("thead").boundingBox()).y, headerY);
        const mutations = table.getByRole("button", {
          name: /Delete|Remove|Send verification|Reorder/,
        });
        for (const button of await mutations.all())
          assert.equal(await button.isDisabled(), true, plugin.route);
        if (plugin.pagination)
          assert.equal(await page.locator("main nav button:not(:disabled)").count(), 0);
        await state.selectOption("error");
        await table.getByRole("alert").first().waitFor();
        assert.deepEqual(await table.getByRole("columnheader").allTextContents(), headers);
        assert.equal((await table.locator("thead").boundingBox()).y, headerY);
        await state.selectOption("ready");
        await table.getByRole("alert").waitFor({ state: "hidden" });
        await page.waitForFunction(
          () => document.querySelector("main table")?.getAttribute("aria-busy") !== "true",
        );
        await page.getByRole("button", { name: plugin.search, exact: true }).click();
        const search = page.getByRole("searchbox", { name: plugin.search, exact: true });
        await search.fill("no-matching-record-123");
        assert.deepEqual(await table.getByRole("columnheader").allTextContents(), headers);
        assert.equal(await table.locator("tbody tr").count(), 1, plugin.route);
        assert.equal(await table.locator("tbody td[colspan]").count(), 1);
        assert.equal(await tableHandle.evaluate((node) => node.isConnected), true);
        await state.selectOption("loading");
        await page.locator('main table[aria-busy="true"]').waitFor();
        assert.equal(await table.locator("tbody tr").count(), 1);
        assert.match(await table.locator("tbody").innerText(), /Loading/);
        assert.deepEqual(await table.getByRole("columnheader").allTextContents(), headers);
        await state.selectOption("ready");
        await page.waitForFunction(
          () => document.querySelector("main table")?.getAttribute("aria-busy") !== "true",
        );
        if (plugin.pagination)
          assert.equal(
            await page
              .locator("main nav")
              .filter({ has: page.getByRole("button", { name: "Next", exact: true }) })
              .count(),
            1,
          );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (plugin.route === "/en/admin/blogs")
          await page.screenshot({
            path: `/private/tmp/persistent-blogs-${dark ? "dark" : "light"}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
        await search.fill("");
        await search.press("Escape");
      }
    }
    if (plugin.route === "/en/employees") {
      await page.getByLabel("Preview as").selectOption("user");
      assert.equal(await page.locator("main table").count(), 0);
    }
    if (plugin.route === "/en/admin/menus") {
      await state.selectOption("empty");
      await page.waitForFunction(
        () => document.querySelector("main table")?.getAttribute("aria-busy") !== "true",
      );
      assert.equal(await table.locator("tbody tr").count(), 1);
      assert.match(await table.innerText(), /No menu items/);
      await state.selectOption("error");
      await table.getByRole("button", { name: "Retry", exact: true }).click();
      await table.getByRole("alert").waitFor();
      assert.equal(await tableHandle.evaluate((node) => node.isConnected), true);
    }
  }
  assert.deepEqual(errors, []);
});

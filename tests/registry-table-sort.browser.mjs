import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

for (const [path, selected, field, label, fallback] of [
  ["/en/customers", "customers", "email", "Email", "Customer"],
  ["/en/projects", "projects", "status", "Status", "Name"],
  ["/en/customers/sam/projects", "projects", "status", "Status", "Name"],
  ["/en/employees", "employees", "email", "Email", "Name"],
  ["/en/admin/blogs", "blog", "title", "Title", "Updated"],
  ["/en/admin/menus/items", "menuItems", "name", "Name", "Display order"],
  ["/en/account?tab=security", "keys", "name", "Name", undefined],
  ["/en/drive", "spaces", "size", "Size", "Name"],
  ["/en/drive/project/portal", "files", "size", "Size", "Name"],
  ["/en/drive/project/portal?trash=true", "trash", "name", "Name", "Deleted"],
]) {
  void test(`column sort, reset and browser history in ${path}`, async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    page.setDefaultTimeout(7000);
    const url = new URL(path, base);
    url.searchParams.set("keep", "notes");
    if (selected === "blog") url.searchParams.set("blogPage", "2");
    url.hash = "list";
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    const table = page
      .getByRole("table")
      .filter({ has: page.getByRole("columnheader", { name: label, exact: true }) })
      .first();
    const button = table.getByRole("button", { name: label, exact: true });
    const sortedButton = (direction) =>
      table
        .locator(`th[aria-sort="${direction}"]`)
        .getByRole("button", { name: label, exact: true });
    const header = table.getByRole("columnheader", { name: label, exact: true });
    if (selected === "customers") {
      const arrow = button.locator("svg");
      assert.equal(await arrow.evaluate((icon) => getComputedStyle(icon).opacity), "0");
      await button.hover();
      assert.equal(await arrow.evaluate((icon) => getComputedStyle(icon).opacity), "1");
      await page.mouse.move(0, 0);
    }
    await button.focus();
    await button.press("Enter");
    await page.waitForURL((url) => url.searchParams.get(selected + "Sort") === field + ".asc");
    await sortedButton("ascending").waitFor();
    assert.equal(await header.getAttribute("aria-sort"), "ascending");
    if (selected === "blog") {
      assert.equal(new URL(page.url()).searchParams.has("blogPage"), false);
      const titles = await table.locator("tbody tr a").filter({ hasText: /./ }).allTextContents();
      assert.ok(titles.length > 1);
      assert.deepEqual(
        titles,
        [...titles].sort((a, b) => a.localeCompare(b)),
      );
    }
    if (selected === "menuItems")
      assert.equal(
        await table
          .getByRole("button", { name: /^Reorder item:/ })
          .first()
          .getAttribute("aria-disabled"),
        "true",
      );
    await button.click();
    await page.waitForURL((url) => url.searchParams.get(selected + "Sort") === field + ".desc");
    await page.reload({ waitUntil: "domcontentloaded" });
    await sortedButton("descending").waitFor();
    assert.equal(await header.getAttribute("aria-sort"), "descending");
    await button.click();
    await page.waitForURL((url) => !url.searchParams.has(selected + "Sort"));
    if (fallback) assert.equal(await table.locator("th[aria-sort]").innerText(), fallback);
    else assert.equal(await table.locator("th[aria-sort]").count(), 0);
    assert.equal(new URL(page.url()).searchParams.get("keep"), "notes");
    assert.equal(new URL(page.url()).hash, "#list");
    await page.goBack();
    await sortedButton("descending").waitFor();
    assert.equal(await header.getAttribute("aria-sort"), "descending");
    await page.goForward();
    await table
      .locator("th:not([aria-sort])")
      .getByRole("button", { name: label, exact: true })
      .waitFor();
    assert.equal(await header.getAttribute("aria-sort"), null);
  });
}

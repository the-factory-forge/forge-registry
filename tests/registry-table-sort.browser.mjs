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
  void test(`column sort, saved preference and browser history in ${path}`, async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
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
    if (fallback) assert.equal(await table.locator("th[aria-sort]").innerText(), fallback);
    else assert.equal(await table.locator("th[aria-sort]").count(), 0);
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
    await page.waitForURL((url) => url.searchParams.get(selected + "Sort") === field + ".asc");
    await sortedButton("ascending").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("keep"), "notes");
    assert.equal(new URL(page.url()).hash, "#list");
    await page.goBack();
    await sortedButton("descending").waitFor();
    assert.equal(await header.getAttribute("aria-sort"), "descending");
    await page.goForward();
    await sortedButton("ascending").waitFor();

    const reopened = await context.newPage();
    await reopened.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
    const saved = reopened
      .locator('th[aria-sort="ascending"]')
      .getByRole("button", { name: label, exact: true });
    await saved.waitFor();
    await saved.press("Enter");
    await reopened
      .locator('th[aria-sort="descending"]')
      .getByRole("button", { name: label, exact: true })
      .waitFor();
    await reopened.close();
  });
}

void test("tables on the same page remember independent choices and respect explicit links", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  const url = new URL("/table-search", base);
  const employees = page.getByRole("region", { name: "Employees", exact: true });
  const projects = page.getByRole("region", { name: "Projects", exact: true });
  const details = employees.getByRole("button", { name: "Details", exact: true });
  const name = projects.getByRole("button", { name: "Name", exact: true });
  await page.goto(url.href);
  await details.click();
  await name.click();
  await page.waitForURL(
    (value) =>
      value.searchParams.get("employeesSort") === "details.asc" &&
      value.searchParams.get("projectsSort") === "name.desc",
  );
  await page.goto(url.href);
  await page.waitForURL(
    (value) =>
      value.searchParams.get("employeesSort") === "details.asc" &&
      value.searchParams.get("projectsSort") === "name.desc",
  );
  assert.equal(await employees.locator('th[aria-sort="ascending"]').innerText(), "Details");
  assert.equal(await projects.locator('th[aria-sort="descending"]').innerText(), "Name");
  url.searchParams.set("employeesSort", "name.desc");
  await page.goto(url.href);
  await employees
    .locator('th[aria-sort="descending"]')
    .getByRole("button", { name: "Name" })
    .waitFor();
  await projects
    .locator('th[aria-sort="descending"]')
    .getByRole("button", { name: "Name" })
    .waitFor();
  url.search = "";
  await page.goto(url.href);
  await employees
    .locator('th[aria-sort="ascending"]')
    .getByRole("button", { name: "Details" })
    .waitFor();
});

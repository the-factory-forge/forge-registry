import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
async function preview(t, path) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  t.after(() => page.close());
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).waitFor();
  return page;
}
const bulk = (page) => page.getByRole("button", { name: /^Delete selected items \(/ });
const dialog = (page) => page.getByRole("dialog", { name: "Delete selected items?", exact: true });
const row = (page, name) => page.getByRole("row").filter({ hasText: name });

void test("selection locks during loading and clears when deletion permission or sorting changes", async (t) => {
  const page = await preview(t, "/en/projects");
  const all = page.getByRole("checkbox", { name: "Select all rows", exact: true });
  await all.check();
  await page.getByLabel("Directory state").selectOption("loading");
  assert.equal(await all.isDisabled(), true);
  assert.equal(await bulk(page).isDisabled(), true);
  await page.getByLabel("Directory state").selectOption("ready");
  await page.getByLabel("Account actions", { exact: true }).uncheck();
  assert.equal(await all.count(), 0);
  assert.equal(await bulk(page).count(), 0);
  await page.getByLabel("Account actions", { exact: true }).check();
  assert.equal(await all.isChecked(), false);
  assert.equal(await bulk(page).isDisabled(), true);
  const drive = await preview(t, "/en/drive/project/portal");
  await drive.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await drive.getByRole("button", { name: "Size", exact: true }).click();
  await bulk(drive).and(drive.locator(":disabled")).waitFor();
});

void test("project bulk deletion keeps the project whose Drive still contains files", async (t) => {
  const page = await preview(t, "/en/projects");
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await bulk(page).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(await dialog(page).getByRole("listitem").textContent(), "Customer portal");
  await row(page, "Studio website").waitFor({ state: "hidden" });
});

void test("failed Blog batches roll back and retry with stable IDs and disabled pending controls", async (t) => {
  const page = await preview(t, "/en/admin/blogs");
  await page.evaluate(() => {
    const original = crypto.randomUUID.bind(crypto);
    window.generatedRequestIds = [];
    crypto.randomUUID = () => {
      const id = original();
      window.generatedRequestIds.push(id);
      return id;
    };
  });
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await bulk(page).click();
  const ids = await page.evaluate(() => [...window.generatedRequestIds]);
  assert(ids.length >= 2);
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  assert.equal(
    await dialog(page).getByRole("button", { name: "Cancel", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("table", { includeHidden: true })
      .getByRole("checkbox", { name: "Select all rows", exact: true, includeHidden: true })
      .isDisabled(),
    true,
  );
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("table", { includeHidden: true })
      .locator("tbody tr:not([hidden])")
      .count(),
    ids.length,
  );
  // The host recovers while the confirmation remains open.
  await page
    .getByLabel("Simulate action failures", { exact: true })
    .evaluate((input) => input.click());
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.generatedRequestIds), ids);
});

void test("Drive preparation errors block deletion and allow a fresh preview retry", async (t) => {
  const page = await preview(t, "/en/drive/project/portal");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await row(page, "Design brief.txt").getByRole("checkbox").check();
  await bulk(page).click();
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(
    await dialog(page).getByRole("button", { name: "Move to trash", exact: true }).count(),
    0,
  );
  await page
    .getByLabel("Simulate action failures", { exact: true })
    .evaluate((input) => input.click());
  await dialog(page).getByRole("button", { name: "Try again", exact: true }).click();
  await dialog(page)
    .getByText(/Move Design brief.txt, including/)
    .waitFor();
  await dialog(page).getByRole("button", { name: "Move to trash", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  await row(page, "Design brief.txt").waitFor({ state: "hidden" });
});

for (const path of [
  "/en/customers",
  "/en/projects",
  "/en/admin/blogs",
  "/en/admin/menus",
  "/en/drive/project/portal",
]) {
  void test(`${path}: mixed selection, select all/none, keyboard, confirmation and stable layout`, async (t) => {
    const page = await preview(t, path);
    const all = page.getByRole("checkbox", { name: "Select all rows", exact: true });
    const rows = page.getByRole("table").locator('tbody input[type="checkbox"]:enabled');
    assert((await rows.count()) >= 2);
    for (const width of [1440, 390])
      for (const dark of [false, true]) {
        await page.setViewportSize({ width, height: 1000 });
        const theme = page.getByRole("button", { name: "Dark mode", exact: true });
        if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
        await page.waitForFunction(
          (dark) => document.documentElement.classList.contains("dark") === dark,
          dark,
        );
        await all.uncheck();
        assert.equal(await bulk(page).isVisible(), true);
        assert.equal(await bulk(page).isDisabled(), true);
        const colors = (element) => {
          const style = getComputedStyle(element);
          return [
            style.color,
            style.backgroundColor,
            style.borderColor,
            style.opacity,
            style.cursor,
          ];
        };
        const disabledColors = await bulk(page).evaluate(colors);
        if (path === "/en/admin/blogs" || path === "/en/drive/project/portal") {
          const previous = page.getByRole("button", { name: /^Previous( page)?$/ });
          await previous.evaluate((button) =>
            Promise.all(button.getAnimations().map((animation) => animation.finished)),
          );
          assert.deepEqual(disabledColors, await previous.evaluate(colors));
        }
        await bulk(page).hover();
        assert.deepEqual(await bulk(page).evaluate(colors), disabledColors);
        await bulk(page).evaluate((button) => button.click());
        assert.equal(await dialog(page).count(), 0);
        if (process.env.TEST_CAPTURE_DIR)
          await page.screenshot({
            path: `${process.env.TEST_CAPTURE_DIR}/${path.replaceAll("/", "-")}-${width}-${dark ? "dark" : "light"}-disabled.png`,
          });
        const top = await page
          .getByRole("table")
          .evaluate((el) => el.getBoundingClientRect().top + scrollY);
        await rows.first().focus();
        await page.keyboard.press("Space");
        assert.equal(await all.evaluate((el) => el.indeterminate), true);
        await bulk(page).focus();
        await bulk(page).press("Tab");
        await page.keyboard.press("Shift+Tab");
        await page
          .getByRole("tooltip", { name: "Delete selected items (1)", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await all.click();
        assert.equal(await all.isChecked(), true);
        assert.equal(await all.evaluate((el) => el.indeterminate), false);
        assert.equal(
          await page.getByRole("table").evaluate((el) => el.getBoundingClientRect().top + scrollY),
          top,
        );
        if (process.env.TEST_CAPTURE_DIR)
          await page.screenshot({
            path: `${process.env.TEST_CAPTURE_DIR}/${path.replaceAll("/", "-")}-${width}-${dark ? "dark" : "light"}-table.png`,
          });
        await bulk(page).click();
        await dialog(page).waitFor();
        assert.equal(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth), true);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (process.env.TEST_CAPTURE_DIR)
          await page.screenshot({
            path: `${process.env.TEST_CAPTURE_DIR}/${path.replaceAll("/", "-")}-${width}-${dark ? "dark" : "light"}.png`,
          });
        // Drive must finish preparing previews before cancel becomes available.
        await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog(page).waitFor({ state: "hidden" });
        assert.equal(await all.isChecked(), true);
        await all.click();
        assert.equal(await bulk(page).isDisabled(), true);
      }
  });
}

void test("customer partial failure retains only protected rows and never repeats successful deletion", async (t) => {
  const page = await preview(t, "/en/customers");
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await bulk(page).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).dblclick();
  await dialog(page).getByRole("alert").waitFor();
  await row(page, "Sam Rivera").waitFor({ state: "hidden" });
  assert.equal(await dialog(page).getByRole("listitem").count(), 1);
  assert.match(await dialog(page).getByRole("listitem").textContent(), /Acme Studio/);
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await dialog(page).getByRole("alert").waitFor();
  assert.equal(await dialog(page).getByRole("listitem").count(), 1);
  await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await row(page, "Acme Studio").getByRole("checkbox").isChecked(), true);
  await page.getByRole("button", { name: "Search customers", exact: true }).click();
  await page.getByRole("searchbox").fill("Acme");
  await bulk(page).and(page.locator(":disabled")).waitFor();
});

void test("blogs delete every selected row and clear selection", async (t) => {
  for (const path of ["/en/admin/blogs"]) {
    const page = await preview(t, path);
    await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
    await bulk(page).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await dialog(page).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("table").locator('tbody input[type="checkbox"]').count(), 0);
    assert.equal(await bulk(page).isDisabled(), true);
  }
});

void test("employee bulk deletion protects the signed-in administrator and respects role changes", async (t) => {
  const page = await preview(t, "/en/employees");
  assert.equal(await row(page, "Alex Morgan").getByRole("checkbox").isDisabled(), true);
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  assert.equal(await row(page, "Alex Morgan").getByRole("checkbox").isChecked(), false);
  await bulk(page).click();
  assert.equal(await dialog(page).getByRole("listitem").textContent(), "Sam Rivera");
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  await row(page, "Sam Rivera").waitFor({ state: "hidden" });
  await row(page, "Alex Morgan").waitFor();
  assert.equal(
    await page.getByRole("checkbox", { name: "Select all rows", exact: true }).isDisabled(),
    true,
  );
  await page.getByLabel("Preview as").selectOption("user");
  await page.getByRole("table").waitFor({ state: "hidden" });
  await page.getByLabel("Preview as").selectOption("admin");
  assert.equal(await bulk(page).isDisabled(), true);
});

void test("menu bulk deletion preserves items with linked Drive files", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await bulk(page).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await dialog(page).getByRole("alert").filter({ hasText: "Drive files" }).waitFor();
  assert.equal(await dialog(page).getByRole("listitem").textContent(), "Burrata with tomatoes");
  await row(page, "House pasta").waitFor({ state: "hidden" });
  await row(page, "Homemade lemonade").waitFor({ state: "hidden" });
});

void test("Drive bulk deletion previews each row, supports trash Undo and permanent deletion", async (t) => {
  const page = await preview(t, "/en/drive/project/portal");
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  const count = await page
    .getByRole("table")
    .locator('tbody input[type="checkbox"]:checked')
    .count();
  await bulk(page).click();
  await dialog(page)
    .getByText(/Move Design brief.txt, including/)
    .waitFor();
  assert.equal(await dialog(page).getByRole("listitem").count(), count * 2);
  await dialog(page).getByRole("button", { name: "Move to trash", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await page.getByText("Files and folders restored.", { exact: true }).waitFor();
  await page.getByRole("table").locator('tbody input[type="checkbox"]').waitFor();
  await page
    .getByRole("navigation", { name: "Drive navigation", exact: true })
    .getByRole("button", { name: "Trash", exact: true })
    .click();
  const trash = page.getByRole("table", { name: "Trash", exact: true });
  await page.getByRole("button", { name: "Interrupt next deletion", exact: true }).click();
  await trash.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
  await bulk(page).click();
  await dialog(page)
    .getByText(/Permanently delete .*including/)
    .first()
    .waitFor();
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog(page).getByRole("alert").filter({ hasText: "Deletion is incomplete" }).waitFor();
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  await trash.locator('tbody input[type="checkbox"]').waitFor({ state: "hidden" });
});

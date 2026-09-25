import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, path) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

test("homepage links, public visibility, sold out labels, language fallback, and themes", async (t) => {
  const page = await preview(t, "/");
  await page.getByRole("searchbox", { name: "Search examples" }).fill("menu item editor");
  assert.equal(await page.locator("main section a[href]").count(), 1);
  await page.getByRole("searchbox", { name: "Search examples" }).fill("");
  await page.getByRole("button", { name: "Plugin", exact: true }).click();
  await page.getByRole("link", { name: /Menus Translated restaurant menu/ }).click();
  await page.getByRole("heading", { name: "Burrata with tomatoes" }).waitFor();
  await page.getByRole("link", { name: "Manage menu" }).click();
  await page.getByRole("heading", { name: "Menu items" }).waitFor();
  await page.getByRole("link", { name: "Public menu" }).click();
  await page.getByRole("heading", { name: "Burrata with tomatoes" }).waitFor();
  await page.getByText("Sold out", { exact: true }).waitFor();
  assert.equal(await page.getByText("Homemade lemonade").count(), 0);
  await page.getByRole("link", { name: "French menu" }).click();
  await page.getByRole("heading", { name: "Burrata aux tomates" }).waitFor();
  await page.getByRole("heading", { name: "House pasta" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test("staff creates, edits, and publishes an item; failure retains the draft", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.getByRole("link", { name: "New item" }).click();
  const frenchTab = page.getByRole("tab", { name: "Français" });
  await frenchTab.click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Soupe de saison");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Enter a name in the base language." }).waitFor();
  assert.equal(
    await page.getByRole("tab", { name: "English" }).getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("textbox", { name: "Name *" }).fill("Seasonal soup");
  await page.getByRole("textbox", { name: "Description" }).fill("A changing selection.");
  await frenchTab.focus();
  await page.keyboard.press("Enter");
  assert.equal(await frenchTab.getAttribute("aria-selected"), "true");
  assert.equal(
    await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Soupe de saison",
  );
  await frenchTab.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("textbox", { name: "Name *" }).inputValue(), "Seasonal soup");
  await frenchTab.click();
  assert.equal(
    await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Soupe de saison",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Edit item" }).waitFor();
  await page.getByLabel("Visible on menu").check();
  await page.getByText("Fail mutations").locator("input").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Name *" }).inputValue(), "Seasonal soup");
  await page.getByText("Fail mutations").locator("input").uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu" }).click();
  await page.getByRole("heading", { name: "Seasonal soup" }).waitFor();
  await page.getByRole("link", { name: "French menu" }).click();
  await page.getByRole("heading", { name: "Soupe de saison" }).waitFor();
});

test("staff taxonomy and nested photo folders work with keyboard navigation on mobile", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("link", { name: "Categories / Labels" }).click();
  const addLabel = page.getByRole("button", { name: "New label" });
  await addLabel.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New label" });
  await dialog.getByRole("textbox", { name: "Name (English) *" }).fill("Vegan");
  await dialog.getByRole("combobox", { name: "Label type" }).selectOption("dietary");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Vegan (dietary)").waitFor();
  await page.getByRole("link", { name: "Back to items" }).click();
  await page.getByRole("link", { name: "Edit item: Burrata with tomatoes" }).click();
  await page.getByRole("button", { name: "New folder" }).click();
  const folderDialog = page.getByRole("dialog", { name: "New folder" });
  await folderDialog.getByRole("textbox", { name: "Name" }).fill("Photos");
  await folderDialog.getByRole("button", { name: "Create" }).click();
  await folderDialog.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Photos", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Photos", exact: true })
    .waitFor();
  assert.match(page.url(), /\?folder=/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

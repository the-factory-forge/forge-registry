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
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test("category tabs scroll, track sections, translate, and follow dish filters", async (t) => {
  const page = await preview(t, "/en/menus");
  await page.setViewportSize({ width: 390, height: 480 });
  const navigation = page.getByRole("navigation", { name: "Categories", exact: true });
  assert.deepEqual(await navigation.getByRole("link").allTextContents(), [
    "Starters",
    "Main courses",
  ]);
  const main = navigation.getByRole("link", { name: "Main courses", exact: true });
  await main.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Categories"] a[aria-current="location"]')
        ?.textContent === "Main courses",
  );
  assert.match(await main.getAttribute("href"), /^#factory-/);
  assert.equal(await page.locator("article").count(), 2);
  assert.equal(
    await navigation.evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    56,
  );
  assert.equal(
    await page
      .getByRole("region", { name: "Main courses", exact: true })
      .evaluate((element) => element.getBoundingClientRect().top >= 112),
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Categories"] a[aria-current="location"]')
        ?.textContent === "Starters",
  );
  await page.getByRole("checkbox", { name: "Milk", exact: true }).check();
  assert.deepEqual(await navigation.getByRole("link").allTextContents(), ["Main courses"]);
  await page.getByRole("checkbox", { name: "Gluten", exact: true }).check();
  assert.equal(await navigation.count(), 0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await navigation.getByRole("link").count(), 2);
  await page.getByRole("link", { name: "French menu" }).click();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  const french = page.getByRole("navigation", { name: "Catégories", exact: true });
  assert.deepEqual(await french.getByRole("link").allTextContents(), [
    "Entrées",
    "Plats principaux",
  ]);
  await french.getByRole("link", { name: "Plats principaux" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('nav[aria-label="Catégories"] a[aria-current="location"]')
        ?.textContent === "Plats principaux",
  );
  assert.equal(await page.locator("article").count(), 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("link", { name: "Manage menu" }).click();
  await page.getByRole("link", { name: "Categories / Labels" }).click();
  await page
    .getByRole("listitem")
    .filter({ has: page.getByText("Main courses", { exact: true }) })
    .getByRole("button", { name: "Edit category", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit category", exact: true });
  const categoryName = "Tapas, soupes et plats végétariens de saison";
  await editor.getByRole("textbox", { name: "Name (Français)", exact: true }).fill(categoryName);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Public menu" }).click();
  assert.equal(await french.getByRole("link", { name: categoryName, exact: true }).count(), 1);
  await page.waitForFunction(() => window.scrollY === 0);
  assert.equal(
    await french.evaluate(async (element) => {
      if (element.scrollWidth <= element.clientWidth) return false;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      element.scrollLeft = element.scrollWidth;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return element.scrollLeft > 0;
    }),
    true,
    await french.evaluate((element) =>
      JSON.stringify({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: element.scrollLeft,
        tabs: element.textContent,
      }),
    ),
  );
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
  await page
    .getByRole("tabpanel", { name: "English", exact: true })
    .getByRole("textbox", { name: "Description" })
    .fill("A changing selection.");
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

test("public allergen and dietary filters combine, clear, and translate on mobile", async (t) => {
  const page = await preview(t, "/en/menus");
  const allergens = page.getByRole("group", { name: "Exclude allergens" });
  const dietary = page.getByRole("group", { name: "Dietary", exact: true });
  const clear = page.getByRole("button", { name: "Clear filters" });
  assert.equal(await clear.isDisabled(), true);
  assert.equal(await allergens.getByRole("checkbox").count(), 2);
  assert.equal(await dietary.getByRole("checkbox").count(), 2);
  assert.deepEqual(await allergens.locator("label").allTextContents(), ["Gluten", "Milk"]);
  assert.deepEqual(await dietary.locator("label").allTextContents(), ["Vegan", "Vegetarian"]);
  assert.equal(
    await allergens.getByRole("checkbox", { name: "Crustaceans", exact: true }).count(),
    0,
  );
  assert.equal(await dietary.getByRole("checkbox", { name: "Halal", exact: true }).count(), 0);
  assert.equal(await dietary.getByRole("checkbox", { name: "Spicy", exact: true }).count(), 0);
  const burrata = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Burrata with tomatoes" }) });
  const pasta = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "House pasta" }) });
  assert.match(
    await burrata
      .getByRole("list", { name: "Allergens" })
      .locator("span")
      .first()
      .getAttribute("class"),
    /bg-status-info/,
  );
  assert.match(
    await burrata
      .getByRole("list", { name: "Dietary" })
      .locator("span")
      .first()
      .getAttribute("class"),
    /bg-status-success/,
  );
  assert.match(
    await pasta
      .getByRole("list", { name: "Allergens" })
      .locator("span")
      .first()
      .getAttribute("class"),
    /bg-status-pending/,
  );
  assert.equal(await burrata.locator('svg[aria-hidden="true"]').count(), 2);
  assert.equal(
    await pasta.getByText("Spicy", { exact: true }).locator("..").locator("svg").count(),
    2,
  );
  const milk = allergens.getByRole("checkbox", { name: "Milk", exact: true });
  await milk.focus();
  await page.keyboard.press("Space");
  assert.equal(await page.getByRole("heading", { name: "Burrata with tomatoes" }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Starters", exact: true }).count(), 0);
  await page.getByRole("heading", { name: "House pasta" }).waitFor();
  await page.getByText("Sold out", { exact: true }).waitFor();
  await allergens.getByRole("checkbox", { name: "Gluten", exact: true }).check();
  await page.getByRole("status").filter({ hasText: "No dishes match these filters." }).waitFor();
  assert.equal(await page.locator("article").count(), 0);
  assert.equal(await allergens.getByRole("checkbox").count(), 2);
  await clear.click();
  await page.getByRole("heading", { name: "Burrata with tomatoes" }).waitFor();
  await dietary.getByRole("checkbox", { name: "Vegetarian", exact: true }).check();
  assert.equal(await page.locator("article").count(), 2);
  await dietary.getByRole("checkbox", { name: "Vegan", exact: true }).check();
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("heading", { name: "House pasta" }).waitFor();
  await allergens.getByRole("checkbox", { name: "Gluten", exact: true }).check();
  await page.getByRole("status").filter({ hasText: "No dishes match these filters." }).waitFor();
  await clear.click();
  assert.equal(await page.locator("article").count(), 2);
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 0);
  await page.getByRole("link", { name: "French menu" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page
    .getByRole("group", { name: "Exclure les allergènes" })
    .getByRole("checkbox", { name: "Lait", exact: true })
    .check();
  await page
    .getByRole("group", { name: "Régimes alimentaires", exact: true })
    .getByRole("checkbox", { name: "Végétalien", exact: true })
    .check();
  await page.getByRole("heading", { name: "House pasta" }).waitFor();
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("button", { name: "Effacer les filtres" }).click();
  await page.getByRole("heading", { name: "Burrata aux tomates" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(
    await page
      .getByRole("group", { name: "Exclure les allergènes", exact: true })
      .locator("label")
      .allTextContents(),
    ["Gluten", "Lait"],
  );
  assert.deepEqual(
    await page
      .getByRole("group", { name: "Régimes alimentaires", exact: true })
      .locator("label")
      .allTextContents(),
    ["Végétalien", "Végétarien"],
  );
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
  const editorLabels = page.getByRole("group", { name: "Labels", exact: true });
  assert.equal(await editorLabels.getByRole("checkbox").count(), 19);
  await editorLabels.getByRole("checkbox", { name: "Pescatarian", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  const pescatarian = page
    .getByRole("group", { name: "Régimes alimentaires", exact: true })
    .getByRole("checkbox", { name: "Pescétarien", exact: true });
  await pescatarian.check();
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
  await editorLabels.getByRole("checkbox", { name: "Pescatarian", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
  assert.equal(await pescatarian.count(), 0);
});

test("staff reorders rows by dragging and keyboard, with persistence and failed-save recovery", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
  assert.equal(
    await page.getByRole("spinbutton", { name: "Display order", exact: true }).count(),
    0,
  );
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Starters" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  const names = () => page.locator("tbody tr td:first-child").allTextContents();
  const burrata = page.getByRole("button", {
    name: "Reorder item: Burrata with tomatoes",
    exact: true,
  });
  await burrata.waitFor();
  const start = await burrata.boundingBox();
  const end = await page
    .getByRole("button", { name: "Reorder item: Homemade lemonade", exact: true })
    .boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  assert.deepEqual(await names(), ["House pasta", "Homemade lemonade", "Burrata with tomatoes"]);
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
  assert.deepEqual(await page.locator("article h3").allTextContents(), [
    "House pasta",
    "Burrata with tomatoes",
  ]);
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await burrata.waitFor();
  assert.deepEqual(await names(), ["House pasta", "Homemade lemonade", "Burrata with tomatoes"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await burrata.press("ArrowUp");
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
  await page.getByRole("checkbox", { name: "Fail mutations", exact: true }).check();
  await burrata.press("ArrowUp");
  await page.getByRole("alert").filter({ hasText: "The change could not be saved." }).waitFor();
  assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
  await page.getByRole("checkbox", { name: "Fail mutations", exact: true }).uncheck();
  await page.getByRole("button", { name: "Search menu items", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search menu items", exact: true }).fill("Burrata");
  assert.equal(await burrata.getAttribute("aria-disabled"), "true");
  await burrata.press("ArrowUp");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
  await burrata.press("ArrowUp");
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  assert.deepEqual(await names(), ["Burrata with tomatoes", "House pasta", "Homemade lemonade"]);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await burrata.scrollIntoViewIfNeeded();
  const touchStart = await burrata.boundingBox();
  const touchEnd = await page
    .getByRole("button", { name: "Reorder item: House pasta", exact: true })
    .boundingBox();
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchStart.x + 16, y: touchStart.y + 16 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchEnd.x + 16, y: touchEnd.y + 16 }],
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
  await touch.detach();
  await page.getByRole("link", { name: "New item", exact: true }).click();
  assert.equal(
    await page.getByRole("spinbutton", { name: "Display order", exact: true }).count(),
    0,
  );
});

test("staff sets independent spice levels with one, two or three flames and can clear them", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [level, text] of [
    [1, "Mildly spicy"],
    [2, "Spicy"],
    [3, "Extremely spicy"],
  ]) {
    await page.getByRole("link", { name: "Edit item: House pasta" }).click();
    const spices = page.getByRole("group", { name: "Spice level", exact: true });
    assert.equal(await spices.getByRole("radio").count(), 4);
    await spices.getByRole("radio", { name: text, exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    const pasta = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "House pasta" }) });
    await pasta.getByText(text, { exact: true }).waitFor();
    assert.equal(
      await pasta.getByText(text, { exact: true }).locator("..").locator("svg").count(),
      level,
    );
    assert.equal(
      await page
        .getByRole("group", { name: "Dietary", exact: true })
        .getByRole("checkbox", { name: "Spicy", exact: true })
        .count(),
      0,
    );
    await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  }
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  await page.getByRole("link", { name: "French menu", exact: true }).click();
  await page.getByText("Extrêmement épicé", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Extrêmement épicé", { exact: true }).locator("..").locator("svg").count(),
    3,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await page.getByRole("link", { name: "Edit item: House pasta" }).click();
  assert.equal(
    await page.getByRole("radio", { name: "Extremely spicy", exact: true }).isChecked(),
    true,
  );
  await page.getByRole("radio", { name: "Not spicy", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
  assert.equal(await page.getByText("Extrêmement épicé", { exact: true }).count(), 0);
});

test("staff saves translated size prices and guests select sizes with keyboard controls", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "New item", exact: true }).click();
  await page.getByRole("textbox", { name: "Name *", exact: true }).fill("Margherita pizza");
  await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("22.00");
  await page.getByRole("button", { name: "Add size", exact: true }).click();
  await page.getByRole("button", { name: "Add size", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).count(), 0);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await page.getByRole("textbox", { name: "Size name (fr) 1", exact: true }).fill("Petite · 30 cm");
  await page
    .getByRole("textbox", { name: "Size name (fr) 2", exact: true })
    .fill("Familiale · 40 cm");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Enter every size name in the base language." })
    .waitFor();
  assert.equal(
    await page.getByRole("tab", { name: "English", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("textbox", { name: "Size name (en) 1", exact: true }).fill("Small · 30 cm");
  await page.getByRole("textbox", { name: "Size name (en) 2", exact: true }).fill("Family · 40 cm");
  await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("28.005");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The change could not be saved." }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
    "28.005",
  );
  await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("28.00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Edit item", exact: true }).waitFor();
  await page.getByRole("checkbox", { name: "Visible on menu", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  const pizza = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Margherita pizza", exact: true }) });
  const sizeGroup = pizza.getByRole("group", { name: "Sizes", exact: true });
  const small = sizeGroup.getByRole("radio", { name: /Small · 30 cm/ });
  const large = sizeGroup.getByRole("radio", { name: /Family · 40 cm/ });
  await small.waitFor();
  assert.equal(await small.isChecked(), true);
  assert.match(
    await pizza.getByRole("status", { name: "Price", exact: true }).textContent(),
    /22\.00/,
  );
  await small.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await large.isChecked(), true);
  assert.match(
    await pizza.getByRole("status", { name: "Price", exact: true }).textContent(),
    /28\.00/,
  );
  const burrata = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Burrata with tomatoes", exact: true }) });
  assert.equal(await burrata.getByRole("radio").count(), 0);
  await page.getByRole("checkbox", { name: "Milk", exact: true }).check();
  assert.equal(await large.isChecked(), true);
  await page.getByRole("link", { name: "French menu", exact: true }).click();
  await pizza
    .getByRole("group", { name: "Tailles", exact: true })
    .getByRole("radio", { name: /Familiale · 40 cm/ })
    .check();
  assert.match(
    await pizza.getByRole("status", { name: "Prix", exact: true }).textContent(),
    /28,00/,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await page.getByRole("link", { name: "Edit item: Margherita pizza", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
    "28.00",
  );
  await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("29.00");
  await page.getByText("Fail mutations").locator("input").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
    "29.00",
  );
  await page.getByText("Fail mutations").locator("input").uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  for (const name of ["Small · 30 cm", "Family · 40 cm"]) {
    await page.getByRole("button", { name: `Remove size: ${name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Remove size: ${name}`, exact: true });
    await dialog.getByRole("button", { name: "Confirm deletion", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("24.00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  await pizza.getByRole("heading", { name: "Margherita pizza", exact: true }).waitFor();
  assert.equal(await pizza.getByRole("group").count(), 0);
  assert.match(
    await pizza.getByRole("status", { name: "Prix", exact: true }).textContent(),
    /24,00/,
  );
});

test("staff taxonomy and nested photo folders work with keyboard navigation on mobile", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("link", { name: "Categories / Labels" }).click();
  const addLabel = page.getByRole("button", { name: "New label" });
  await addLabel.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New label" });
  await dialog.getByRole("textbox", { name: "Name (English) *" }).fill("Paleo");
  await dialog.getByRole("combobox", { name: "Label type" }).selectOption("dietary");
  await dialog.getByRole("combobox", { name: "Icon", exact: true }).selectOption("carrot");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Paleo (dietary)").waitFor();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Paleo (dietary)" })
    .locator("svg.lucide-carrot")
    .waitFor();
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

test("label icons preview, retain failed edits, reach item and public views, and reset", async (t) => {
  const page = await preview(t, "/en/admin/menus");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Categories / Labels", exact: true }).click();
  const vegetarian = page.getByRole("listitem").filter({ hasText: "Vegetarian (dietary)" });
  await vegetarian.locator("svg.lucide-leaf").waitFor();
  await page.getByText("Fail mutations").locator("input").check();
  await vegetarian.getByRole("button", { name: "Edit label", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit label", exact: true });
  const selector = dialog.getByRole("combobox", { name: "Icon", exact: true });
  await selector.selectOption("sprout");
  await dialog.locator("svg.lucide-sprout").waitFor();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await selector.inputValue(), "sprout");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await vegetarian.locator("svg.lucide-leaf").waitFor();
  await page.getByText("Fail mutations").locator("input").uncheck();
  await vegetarian.getByRole("button", { name: "Edit label", exact: true }).click();
  assert.equal(await selector.inputValue(), "sprout");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await vegetarian.locator("svg.lucide-sprout").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  await page.getByRole("link", { name: "Edit item: Burrata with tomatoes", exact: true }).click();
  await page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name: "Vegetarian", exact: true }) })
    .locator("svg.lucide-sprout")
    .waitFor();
  await page.getByRole("link", { name: "Public menu", exact: true }).click();
  const filter = page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name: "Vegetarian", exact: true }) });
  await filter.locator("svg.lucide-sprout").waitFor();
  assert.equal(await filter.locator(".bg-status-success").count(), 1);
  await page
    .locator("article")
    .filter({ hasText: "Burrata with tomatoes" })
    .locator("svg.lucide-sprout")
    .waitFor();
  await page.getByRole("link", { name: "French menu", exact: true }).click();
  await page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name: "Végétarien", exact: true }) })
    .locator("svg.lucide-sprout")
    .waitFor();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("link", { name: "Manage menu", exact: true }).click();
  await page.getByRole("link", { name: "Categories / Labels", exact: true }).click();
  await vegetarian.getByRole("button", { name: "Edit label", exact: true }).click();
  assert.equal(await selector.inputValue(), "sprout");
  await selector.selectOption("");
  assert.equal(await selector.inputValue(), "");
  await dialog.locator("svg.lucide-leaf").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/forge-menu-label-icon-editor.png" });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await vegetarian.locator("svg.lucide-leaf").waitFor();
  await page.screenshot({ path: "/tmp/forge-menu-label-icons.png" });
});

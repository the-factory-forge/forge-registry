import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { openDriveFolderDialog, closeDriveNavigation } from "./drive-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

await suite("Menus browser", async () => {
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

  async function selectLanguage(container, name) {
    await container.getByRole("tab", { name, exact: true }).click();
    await container.locator('[role="tabpanel"][inert]').waitFor({ state: "hidden" });
  }

  await test("stacked menus share one editable category and preview their own dishes", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    const stage = page.getByRole("main", { name: "Component preview" });
    const lunch = stage.getByRole("region", { name: "Lunch menu", exact: true });
    const drinks = stage.getByRole("region", { name: "Drinks menu", exact: true });
    await stage.getByRole("heading", { name: "Seasonal menu", exact: true }).waitFor();
    await lunch.getByRole("region", { name: "Soft drinks", exact: true }).waitFor();
    await drinks.getByRole("region", { name: "Soft drinks", exact: true }).waitFor();
    assert.equal(await stage.getByRole("combobox", { name: "Sample menu" }).count(), 0);
    await lunch.getByText("Shared by 2 menus", { exact: true }).click();
    await lunch.getByText("Drinks menu", { exact: true }).waitFor();
    await lunch.getByText("Shared by 2 menus", { exact: true }).click();
    await lunch.getByRole("button", { name: "Edit shared category" }).click();
    await lunch.getByRole("button", { name: "Actions for Soft drinks", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit category", exact: true }).click();
    await lunch.getByRole("textbox", { name: "Name", exact: true }).fill("Cold drinks");
    await lunch.getByRole("button", { name: "Save", exact: true }).click();
    await drinks.getByRole("region", { name: "Cold drinks", exact: true }).waitFor();
    await drinks.getByRole("link", { name: "Preview", exact: true }).click();
    const web = page.getByRole("tabpanel", { name: "Web", exact: true });
    await web.getByRole("heading", { name: "Drinks menu", exact: true }).waitFor();
    await web.getByRole("heading", { name: "Espresso", exact: true }).waitFor();
    assert.equal(
      await web.getByRole("heading", { name: "Burrata with tomatoes", exact: true }).count(),
      0,
    );
    await page.getByRole("tab", { name: "Paper", exact: true }).click();
    const paper = page.frameLocator("[data-menu-preview-frame]");
    await paper.getByRole("heading", { name: "Drinks menu", exact: true }).waitFor();
    await paper.getByRole("heading", { name: "Cold drinks", exact: true }).waitFor();
  });

  await test("deleting a category keeps hidden dishes that staff can reassign or delete", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    const stage = page.getByRole("main", { name: "Component preview" });
    const lunch = stage.getByRole("region", { name: "Lunch menu", exact: true });
    await lunch.getByRole("region", { name: "Small plates", exact: true }).waitFor();
    await lunch.getByRole("button", { name: "Actions for Small plates", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete category", exact: true }).click();
    const confirmation = page.getByRole("dialog", {
      name: "Delete category · Small plates",
      exact: true,
    });
    const deleteDishes = confirmation.getByRole("checkbox", {
      name: "Also delete the 3 dishes",
      exact: true,
    });
    await deleteDishes.waitFor();
    assert.equal(await deleteDishes.isChecked(), false);
    await confirmation.getByRole("button", { name: "Delete category", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    assert.equal(await lunch.getByRole("region", { name: "Small plates", exact: true }).count(), 0);
    const orphanSection = stage
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Unassigned dishes" }) });
    await orphanSection.locator("summary").click();
    await orphanSection.getByText("Tomato soup", { exact: true }).waitFor();
    await orphanSection
      .getByRole("link", { name: "Choose a category · Tomato soup", exact: true })
      .click();
    assert.equal(
      await page.getByRole("combobox", { name: "Category", exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page.getByRole("checkbox", { name: "Visible on menu", exact: true }).isChecked(),
      true,
    );
    await page.getByRole("checkbox", { name: "Visible on menu", exact: true }).uncheck();
    await page
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption({ label: "Lunch plates" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
    await lunch.getByText("Tomato soup", { exact: true }).waitFor();
    assert.equal(
      await lunch
        .getByRole("button", { name: "Dish visibility · Tomato soup", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    await orphanSection.locator("summary").click();
    await orphanSection.getByText("Green salad", { exact: true }).waitFor();
    assert.equal(await orphanSection.getByText("Tomato soup", { exact: true }).count(), 0);
    await orphanSection
      .getByRole("button", { name: "Delete dish · Green salad", exact: true })
      .click();
    const deleteDish = page.getByRole("dialog", { name: "Delete dish · Green salad", exact: true });
    await deleteDish.getByRole("button", { name: "Delete dish", exact: true }).click();
    await deleteDish.waitFor({ state: "hidden" });
    await orphanSection.getByText("Green salad", { exact: true }).waitFor({ state: "hidden" });
    await orphanSection.getByText("Marinated olives", { exact: true }).waitFor();
  });

  await test("category deletion protects dish files and requires an explicit delete-all choice", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    const stage = page.getByRole("main", { name: "Component preview" });
    const seasonal = stage.getByRole("region", { name: "Seasonal menu", exact: true });
    await seasonal.getByRole("button", { name: "Actions for Starters", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete category", exact: true }).click();
    const guarded = page.getByRole("dialog", { name: "Delete category · Starters", exact: true });
    await guarded.getByRole("checkbox", { name: "Also delete the 2 dishes", exact: true }).check();
    await guarded.getByRole("button", { name: "Delete category and dishes", exact: true }).click();
    await guarded.getByRole("alert").waitFor();
    assert.match(await guarded.getByRole("alert").textContent(), /photos and files/);
    await guarded.getByRole("button", { name: "Cancel", exact: true }).click();
    await seasonal.getByText("Burrata with tomatoes", { exact: true }).waitFor();
    await seasonal.getByText("Roasted beet salad", { exact: true }).waitFor();

    const drinks = stage.getByRole("region", { name: "Drinks menu", exact: true });
    await drinks.getByRole("button", { name: "Actions for Hot drinks", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete category", exact: true }).click();
    const deletion = page.getByRole("dialog", {
      name: "Delete category · Hot drinks",
      exact: true,
    });
    await deletion.getByRole("checkbox", { name: "Also delete the 2 dishes", exact: true }).check();
    await deletion.getByRole("button", { name: "Delete category and dishes", exact: true }).click();
    await deletion.waitFor({ state: "hidden" });
    assert.equal(await drinks.getByRole("region", { name: "Hot drinks", exact: true }).count(), 0);
    const orphanSection = stage
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Unassigned dishes" }) });
    await orphanSection.locator("summary").click();
    await orphanSection.getByText("No unassigned dishes.", { exact: true }).waitFor();
    await drinks.getByRole("button", { name: "Actions for Soft drinks", exact: true }).click();
    assert.equal(
      await page.getByRole("menuitem", { name: "Delete category", exact: true }).count(),
      0,
    );
  });

  await test("a grouped drag previews a move but never drops into a locked shared category", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    await page.setViewportSize({ width: 1440, height: 1350 });
    const lunch = page.getByRole("region", { name: "Lunch menu", exact: true });
    await lunch.evaluate((element) => element.scrollIntoView({ block: "start" }));
    const origin = lunch.getByRole("region", { name: "Small plates", exact: true });
    const destination = lunch.getByRole("region", { name: "Lunch plates", exact: true });
    const shared = lunch.getByRole("region", { name: "Soft drinks", exact: true });
    const move = origin.getByRole("button", { name: "Move Tomato soup", exact: true });
    const movePointer = async (locator) => {
      const box = await locator.boundingBox();
      assert.ok(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    };
    const hoverDestination = async () => {
      await movePointer(move);
      await page.mouse.down();
      await movePointer(destination.getByText("Grilled cheese", { exact: true }));
      await destination.locator("[data-menu-drag-placeholder]").waitFor();
    };
    await hoverDestination();
    await movePointer(shared.getByText("Homemade lemonade", { exact: true }));
    await page.mouse.up();
    await page.locator("[data-menu-drag-preview]").waitFor({ state: "hidden" });
    assert.equal(await origin.getByText("Tomato soup", { exact: true }).count(), 1);
    await hoverDestination();
    await page.mouse.up();
    await page.locator("[data-menu-drag-preview]").waitFor({ state: "hidden" });
    await destination.getByRole("button", { name: "Move Tomato soup", exact: true }).waitFor();
    assert.equal(await origin.getByText("Tomato soup", { exact: true }).count(), 0);
  });

  await test("manager creates a set menu with translations preserved across language tabs", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    assert.equal(await page.getByRole("link", { name: "Create menu", exact: true }).count(), 0);
    const stage = page.getByRole("main", { name: "Component preview" });
    await stage.getByRole("button", { name: "Menu", exact: true }).click();
    await stage.getByRole("radio", { name: "Weekly menu", exact: true }).waitFor();
    await stage.getByRole("radio", { name: "Set menu", exact: true }).check();
    await selectLanguage(stage, "Français");
    await stage.getByRole("textbox", { name: "Name", exact: true }).fill("Dîner pour deux");
    await stage
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("88 CHF par personne");
    await stage.getByRole("button", { name: "Save", exact: true }).click();
    await stage
      .getByRole("alert")
      .filter({ hasText: "Enter a name in the base language." })
      .waitFor();
    await page
      .getByRole("tabpanel", { name: "Français", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await stage.getByRole("tab", { name: "English", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await stage
        .getByRole("textbox", { name: "Name", exact: true })
        .evaluate((input) => input === document.activeElement),
      true,
    );
    await stage.getByRole("textbox", { name: "Name", exact: true }).fill("Dinner for two");
    await stage
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("88 CHF per person");
    await stage.getByRole("tab", { name: "English", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await stage
      .getByRole("tabpanel", { name: "English", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await stage.getByRole("tab", { name: "Français", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await stage.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
      "Dîner pour deux",
    );
    await stage.getByRole("button", { name: "Save", exact: true }).click();
    const menu = stage.getByRole("region", { name: "Dinner for two", exact: true });
    await menu.getByRole("heading", { name: "Dinner for two", exact: true }).waitFor();
    assert.equal(await menu.getByRole("switch").getAttribute("aria-checked"), "false");
    await menu.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", {
      name: "Menu settings · Dinner for two",
      exact: true,
    });
    assert.equal(
      await settings.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
      "Dinner for two",
    );
    await selectLanguage(settings, "Français");
    assert.equal(
      await settings.getByRole("textbox", { name: "Description", exact: true }).inputValue(),
      "88 CHF par personne",
    );
    await settings.getByRole("textbox", { name: "Description", exact: true }).fill("Café compris");
    await settings.getByRole("button", { name: "Save", exact: true }).click();
    await settings.waitFor({ state: "hidden" });
    await menu.getByRole("button", { name: "Settings", exact: true }).click();
    await selectLanguage(settings, "Français");
    assert.equal(
      await settings.getByRole("textbox", { name: "Description", exact: true }).inputValue(),
      "Café compris",
    );
    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(
      await settings.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
      true,
    );
  });

  await test("category language tabs keep translations and require the base name", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    const seasonal = page.getByRole("region", { name: "Seasonal menu", exact: true });
    await seasonal.getByRole("button", { name: "+ Category", exact: true }).click();
    for (const name of ["Create a category", "Add an existing category"]) {
      await page.getByRole("menuitem", { name, exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("menuitem", { name, exact: true })
          .locator('svg[aria-hidden="true"]')
          .count(),
        1,
      );
    }
    await page.getByRole("menuitem", { name: "Create a category", exact: true }).click();
    const form = seasonal.locator("form");
    await selectLanguage(form, "Français");
    await form.getByRole("textbox", { name: "Name", exact: true }).fill("Suggestions");
    await form.getByRole("textbox", { name: "Description", exact: true }).fill("Selon la saison.");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await form
      .getByRole("alert")
      .filter({ hasText: "Enter a name in the base language." })
      .waitFor();
    await page
      .getByRole("tabpanel", { name: "Français", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await form.getByRole("tab", { name: "English", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await form
        .getByRole("textbox", { name: "Name", exact: true })
        .evaluate((input) => input === document.activeElement),
      true,
    );
    await form.getByRole("textbox", { name: "Name", exact: true }).fill("Seasonal specials");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    const section = seasonal.getByRole("region", { name: "Seasonal specials", exact: true });
    await section
      .getByRole("button", { name: "Actions for Seasonal specials", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Edit category", exact: true }).click();
    const editor = section.locator("form");
    await selectLanguage(editor, "Français");
    assert.equal(
      await editor.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
      "Suggestions",
    );
    assert.equal(
      await editor.getByRole("textbox", { name: "Description", exact: true }).inputValue(),
      "Selon la saison.",
    );
    await editor
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Suggestion du chef.");
    await selectLanguage(editor, "English");
    assert.equal(
      await editor.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
      "Seasonal specials",
    );
    assert.equal(
      await editor.getByRole("textbox", { name: "Description", exact: true }).inputValue(),
      "",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await editor.waitFor({ state: "hidden" });
  });

  await test("grouped search belongs to one menu and survives reload", async (t) => {
    const page = await preview(t, "/en/admin/menus");
    const stage = page.getByRole("main", { name: "Component preview" });
    const lunch = stage.getByRole("region", { name: "Lunch menu", exact: true });
    await lunch.getByRole("button", { name: "Search dishes", exact: true }).click();
    await lunch.getByRole("searchbox", { name: "Search dishes", exact: true }).fill("lentil");
    await lunch.getByText("Lentil bowl", { exact: true }).waitFor();
    await lunch.getByText("Tomato soup", { exact: true }).waitFor({ state: "hidden" });
    assert.match(page.url(), /menuQuery=lentil/);
    await page.reload();
    await lunch.getByRole("searchbox", { name: "Search dishes", exact: true }).waitFor();
    assert.equal(
      await lunch.getByRole("searchbox", { name: "Search dishes", exact: true }).inputValue(),
      "lentil",
    );
    const drinks = stage.getByRole("region", { name: "Drinks menu", exact: true });
    await drinks.scrollIntoViewIfNeeded();
    await drinks.getByText("Espresso", { exact: true }).waitFor();
    await lunch.getByRole("searchbox", { name: "Search dishes", exact: true }).press("Escape");
    await lunch.getByText("Tomato soup", { exact: true }).waitFor();
  });

  await test("weekly menus preview a grid and copy only the structure to the next week", async (t) => {
    const page = await preview(t, "/en/admin/menus/create-menu");
    const stage = page.getByRole("main", { name: "Component preview" });
    await stage.getByRole("radio", { name: "Weekly menu", exact: true }).check();
    await stage.getByRole("textbox", { name: "Name", exact: true }).fill("Weekly specials");
    await stage.getByLabel("From", { exact: true }).fill("2026-11-02");
    await stage.getByLabel("To", { exact: true }).fill("2026-11-03");
    for (const day of ["Wednesday", "Thursday", "Friday"])
      await stage.getByRole("checkbox", { name: day, exact: true }).uncheck();
    await stage.getByRole("button", { name: "Save", exact: true }).click();
    const weekly = stage.getByRole("region", { name: "Weekly specials", exact: true });
    const monday = weekly
      .getByRole("button", { name: /^Monday · Starters/ })
      .locator("xpath=ancestor::section[1]");
    await monday.getByRole("link", { name: "Dish", exact: true }).click();
    await page.getByRole("textbox", { name: "Name *", exact: true }).fill("Carrot soup");
    await page.getByRole("checkbox", { name: "Visible on menu" }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("heading", { name: "Edit item", exact: true }).waitFor();
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
    await weekly.getByRole("link", { name: "Preview", exact: true }).click();
    await page.getByRole("columnheader", { name: "Monday", exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("heading", { name: "Monday", exact: true }).waitFor();
    await page
      .getByRole("tabpanel", { name: "Web", exact: true })
      .getByText("Carrot soup", { exact: true })
      .last()
      .waitFor();
    await page.getByRole("tab", { name: "Paper", exact: true }).click();
    assert.equal(await page.getByLabel("Paper size", { exact: true }).inputValue(), "A4 landscape");
    await page
      .frameLocator("[data-menu-preview-frame]")
      .getByRole("columnheader", { name: "Tuesday", exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Back to menu", exact: true }).click();
    await weekly.getByRole("button", { name: "Create next week’s menu", exact: true }).click();
    const next = weekly.filter({ hasText: "2026-11-09" });
    await next.getByText(/2026-11-09.*2026-11-10/).waitFor();
    assert.equal(await next.getByRole("switch").getAttribute("aria-checked"), "false");
    assert.equal(await next.getByText("Carrot soup", { exact: true }).count(), 0);
  });

  await test("editor label shortcut opens label management with a keyboard tooltip", async (t) => {
    const page = await preview(t, "/en/admin/menus/30000000-0000-4000-8000-000000000001");
    const link = page.getByRole("link", { name: "Manage labels", exact: true });
    await link.focus();
    await page.getByRole("tooltip", { name: "Manage labels", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (value) => document.documentElement.classList.toggle("dark", value === "dark"),
          theme,
        );
        await link.scrollIntoViewIfNeeded();
        await link
          .locator("xpath=ancestor::fieldset[1]")
          .screenshot({ path: `/tmp/menu-labels-${width}-${theme}.png` });
      }
    }
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/admin/menus/taxonomy");
    await page.getByRole("heading", { name: "Labels", exact: true }).waitFor();
    await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Labels", exact: true }) })
      .last()
      .getByRole("button", { name: "Create", exact: true })
      .waitFor();
  });

  await test("homepage links, public visibility, sold out labels, language fallback, and themes", async (t) => {
    const page = await preview(t, "/");
    await page.getByRole("searchbox", { name: "Search examples" }).fill("menu item editor");
    assert.equal(await page.locator("main section a[href]").count(), 1);
    await page.getByRole("searchbox", { name: "Search examples" }).fill("");
    await page.getByRole("button", { name: "Plugin", exact: true }).click();
    await page.locator('main a[href="/en/menus"]').click();
    await page.getByRole("heading", { name: "Burrata with tomatoes" }).waitFor();
    const image = page.getByRole("img", { name: "Burrata with tomatoes", exact: true });
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => element.decode());
    assert.equal(await page.locator("article img").count(), 1);
    assert.equal(await image.getAttribute("src"), "/showroom/menus/burrata-with-tomatoes.png");
    await page.getByRole("link", { name: "Item list" }).click();
    await page.getByRole("heading", { name: "Menu items" }).waitFor();
    await page.getByRole("link", { name: "Public menu" }).click();
    await page.getByRole("heading", { name: "Burrata with tomatoes" }).waitFor();
    await page.getByText("Sold out", { exact: true }).waitFor();
    assert.equal(await page.getByText("Homemade lemonade").count(), 0);
    await page.getByRole("link", { name: "French menu" }).click();
    await page.getByRole("heading", { name: "Burrata aux tomates" }).waitFor();
    await page.getByRole("heading", { name: "House pasta" }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
    assert.equal(
      await page
        .getByRole("img", { name: "Burrata aux tomates", exact: true })
        .evaluate((element) => getComputedStyle(element).filter),
      "invert(1)",
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  });

  await test("sample menu image can be removed, reselected, and replaced with an uploaded image", async (t) => {
    const page = await preview(t, "/en/admin/menus/30000000-0000-4000-8000-000000000001");
    await page.getByRole("button", { name: "Remove photo", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    assert.equal(await page.locator("article img").count(), 0);
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: Burrata with tomatoes", exact: true }).click();
    await page.getByText("Additional private images", { exact: true }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "burrata-with-tomatoes.png" })
      .getByRole("button", { name: "Use as photo", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    assert.equal(
      await page.locator("article img").getAttribute("src"),
      "/showroom/menus/burrata-with-tomatoes.png",
    );
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: Burrata with tomatoes", exact: true }).click();
    await page.getByText("Additional private images", { exact: true }).click();
    await page.locator('details input[type="file"]').setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByRole("row")
      .filter({ hasText: "replacement.png" })
      .getByRole("button", { name: "Use as photo", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    const image = page.getByRole("img", { name: "Burrata with tomatoes", exact: true });
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => element.decode());
    assert.match(await image.getAttribute("src"), /^blob:/);
    assert.equal(await image.evaluate((element) => getComputedStyle(element).filter), "none");
  });

  await test("category tabs scroll, track sections, translate, and follow dish filters", async (t) => {
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
    assert.equal(Math.round((await navigation.boundingBox()).y), 56);
    assert.equal(
      (await page.getByRole("region", { name: "Main courses", exact: true }).boundingBox()).y >=
        112,
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
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
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
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("link", { name: "Item list" }).click();
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
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  });

  await test("staff creates, edits, and publishes an item; failure retains the draft", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.getByRole("link", { name: "Create", exact: true }).click();
    const frenchTab = page.getByRole("tab", { name: "Français" });
    await frenchTab.click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Soupe de saison");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Enter a name in the base language." })
      .waitFor();
    await page
      .getByRole("tabpanel", { name: "Français", exact: true })
      .waitFor({ state: "hidden" });
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
    await page.getByText("Simulate action failures").locator("input").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Name *" }).inputValue(), "Seasonal soup");
    await page.getByText("Simulate action failures").locator("input").uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu" }).click();
    await page.getByRole("heading", { name: "Seasonal soup" }).waitFor();
    await page.getByRole("link", { name: "French menu" }).click();
    await page.getByRole("heading", { name: "Soupe de saison" }).waitFor();
  });

  await test("public allergen and dietary filters combine, clear, and translate on mobile", async (t) => {
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
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
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
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
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
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
    const editorLabels = page.getByRole("group", { name: "Labels Manage labels", exact: true });
    await editorLabels.waitFor();
    assert.equal(await editorLabels.getByRole("checkbox").count(), 19);
    await editorLabels.getByRole("checkbox", { name: "Pescatarian", exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    const pescatarian = page
      .getByRole("group", { name: "Régimes alimentaires", exact: true })
      .getByRole("checkbox", { name: "Pescétarien", exact: true });
    await pescatarian.check();
    assert.equal(await page.locator("article").count(), 1);
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
    await editorLabels.getByRole("checkbox", { name: "Pescatarian", exact: true }).uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
    assert.equal(await pescatarian.count(), 0);
  });

  await test("staff reorders rows by dragging and keyboard, with persistence and failed-save recovery", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.getByRole("link", { name: "Edit item: House pasta", exact: true }).click();
    assert.equal(
      await page.getByRole("spinbutton", { name: "Display order", exact: true }).count(),
      0,
    );
    await page
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption({ label: "Starters" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
    const names = () => page.locator("tbody tr td:nth-child(2)").allTextContents();
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
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2 + 4, { steps: 10 });
    const ghost = page.locator("[data-menu-drag-preview]");
    await ghost.waitFor();
    assert.match(await ghost.textContent(), /Burrata with tomatoes.*Starters/);
    assert.equal(await ghost.getAttribute("aria-hidden"), "true");
    assert.equal(
      await ghost.evaluate((element) => getComputedStyle(element).pointerEvents),
      "none",
    );
    assert.equal(await page.locator('[data-menu-dragging="true"]').count(), 1);
    assert.equal(await page.locator('[data-menu-drop-edge="after"]').count(), 1);
    assert.deepEqual(await names(), ["Burrata with tomatoes", "House pasta", "Homemade lemonade"]);
    await page.mouse.up();
    assert.equal(await ghost.count(), 0);
    assert.equal(await page.locator("[data-menu-drop-edge]").count(), 0);
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), ["House pasta", "Homemade lemonade", "Burrata with tomatoes"]);
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
    assert.deepEqual(await page.locator("article h3").allTextContents(), [
      "House pasta",
      "Burrata with tomatoes",
    ]);
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await burrata.waitFor();
    assert.deepEqual(await names(), ["House pasta", "Homemade lemonade", "Burrata with tomatoes"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await burrata.press("ArrowUp");
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
    await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).check();
    await burrata.press("ArrowUp");
    await page
      .getByRole("alert")
      .filter({ hasText: "Could not save changes. Please try again." })
      .waitFor();
    assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
    await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).uncheck();
    await page.getByRole("button", { name: "Search menu items", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search menu items", exact: true }).fill("Burrata");
    assert.equal(await burrata.getAttribute("aria-disabled"), "true");
    await burrata.press("ArrowUp");
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
    await burrata.press("ArrowUp");
    await actionToast(page, "Saved.");
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
      touchPoints: [{ x: touchEnd.x + 16, y: touchEnd.y + touchEnd.height / 2 + 4 }],
    });
    await ghost.waitFor();
    assert.equal(await page.locator('[data-menu-drop-edge="after"]').count(), 1);
    const ghostBounds = await ghost.boundingBox();
    assert.ok(ghostBounds.x >= 0 && ghostBounds.x + ghostBounds.width <= 390);
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.equal(await ghost.count(), 0);
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), ["House pasta", "Burrata with tomatoes", "Homemade lemonade"]);
    await touch.detach();
    await page.getByRole("link", { name: "Create", exact: true }).click();
    assert.equal(
      await page.getByRole("spinbutton", { name: "Display order", exact: true }).count(),
      0,
    );
  });

  await test("drag preview marks exact insertion edges and clears on canceled or invalid drops", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    const names = () => page.locator("tbody tr td:nth-child(2)").allTextContents();
    const original = ["Burrata with tomatoes", "House pasta", "Homemade lemonade"];
    const rows = page.locator("tbody tr[data-menu-item]");
    const ghost = page.locator("[data-menu-drag-preview]");
    async function start(name) {
      const handle = page.getByRole("button", { name: `Reorder item: ${name}`, exact: true });
      await handle.scrollIntoViewIfNeeded();
      const bounds = await handle.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      return bounds;
    }
    async function hover(index, edge) {
      const bounds = await rows.nth(index).boundingBox();
      await page.mouse.move(bounds.x + 20, bounds.y + (edge === "before" ? 4 : bounds.height - 4), {
        steps: 5,
      });
    }
    await start(original[0]);
    assert.equal(await ghost.count(), 0);
    await hover(2, "before");
    await ghost.waitFor();
    assert.equal(await rows.nth(2).getAttribute("data-menu-drop-edge"), "before");
    await hover(2, "after");
    assert.equal(await rows.nth(2).getAttribute("data-menu-drop-edge"), "after");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(await ghost.count(), 0);
    assert.equal(await page.locator("[data-menu-drop-edge]").count(), 0);
    assert.deepEqual(await names(), original);

    await start(original[0]);
    await hover(2, "after");
    await page.mouse.move(5, 5);
    assert.equal(await page.locator("[data-menu-drop-edge]").count(), 0);
    await page.mouse.up();
    assert.equal(await ghost.count(), 0);
    assert.deepEqual(await names(), original);

    const source = await start(original[0]);
    await hover(2, "after");
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    assert.equal(await page.locator("[data-menu-drop-edge]").count(), 0);
    await page.mouse.up();
    assert.deepEqual(await names(), original);

    await start(original[0]);
    await hover(2, "before");
    await page.mouse.up();
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), [original[1], original[0], original[2]]);
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
    await start(original[2]);
    await hover(0, "after");
    assert.equal(await rows.nth(0).getAttribute("data-menu-drop-edge"), "after");
    await page.mouse.up();
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), [original[1], original[2], original[0]]);
    await start(original[0]);
    await hover(0, "before");
    assert.equal(await rows.nth(0).getAttribute("data-menu-drop-edge"), "before");
    await page.mouse.up();
    await actionToast(page, "Saved.");
    assert.deepEqual(await names(), [original[0], original[1], original[2]]);

    await start(original[0]);
    await hover(2, "after");
    await page
      .getByRole("button", { name: `Reorder item: ${original[0]}`, exact: true })
      .dispatchEvent("pointercancel");
    await page.mouse.up();
    assert.equal(await ghost.count(), 0);
    assert.deepEqual(await names(), original);
  });

  await test("staff sets independent spice levels with one, two or three flames and can clear them", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [level, text] of [
      [1, "Mildly spicy"],
      [2, "Spicy"],
      [3, "Extremely spicy"],
    ]) {
      await page.getByRole("link", { name: "Edit item: House pasta" }).click();
      const spices = page.getByRole("slider", { name: "Spice level", exact: true });
      assert.equal(await spices.getAttribute("max"), "3");
      await spices.press("Home");
      for (let step = 0; step < level; step++) await spices.press("ArrowRight");
      assert.equal(await spices.getAttribute("aria-valuetext"), text);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await actionToast(page, "Saved.");
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
      await page.getByRole("link", { name: "Item list", exact: true }).click();
    }
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await page.getByRole("link", { name: "French menu", exact: true }).click();
    await page.getByText("Extrêmement épicé", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByText("Extrêmement épicé", { exact: true })
        .locator("..")
        .locator("svg")
        .count(),
      3,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: House pasta" }).click();
    const spices = page.getByRole("slider", { name: "Spice level", exact: true });
    assert.equal(await spices.getAttribute("aria-valuetext"), "Extremely spicy");
    await spices.press("Home");
    assert.equal(await spices.getAttribute("aria-valuetext"), "Not spicy");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await page.getByRole("heading", { name: "House pasta", exact: true }).waitFor();
    assert.equal(await page.getByText("Extrêmement épicé", { exact: true }).count(), 0);
  });

  await test("staff saves translated size prices and guests select sizes with keyboard controls", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.getByRole("textbox", { name: "Name *", exact: true }).fill("Margherita pizza");
    await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("22.00");
    await page.getByRole("button", { name: "Add size", exact: true }).click();
    await page.getByRole("button", { name: "Add size", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).count(), 0);
    await page.getByRole("tab", { name: "Français", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Size name (fr) 1", exact: true })
      .fill("Petite · 30 cm");
    await page
      .getByRole("textbox", { name: "Size name (fr) 2", exact: true })
      .fill("Familiale · 40 cm");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Enter every size name in the base language." })
      .first()
      .waitFor();
    assert.equal(
      await page.getByRole("tab", { name: "English", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    await page
      .getByRole("textbox", { name: "Size name (en) 1", exact: true })
      .fill("Small · 30 cm");
    await page
      .getByRole("textbox", { name: "Size name (en) 2", exact: true })
      .fill("Family · 40 cm");
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("28.005");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Enter a valid, non-negative price" })
      .waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
      "28.005",
    );
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("28.00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("heading", { name: "Edit item", exact: true }).waitFor();
    await actionToast(page, "Saved.");
    await page.getByRole("checkbox", { name: "Visible on menu", exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
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
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: Margherita pizza", exact: true }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
      "28.00",
    );
    await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).fill("29.00");
    await page.getByText("Simulate action failures").locator("input").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Price (CHF) 2", exact: true }).inputValue(),
      "29.00",
    );
    await page.getByText("Simulate action failures").locator("input").uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    for (const name of ["Small · 30 cm", "Family · 40 cm"]) {
      await page.getByRole("button", { name: `Remove size: ${name}`, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: `Remove size: ${name}`, exact: true });
      await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
    }
    await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("24.00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await actionToast(page, "Saved.");
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await pizza.getByRole("heading", { name: "Margherita pizza", exact: true }).waitFor();
    assert.equal(await pizza.getByRole("group").count(), 0);
    assert.match(
      await pizza.getByRole("status", { name: "Prix", exact: true }).textContent(),
      /24,00/,
    );
  });

  await test("staff taxonomy and nested photo folders work with keyboard navigation on mobile", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("link", { name: "Categories / Labels" }).click();
    const addLabel = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Labels", exact: true }) })
      .last()
      .getByRole("button", { name: "Create" });
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
    await page.getByText("Additional private images", { exact: true }).click();
    await openDriveFolderDialog(page);
    const folderDialog = page.getByRole("dialog", { name: "New folder" });
    await folderDialog.getByRole("textbox", { name: "Name" }).fill("Photos");
    await folderDialog.getByRole("button", { name: "Create" }).click();
    await folderDialog.waitFor({ state: "hidden" });
    await closeDriveNavigation(page);
    await page
      .getByRole("link", { name: "Photos", exact: true })
      .and(page.locator('a[aria-disabled="false"]'))
      .press("Enter");
    await page
      .getByRole("navigation", { name: "Folder navigation" })
      .getByRole("heading", { name: "Photos", exact: true })
      .waitFor();
    assert.match(page.url(), /\?folder=/);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  });

  await test("label icons preview, retain failed edits, reach item and public views, and reset", async (t) => {
    const page = await preview(t, "/en/admin/menus/items");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: "Categories / Labels", exact: true }).click();
    const vegetarian = page.getByRole("listitem").filter({ hasText: "Vegetarian (dietary)" });
    await vegetarian.locator("svg.lucide-leaf").waitFor();
    await page.getByText("Simulate action failures").locator("input").check();
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
    await page.getByText("Simulate action failures").locator("input").uncheck();
    await vegetarian.getByRole("button", { name: "Edit label", exact: true }).click();
    assert.equal(await selector.inputValue(), "sprout");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await vegetarian.locator("svg.lucide-sprout").waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
    await page.getByRole("link", { name: "Edit item: Burrata with tomatoes", exact: true }).click();
    await page
      .locator("label")
      .filter({ has: page.getByRole("checkbox", { name: "Vegetarian", exact: true }) })
      .locator("svg.lucide-sprout")
      .waitFor();
    await page.getByRole("link", { name: "Public menu", exact: true }).click();
    await page.getByRole("group", { name: "Exclude allergens", exact: true }).waitFor();
    const filter = page
      .getByRole("group", { name: "Dietary", exact: true })
      .locator("label")
      .filter({ has: page.getByRole("checkbox", { name: "Vegetarian", exact: true }) });
    await filter.locator("svg.lucide-sprout").waitFor();
    assert.match(await filter.getAttribute("class"), /\bbg-status-success\b/);
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
    await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("link", { name: "Item list", exact: true }).click();
    await page.getByRole("link", { name: "Categories / Labels", exact: true }).click();
    await vegetarian.getByRole("button", { name: "Edit label", exact: true }).click();
    assert.equal(await selector.inputValue(), "sprout");
    await selector.selectOption("");
    assert.equal(await selector.inputValue(), "");
    await dialog.locator("svg.lucide-leaf").waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: "/tmp/forge-menu-label-icon-editor.png" });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await vegetarian.locator("svg.lucide-leaf").waitFor();
    await page.screenshot({ path: "/tmp/forge-menu-label-icons.png" });
  });
});

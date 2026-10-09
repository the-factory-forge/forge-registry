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

async function preview(t, path = "/en/admin/menus/print") {
  const context = await browser.newContext();
  t.after(() => context.close());
  // Leave the prepared document available for inspection instead of opening a native dialog.
  await context.addInitScript(() => {
    window.print = () => {
      window.menuPrintCalls = (window.menuPrintCalls ?? 0) + 1;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

async function printedFrame(page) {
  await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-menu-print-frame]")?.contentWindow?.menuPrintCalls === 1,
  );
  return page.locator("[data-menu-print-frame]").contentFrame();
}

test("paper uses A4 portrait and A5 landscape dimensions", async (t) => {
  const page = await preview(t);
  const paper = page.frameLocator("[data-menu-preview-frame]").locator("[data-menu-paper]");
  for (const [size, height] of [
    ["A4", 297],
    ["A5", 148],
  ]) {
    await page.getByLabel("Paper size", { exact: true }).selectOption(size);
    await page.waitForFunction(() => {
      const frame = document.querySelector("[data-menu-preview-frame]");
      const paper = frame?.contentDocument?.querySelector("[data-menu-paper]");
      return (
        paper &&
        getComputedStyle(paper).minHeight !== "0px" &&
        Math.abs(frame.getBoundingClientRect().height - paper.getBoundingClientRect().height) < 1
      );
    });
    const dimensions = await paper.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      minHeight: parseFloat(getComputedStyle(element).minHeight),
    }));
    assert.ok(
      Math.abs(dimensions.width - (210 * 96) / 25.4) < 1,
      `${size} preview width must be 210mm`,
    );
    assert.ok(
      Math.abs(dimensions.minHeight - (height * 96) / 25.4) < 1,
      `${size} preview height must be ${height}mm`,
    );
    const frameHeight = await page
      .locator("[data-menu-preview-frame]")
      .evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(Math.abs(frameHeight - dimensions.height) < 1, `${size} frame must fit its paper`);
  }
});

test("printer is discoverable, follows visibility and translations, and keeps settings only for the session", async (t) => {
  const page = await preview(t, "/");
  const entry = page.locator('main section a[href="/en/menus"]');
  const search = page.getByRole("searchbox", { name: "Search examples" });
  assert.equal(await entry.count(), 1);
  assert.deepEqual(await entry.getByRole("listitem").allTextContents(), [
    "Public menu",
    "Menu management",
    "Menu printer",
  ]);
  assert.equal(await page.getByRole("heading", { name: "Menu printer", exact: true }).count(), 0);
  for (const keyword of ["menu item editor", "menu management", "menu printer", "A4", "PDF"]) {
    await search.fill(keyword);
    assert.equal(await page.locator("main section a[href]").count(), 1);
    assert.equal(await entry.count(), 1);
  }
  await search.fill("");
  await page.getByRole("button", { name: "Plugin", exact: true }).click();
  assert.equal(await entry.count(), 1);
  assert.equal(await page.getByRole("heading", { name: "Menu printer", exact: true }).count(), 0);
  await entry.click();
  await page.getByRole("link", { name: "Menu printer", exact: true }).click();
  const paper = page.frameLocator("[data-menu-preview-frame]").locator("[data-menu-paper]");
  assert.equal(await paper.getAttribute("data-menu-paper"), "A4");
  assert.deepEqual(await paper.locator("h4").allTextContents(), [
    "Burrata with tomatoes",
    "House pasta",
  ]);
  assert.deepEqual(await paper.locator("h3").allTextContents(), ["Starters", "Main courses"]);
  assert.equal(await paper.getByText("Homemade lemonade", { exact: true }).count(), 0);
  assert.equal(await paper.getByText("Sold out", { exact: true }).count(), 1);
  for (const amount of ["14.50", "28.50", "34.50"])
    assert.match(await paper.textContent(), new RegExp(amount));
  assert.equal(await paper.getByText("Spicy", { exact: true }).count(), 1);
  assert.equal(await paper.getByRole("checkbox").count(), 0);
  assert.equal(await paper.locator("img").count(), 0);
  await page.getByLabel("Menu title", { exact: true }).fill("Autumn menu");
  await page
    .getByLabel("Footer text (optional)", { exact: true })
    .fill("Ask our team about ingredients.");
  await page.getByLabel("Paper size", { exact: true }).selectOption("A5");
  assert.equal(await paper.getAttribute("data-menu-paper"), "A5");
  await paper.getByRole("heading", { name: "Autumn menu" }).waitFor();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(
    await paper.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(255, 255, 255)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByLabel("Menu title", { exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByLabel("Footer text (optional)", { exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  await page.getByRole("link", { name: "Print menu", exact: true }).click();
  assert.equal(await page.getByLabel("Menu title", { exact: true }).inputValue(), "Menu");
  assert.equal(await page.getByLabel("Footer text (optional)", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Paper size", { exact: true }).inputValue(), "A4");
  await page.goto(baseURL + "/fr/admin/menus/print");
  await paper.getByRole("heading", { name: "Burrata aux tomates" }).waitFor();
  await paper.getByRole("heading", { name: "House pasta" }).waitFor();
  assert.equal(await paper.getAttribute("lang"), "fr");
  assert.equal(await page.getByLabel("Titre du menu", { exact: true }).inputValue(), "La carte");
  assert.equal(await paper.getByText("Épuisé", { exact: true }).count(), 1);
  assert.equal(await paper.getByText("Épicé", { exact: true }).count(), 1);
});

test("printing isolates the paper, applies both sizes, escapes text and cleans up after cancellation", async (t) => {
  const page = await preview(t);
  const entered = '<img src=x onerror="window.injected=true">';
  await page.getByLabel("Menu title", { exact: true }).fill(entered);
  await page.getByLabel("Footer text (optional)", { exact: true }).fill("First line\nSecond line");
  for (const size of ["A4", "A5"]) {
    await page.getByLabel("Paper size", { exact: true }).selectOption(size);
    const frame = await printedFrame(page);
    assert.equal(await frame.locator("[data-menu-paper]").getAttribute("data-menu-paper"), size);
    assert.equal(await frame.locator("h2").textContent(), entered);
    assert.equal(await frame.locator("footer").textContent(), "First line\nSecond line");
    assert.equal(await frame.locator("img, input, textarea, button, nav").count(), 0);
    assert.match(
      await frame.locator("head").textContent(),
      new RegExp(`size: ${size} ${size === "A4" ? "portrait" : "landscape"}`),
    );
    assert.equal(await frame.locator("html").getAttribute("class"), "light");
    const paper = frame.locator("[data-menu-paper]");
    assert.equal(await paper.evaluate((element) => getComputedStyle(element).minHeight), "0px");
    assert.equal(
      await paper.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(255, 255, 255)",
    );
    await page.evaluate(() =>
      document
        .querySelector("[data-menu-print-frame]")
        .contentWindow.dispatchEvent(new Event("afterprint")),
    );
    assert.equal(await page.locator("[data-menu-print-frame]").count(), 0);
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Print / Save PDF",
    );
    assert.equal(
      await page.getByRole("button", { name: "Print / Save PDF", exact: true }).isEnabled(),
      true,
    );
  }
  await printedFrame(page);
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  assert.equal(await page.locator("[data-menu-print-frame]").count(), 0);
});

test("failed print preparation retains settings and can retry; no visible dishes disables printing", async (t) => {
  const page = await preview(t);
  await page.getByLabel("Menu title", { exact: true }).fill("Today's menu");
  // Simulate an unavailable host logo in the actual markup copied into the print document.
  await page
    .frameLocator("[data-menu-preview-frame]")
    .locator("[data-menu-paper] header")
    .evaluate((header) => {
      const logo = document.createElement("img");
      logo.src = "data:image/png;base64,broken";
      header.append(logo);
    });
  await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not prepare" }).waitFor();
  assert.equal(await page.getByLabel("Menu title", { exact: true }).inputValue(), "Today's menu");
  assert.equal(await page.locator("[data-menu-print-frame]").count(), 0);
  await page
    .frameLocator("[data-menu-preview-frame]")
    .locator("[data-menu-paper] img")
    .evaluate((image) => image.remove());
  await printedFrame(page);
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.getByRole("link", { name: "Back to items", exact: true }).click();
  for (const dish of ["Burrata with tomatoes", "House pasta"]) {
    await page.getByRole("link", { name: `Edit item: ${dish}`, exact: true }).click();
    await page.getByRole("checkbox", { name: "Visible on menu", exact: true }).uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
    await page.getByRole("link", { name: "Back to items", exact: true }).click();
  }
  await page.getByRole("link", { name: "Print menu", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "There are no visible dishes" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Print / Save PDF", exact: true }).isDisabled(),
    true,
  );
  assert.equal(await page.locator("[data-menu-preview-frame]").count(), 0);
});

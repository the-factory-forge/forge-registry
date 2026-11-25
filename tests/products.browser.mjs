import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";
import { switchPreviewLanguage } from "./showroom-helpers.mjs";

async function assertActionSizes(stage, size) {
  const row = stage.getByRole("row").filter({ hasText: "Linen notebook" });
  const create = await stage.getByRole("link", { name: "Create", exact: true }).boundingBox();
  const edit = await row.getByRole("link", { name: "Edit", exact: true }).boundingBox();
  const remove = await row.getByRole("button", { name: "Delete product" }).boundingBox();

  assert.equal(create?.height, size, "Create link height");
  assert.deepEqual([edit?.width, edit?.height], [size, size], "Edit dimensions");
  assert.deepEqual([remove?.width, remove?.height], [size, size], "Delete dimensions");
}

await test("Products preview settings switch between English and French", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/products");
  await switchPreviewLanguage(page, "Français");
  await page.waitForURL(base + "/fr/products");
  await page.getByRole("link", { name: "Carnet en lin" }).click();
  await page.waitForURL(base + "/fr/products/linen-notebook");
  await page.getByRole("heading", { name: "Carnet en lin" }).waitFor();

  await page.goto(base + "/fr/products/linen-notebook?ref=preview#product");
  await switchPreviewLanguage(page, "English");
  await page.waitForURL(base + "/en/products/linen-notebook?ref=preview#product");
  await page.getByRole("heading", { name: "Linen notebook" }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Carnet en lin" }).waitFor();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/en/admin/products");
  await switchPreviewLanguage(page, "Français");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.waitForURL(base + "/fr/admin/products/new");
  await page.getByRole("tab", { name: "Français", selected: true }).waitFor();
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Un produit");
  await switchPreviewLanguage(page, "English");
  await page.waitForURL(base + "/en/admin/products/new");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(await name.inputValue(), "Un produit");
});

await test("Characteristic removal uses the danger color in both themes", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/admin/products");
  await page.getByRole("link", { name: "Linen notebook" }).click();
  const remove = page.getByRole("button", { name: "Remove characteristic" }).first();
  const add = page.getByRole("button", { name: "Add characteristic" });
  const theme = page.getByRole("button", { name: "Dark mode", exact: true });
  const color = (control) => control.evaluate((el) => getComputedStyle(el).color);
  for (const dark of [false, true]) {
    if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
    await add.hover();
    await add.focus();
    const danger = await remove.evaluate((button) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--destructive)";
      button.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    assert.equal(await color(remove.locator("svg")), danger);
    assert.notEqual(await color(add), danger);
    await remove.focus();
    assert.equal(await color(remove), danger);
    await remove.hover();
    assert.equal(await color(remove), danger);
  }
  const rows = page.getByRole("button", { name: "Remove characteristic" });
  const count = await rows.count();
  await remove.click();
  assert.equal(await rows.count(), count - 1);
});

await test("Products staff and public catalog share the publishing and deletion lifecycle", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/admin/products");
  await page.locator('[data-preview-ready="true"]').waitFor();
  const stage = page.getByRole("main", { name: "Component preview" });
  const controls = page.getByRole("complementary", { name: "Preview controls" });
  async function showControls() {
    const settings = controls.getByRole("button", { name: "Settings" });
    if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
  }
  async function open(name) {
    await showControls();
    await controls.getByRole("link", { name, exact: true }).click();
  }
  await assertActionSizes(stage, 40);
  const row = () => stage.getByRole("row").filter({ hasText: "Sample tray" });
  const create = stage.getByRole("link", { name: "Create", exact: true });
  assert.equal((await create.innerText()).trim(), "Create");
  await create.click();
  const name = stage.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Sample tray");
  const english = stage.getByRole("tab", { name: "English", exact: true });
  const french = stage.getByRole("tab", { name: "Français", exact: true });
  await english.focus();
  await english.press("ArrowRight");
  await french.press("Enter");
  assert.equal(await french.getAttribute("aria-selected"), "true");
  assert.equal(await name.inputValue(), "");
  await stage.getByRole("textbox", { name: "Description" }).fill("Un petit plateau.");
  await english.click();
  assert.equal(await name.inputValue(), "Sample tray");
  await stage.getByRole("button", { name: "Save", exact: true }).click();
  await stage.getByRole("tab", { name: "Français", selected: true }).waitFor();
  assert.equal(await name.getAttribute("aria-invalid"), "true");
  await name.fill("Petit plateau");
  await english.click();
  await showControls();
  const fail = controls.getByRole("checkbox", { name: "Simulate a failed save" });
  await fail.check();
  await name.press("Control+Enter");
  await stage.getByRole("alert").waitFor();
  assert.equal(await name.inputValue(), "Sample tray");
  await fail.uncheck();
  await name.press("Meta+Enter");
  await row().getByText("Private").waitFor();
  await open("Public catalog");
  await stage.getByRole("heading", { name: "Linen notebook" }).waitFor();
  assert.equal(await stage.getByText("Sample tray").count(), 0);
  await open("Staff directory");
  await row()
    .getByRole("cell")
    .filter({ hasText: "Private" })
    .getByRole("button", { pressed: false })
    .click();
  await open("Public catalog");
  await stage.getByRole("heading", { name: "Sample tray" }).waitFor();
  await open("Staff directory");
  await row().getByRole("link", { name: "Edit" }).click();
  await french.click();
  assert.equal(await name.inputValue(), "Petit plateau");
  assert.equal(
    await stage.getByRole("textbox", { name: "Description" }).inputValue(),
    "Un petit plateau.",
  );
  await english.click();
  await stage.getByRole("textbox", { name: "Description" }).fill("A small wooden tray.");
  await stage.getByRole("button", { name: "Add characteristic" }).click();
  await stage.getByRole("textbox", { name: "Label", exact: true }).fill("Material");
  await stage.getByRole("textbox", { name: "Price (CHF)" }).fill("0");
  await stage.getByRole("button", { name: "Save", exact: true }).click();
  const value = stage.getByRole("textbox", { name: "Value", exact: true });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
  assert.equal(await value.evaluate((el) => el === document.activeElement), true);
  await value.fill("Oak");
  await value.press("Control+Enter");
  await row().waitFor();
  await open("Public catalog");
  const card = stage.getByRole("listitem").filter({ hasText: "Sample tray" });
  await card.getByText("Oak").waitFor();
  const detail = card.getByRole("link", { name: "Sample tray" });
  const idPath = await detail.getAttribute("href");
  assert.match(idPath, /^\/en\/products\/[a-f0-9-]{36}$/);
  await detail.click();
  await stage.getByRole("heading", { name: "Sample tray", level: 1 }).waitFor();
  assert.equal(new URL(page.url()).pathname, idPath);
  await stage.getByRole("link", { name: "Back to products" }).click();
  assert.match(await card.innerText(), /CHF\s*0\.00/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await open("Staff directory");
  await row().getByRole("link", { name: "Edit" }).click();
  const slug = stage.getByRole("textbox", { name: "URL slug" });
  await slug.fill("linen-notebook");
  await slug.press("Control+Enter");
  await stage
    .getByRole("alert")
    .getByText(/slug is already in use/)
    .waitFor();
  await slug.fill("sample-tray");
  await slug.press("Control+Enter");
  await row().getByRole("button", { name: "Publication status", pressed: true }).press("Space");
  await open("Public catalog");
  await stage.getByRole("heading", { name: "Product catalog" }).waitFor();
  assert.equal(await stage.getByText("Sample tray").count(), 0);
  await open("Staff directory");
  await row().getByRole("button", { name: "Publication status", pressed: false }).click();
  await open("Public catalog");
  await card.getByText("Oak").waitFor();
  assert.equal(await detail.getAttribute("href"), "/en/products/sample-tray");
  await detail.click();
  await stage.getByRole("heading", { name: "Sample tray", level: 1 }).waitFor();
  await stage.getByRole("link", { name: "Back to products" }).click();
  await open("Staff directory");
  const remove = row().getByRole("button", { name: "Delete product" });
  const dialog = page.getByRole("dialog", { name: "Delete product" });
  await remove.click();
  await dialog.getByText("Permanently delete “Sample tray”?").waitFor();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "hidden" });
  await row().waitFor();
  await showControls();
  await fail.check();
  await remove.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("alert").getByText("Could not delete. Try again.").waitFor();
  await page.locator("tr").filter({ hasText: "Sample tray" }).waitFor({ state: "attached" });
  assert.equal(await dialog.getByRole("button", { name: "Delete", exact: true }).isEnabled(), true);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await showControls();
  await fail.uncheck();
  await remove.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await row().waitFor({ state: "detached" });
  await open("Public catalog");
  await stage.getByRole("heading", { name: "Product catalog" }).waitFor();
  assert.equal(await card.count(), 0);
  assert.deepEqual(errors, []);
});

await test("Products directory restores URL sort and recovers failed visibility changes", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/admin/products");
  const stage = page.getByRole("main", { name: "Component preview" });
  await assertActionSizes(stage, 32);
  const nameHeader = stage.getByRole("columnheader", { name: "Name" });
  await nameHeader.getByRole("button").click();
  await page.waitForURL(/productsSort=name.desc/);
  await page.reload();
  assert.equal(await nameHeader.getAttribute("aria-sort"), "descending");
  assert.equal(await stage.getByRole("rowheader").first().innerText(), "Pencil case");
  const priceHeader = stage.getByRole("columnheader", { name: "Price" });
  await priceHeader.getByRole("button").click();
  await page.waitForURL(/productsSort=priceMinor.asc/);
  await page.goBack();
  await page.waitForURL(/productsSort=name.desc/);
  assert.equal(await nameHeader.getAttribute("aria-sort"), "descending");
  await page.goForward();
  await page.waitForURL(/productsSort=priceMinor.asc/);
  assert.equal(await priceHeader.getAttribute("aria-sort"), "ascending");
  const row = stage.getByRole("row").filter({ hasText: "Pencil case" });
  const fail = page.getByRole("checkbox", { name: "Simulate a failed save" });
  await fail.check();
  const badge = row.getByRole("button", { name: "Publication status" });
  await badge.click();
  await row.getByRole("alert").waitFor();
  assert.equal(await badge.getAttribute("aria-pressed"), "false");
  assert.equal(await badge.innerText(), "Private");
  await fail.uncheck();
  await row.getByRole("button", { name: "Publication status", pressed: false }).click();
  await row.getByRole("button", { name: "Publication status", pressed: true }).waitFor();
  await page.goto(base + "/fr/products");
  await stage.getByRole("heading", { name: "Carnet en lin" }).waitFor();
  await stage.getByText("Un carnet relié en toile aux pages sans lignes.").waitFor();
});

await test("Products search restores the directory and count from its URL", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/admin/products?productsPage=2");
  const stage = page.getByRole("main", { name: "Component preview" });
  await stage.getByRole("button", { name: "Search products" }).click();
  const search = stage.getByRole("searchbox", { name: "Search products" });
  await search.fill("linen");
  await page.waitForURL(
    (url) =>
      url.searchParams.get("productsSearch") === "linen" && !url.searchParams.has("productsPage"),
  );
  await page.reload();
  await stage.getByRole("link", { name: "Linen notebook" }).waitFor();
  assert.equal(await search.inputValue(), "linen");
  assert.equal(await stage.getByRole("rowheader").count(), 1);
  await stage.getByText("1 product", { exact: true }).waitFor();
  await stage.getByRole("link", { name: "Linen notebook" }).click();
  await stage.getByRole("heading", { name: "Edit product" }).waitFor();
  await page.goBack();
  await stage.getByText("1 product", { exact: true }).waitFor();
  assert.equal(await search.inputValue(), "linen");
  await page.goForward();
  await stage.getByRole("heading", { name: "Edit product" }).waitFor();
  await page.goBack();
  await stage.getByRole("button", { name: "Clear product search" }).click();
  await stage.getByText("2 products", { exact: true }).waitFor();
});

await test("Published product deep links resolve IDs and slugs with or without a locale", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ javaScriptEnabled: false, locale: "fr" });
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const id = "a44eec85-9fed-4455-a2e4-ae84fef3bd72";
  const slug = "linen-notebook";
  for (const path of [
    "/products/" + id,
    "/fr/products/" + id,
    "/products/" + slug,
    "/fr/products/" + slug,
  ]) {
    await page.goto("about:blank");
    const response = await page.goto(base + path + "?ref=catalog#details");
    assert.equal(response.status(), 200);
    assert.equal(page.url(), base + "/fr/products/" + slug + "?ref=catalog#details");
    await page.getByRole("heading", { name: "Carnet en lin", level: 1 }).waitFor();
    assert.match(await page.locator("article").innerText(), /120/);
    assert.doesNotMatch(await response.text(), /Pencil case/);
  }
  await page.getByRole("link", { name: "Back to products" }).click();
  const link = page.getByRole("link", { name: "Carnet en lin" });
  assert.equal(await link.getAttribute("href"), "/fr/products/" + slug);
  await link.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Carnet en lin", level: 1 }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Product catalog" }).waitFor();
  for (const key of ["bc6d89e3-0747-462d-9bc7-aae0d3969120", "does-not-exist"]) {
    assert.equal((await page.goto(base + "/en/products/" + key)).status(), 404);
    await page.getByRole("heading", { name: "Page not found" }).waitFor();
  }
});

await test("Product photos can be uploaded, removed and browsed on a phone", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await page.goto(base + "/en/admin/products");
  const stage = page.getByRole("main", { name: "Component preview" });
  await stage.getByRole("link", { name: "Linen notebook" }).click();
  const banner = stage.getByRole("group", { name: "Banner image", exact: true });
  const gallery = stage.getByRole("group", { name: "Product photos", exact: true });
  await banner.locator("input[type=file]").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("invalid image"),
  });
  await banner.getByRole("alert").waitFor();
  assert.match(await banner.locator("img").getAttribute("src"), /linen-notebook.jpg$/);
  await banner.getByRole("button", { name: "Remove photo — Banner image" }).click();
  await gallery.getByRole("button", { name: "Remove photo — Photo 2" }).click();
  await gallery
    .getByLabel("Add photo", { exact: true })
    .setInputFiles("public/showroom/products/linen-notebook.jpg");
  await gallery
    .getByRole("group", { name: "Photo 2" })
    .getByRole("textbox", { name: "Image description" })
    .fill("Replacement cover");
  await stage.getByRole("button", { name: "Save", exact: true }).click();
  await stage.getByRole("link", { name: "Create" }).waitFor();
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
  await page.getByRole("link", { name: "Public catalog", exact: true }).click();
  await stage.getByRole("img", { name: "Closed notebook with a natural linen cover" }).waitFor();
  await stage.getByRole("link", { name: "Linen notebook" }).click();
  const slider = stage.getByRole("region", { name: "Product photos" });
  await slider.getByText("1 / 2").waitFor();
  assert.equal(await stage.locator("article > img").count(), 0);
  await slider.getByRole("button", { name: "Next photo" }).press("Enter");
  await slider.getByText("2 / 2").waitFor();
  const image = slider.getByRole("img", { name: "Replacement cover" });
  assert.equal(
    await image.evaluate(async (el) => {
      await el.decode();
      return el.naturalWidth > 0;
    }),
    true,
  );
  await slider.getByRole("button", { name: "Previous photo" }).click();
  await slider.getByText("1 / 2").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

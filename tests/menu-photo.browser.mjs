import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

await test("a cropped dish photo can be saved during creation and enabled for the menu", async (t) => {
  const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}/en/admin/menus`);
  const lunch = page.getByRole("region", { name: "Lunch menu", exact: true });
  await lunch.scrollIntoViewIfNeeded();
  await lunch.getByRole("link", { name: "Dish", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Name *", exact: true }).fill("Roasted pumpkin");
  await page.getByRole("checkbox", { name: "Visible on menu" }).check();

  const drop = await page.evaluateHandle(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 40;
    const context = canvas.getContext("2d");
    context.fillStyle = "orange";
    context.fillRect(0, 0, 60, 40);
    const bytes = await new Promise((resolve) => canvas.toBlob(resolve));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "pumpkin.png", { type: "image/png" }));
    return data;
  });
  await page.locator("[data-menu-photo-drop]").dispatchEvent("drop", { dataTransfer: drop });
  await drop.dispose();
  const crop = page.getByRole("dialog", { name: "Crop image" });
  await crop.getByRole("button", { name: "Use as photo", exact: true }).click();
  await crop.waitFor({ state: "hidden" });
  const preview = page.getByRole("img", { name: "Photo", exact: true });
  await preview.waitFor();
  assert.match(await preview.getAttribute("src"), /^blob:/);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const suggestion = page.getByRole("dialog", { name: "Show photos in this menu?" });
  await suggestion.getByRole("button", { name: "Show photos", exact: true }).click();
  await suggestion.waitFor({ state: "hidden" });
  assert.match(new URL(page.url()).pathname, /\/menu\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/?$/);
  await preview.waitFor();
  assert.match(await preview.getAttribute("src"), /^blob:/);
  assert.equal(await page.getByRole("checkbox", { name: "Visible on menu" }).isChecked(), true);
  assert.equal(await page.getByRole("textbox", { name: "Price (CHF)" }).inputValue(), "");

  await page.getByText("Additional private images", { exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: /pumpkin-.*\.webp/ })
    .waitFor();
  await page.getByRole("link", { name: "Menu presentation settings" }).click();
  const settings = page.getByRole("dialog", { name: /Menu settings.*Lunch menu/ });
  assert.equal(await settings.getByRole("combobox", { name: "Display" }).inputValue(), "photos");
});

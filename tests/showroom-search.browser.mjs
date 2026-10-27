import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

await test("global search supports both shortcuts, matching, keyboard navigation and focus recovery", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/?category=Plugin&search=blog`);
  const originalURL = page.url();
  const pageSearch = page.getByRole("searchbox", { name: "Search examples", exact: true });
  const dialog = page.getByRole("dialog", { name: "Search registry", exact: true });
  const input = page.getByRole("searchbox", { name: "Search registry examples" });
  const links = dialog.getByRole("list", { name: "Search results" }).getByRole("link");
  const isFocused = async (locator) => {
    await locator.and(page.locator(":focus")).waitFor();
    return true;
  };

  for (const shortcut of ["Meta+k", "Control+k"]) {
    await pageSearch.focus();
    await page.keyboard.press(shortcut);
    await dialog.waitFor();
    assert.equal(await isFocused(input), true);
    assert.equal(await dialog.getByText("Search the registry", { exact: true }).isVisible(), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await isFocused(pageSearch), true);
    assert.equal(page.url(), originalURL);
    assert.equal(await pageSearch.inputValue(), "blog");
  }

  const trigger = page.getByRole("button", { name: "Search registry", exact: true });
  await trigger.click();
  const bounds = await dialog.boundingBox();
  await input.fill("  BOOKING   plugin ");
  assert.equal(await links.count(), 1);
  assert.match(await links.first().textContent(), /Reservations/);
  await input.fill("sticky supporting");
  assert.match(await links.first().textContent(), /Content sidebar layout/);
  await input.fill("no-such-component");
  assert.equal(await links.count(), 0);
  assert.equal(await dialog.getByText("0 results", { exact: true }).isVisible(), true);
  await input.press("Enter");
  assert.equal(page.url(), originalURL);
  assert.deepEqual(await dialog.boundingBox(), bounds);
  await dialog.getByRole("button", { name: "Clear search", exact: true }).click();
  assert.equal(await input.inputValue(), "");
  assert.equal(await isFocused(input), true);

  await input.fill("plugin");
  assert.ok((await links.count()) > 2);
  await input.press("ArrowDown");
  assert.equal(await isFocused(links.first()), true);
  for (const shortcut of ["Meta+k", "Control+k"]) {
    await page.keyboard.press(shortcut);
    assert.equal(await isFocused(input), true);
    assert.equal(await input.inputValue(), "plugin");
    await input.press("ArrowDown");
  }
  await page.keyboard.press("ArrowDown");
  assert.equal(await isFocused(links.nth(1)), true);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await isFocused(input), true);
  await input.press("ArrowUp");
  assert.equal(await isFocused(links.last()), true);
  await page.keyboard.press("ArrowDown");
  assert.equal(await isFocused(input), true);
  await input.fill("lightbox");
  await input.press("Enter");
  await page.waitForURL("**/lightbox");
  await dialog.waitFor({ state: "hidden" });
  await page.goBack();
  assert.equal(page.url(), originalURL);
  assert.equal(await pageSearch.inputValue(), "blog");
  await page.goForward();
  await page.waitForURL("**/lightbox");

  await page.goto(`${baseURL}/en/customers/acme`);
  const company = page.getByRole("textbox", { name: "Company name", exact: true });
  await company.fill("Keep my draft");
  await page.keyboard.press("Control+k");
  await dialog.waitFor();
  await input.fill("draft");
  await dialog.getByRole("button", { name: "Close search", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await company.inputValue(), "Keep my draft");
  await trigger.click();
  assert.equal(await input.inputValue(), "");
  await page.mouse.click(2, 2);
  await dialog.waitFor({ state: "hidden" });

  // Capture both themes and sizes in one visual review pass.
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    for (const [size, width] of [
      ["desktop", 1440],
      ["mobile", 390],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await trigger.click();
      if (theme === "light" && size === "desktop") {
        await page.screenshot({ path: "/tmp/forge-search-empty.png" });
      }
      await input.fill("plugin");
      const popup = await dialog.boundingBox();
      assert.ok(popup.x >= 0 && popup.x + popup.width <= width);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: `/tmp/forge-search-${theme}-${size}.png` });
      await input.press("Shift+Tab");
      assert.equal(await isFocused(links.last()), true);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    }
  }
  assert.deepEqual(errors, []);
});

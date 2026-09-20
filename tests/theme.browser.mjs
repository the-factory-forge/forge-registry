import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function palette(page) {
  return page.evaluate(() => {
    const names = [
      "background",
      "foreground",
      "primary",
      "primary-foreground",
      "input",
      "ring",
      "dark",
      "dark-foreground",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "sidebar",
    ];
    const probe = document.createElement("div");
    document.body.append(probe);
    const colors = Object.fromEntries(
      names.map((name) => {
        probe.style.backgroundColor = `var(--${name})`;
        return [name, getComputedStyle(probe).backgroundColor];
      }),
    );
    probe.remove();
    return colors;
  });
}

test("the showroom defaults to light without scripts, with no system mode", async (t) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "dark" });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(baseURL);
  const light = await palette(page);
  assert.equal(light.primary, "rgb(19, 52, 58)");
  assert.equal(light.background, "rgb(255, 255, 255)");
  assert.equal(light.input, "rgba(0, 0, 0, 0.28)");
  for (const value of Object.values(light)) assert.notEqual(value, "rgba(0, 0, 0, 0)");
  await page.emulateMedia({ colorScheme: "light" });
  assert.deepEqual(await palette(page), light);
  assert.equal(await page.getByRole("button", { name: "System", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Font", exact: true }).count(), 0);
});

test("shared theme persists across previews, reloads, tabs and portaled dialogs", async (t) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/en/admin/blogs/categories`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const darkButton = page.getByRole("button", { name: "Dark", exact: true });
  assert.equal(
    await page.getByRole("button", { name: "Light", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await darkButton.click();
  const dark = await palette(page);
  assert.equal(dark.primary, "rgb(186, 222, 222)");
  assert.equal(dark.background, "rgb(0, 0, 0)");
  await page.getByRole("button", { name: "Inside the studio", exact: true }).click();
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(0, 0, 0)",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "All components", exact: true }).click();
  await page.waitForURL(`${baseURL}/`);
  assert.deepEqual(await palette(page), dark);
  await page.reload();
  assert.equal(await darkButton.getAttribute("aria-pressed"), "true");
  await page.emulateMedia({ colorScheme: "light" });
  assert.deepEqual(await palette(page), dark);
  const second = await context.newPage();
  await second.goto(`${baseURL}/en/employees`);
  await second.locator('[data-preview-ready="true"]').waitFor();
  assert.deepEqual(await palette(second), dark);
  await second.getByRole("button", { name: "Light", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("light"));
  assert.equal((await palette(page)).primary, "rgb(19, 52, 58)");
  assert.equal(await page.locator("html").getAttribute("style"), null);
  assert.deepEqual(errors, []);
});

test("theme selection works when storage is unavailable", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal((await palette(page)).primary, "rgb(186, 222, 222)");
  await page.locator('a[href="/en/projects"]').click();
  assert.equal((await palette(page)).primary, "rgb(186, 222, 222)");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  assert.equal((await palette(page)).primary, "rgb(19, 52, 58)");
  assert.deepEqual(errors, []);
});

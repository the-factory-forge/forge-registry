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

test("showroom colors follow the system without scripts and explicit modes override it", async (t) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(baseURL);
  const light = await palette(page);
  assert.equal(light.primary, "rgb(19, 52, 58)");
  assert.equal(light.background, "rgb(255, 255, 255)");
  assert.equal(light.input, "rgba(0, 0, 0, 0.28)");
  for (const value of Object.values(light)) assert.notEqual(value, "rgba(0, 0, 0, 0)");
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await palette(page);
  assert.equal(dark.primary, "rgb(186, 222, 222)");
  assert.equal(dark.background, "rgb(0, 0, 0)");
  assert.equal(dark.input, "rgba(255, 255, 255, 0.28)");
  assert.equal(dark["dark-foreground"], light["dark-foreground"]);
  await page.evaluate(() => document.documentElement.classList.add("light"));
  assert.deepEqual(await palette(page), light);
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.classList.replace("light", "dark"));
  assert.deepEqual(await palette(page), dark);
});

test("blog mode includes portaled dialogs and is restored when leaving the preview", async (t) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/en/admin/blogs/categories`);
  await page.locator('[data-blogs-ready="true"]').waitFor();
  const toggle = page.getByLabel("Dark theme", { exact: true });
  assert.equal(await toggle.isChecked(), true);
  const dark = await palette(page);
  await toggle.uncheck();
  await page.waitForFunction(() => document.documentElement.classList.contains("light"));
  assert.equal((await palette(page)).primary, "rgb(19, 52, 58)");
  await page.getByRole("button", { name: "Inside the studio", exact: true }).click();
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await toggle.check();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(0, 0, 0)",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "All components", exact: true }).click();
  await page.waitForURL(`${baseURL}/`);
  assert.equal(
    await page
      .locator("html")
      .evaluate(
        (element) => element.classList.contains("dark") || element.classList.contains("light"),
      ),
    false,
  );
  assert.deepEqual(await palette(page), dark);
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal((await palette(page)).primary, "rgb(19, 52, 58)");
  assert.equal(await page.locator("html").getAttribute("style"), null);
  assert.deepEqual(errors, []);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

let server, browser, url;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  url = `${server.resolvedUrls.local[0]}tests/fixtures/section-anchor.html?view=profile`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function atSection(page, id) {
  await page.waitForFunction((target) => {
    const top = document.getElementById(target)?.getBoundingClientRect().top;
    return top >= 64 && top <= 81;
  }, id);
  assert.equal(new URL(page.url()).hash, `#${encodeURIComponent(id)}`);
  assert.equal(new URL(page.url()).search, "?view=profile");
}

for (const [width, colorScheme] of [
  [1280, "light"],
  [390, "dark"],
]) {
  void test(`title links preserve drafts, reload, sharing and history at ${width}px`, async (t) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      colorScheme,
      reducedMotion: "reduce",
    });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    const personal = "factory-personal-information";
    await page.getByLabel("Unsaved name").fill("Unsaved draft");
    const link = page.getByRole("link", { name: personal, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await atSection(page, personal);
    assert.equal(await page.getByLabel("Unsaved name").inputValue(), "Unsaved draft");
    await page.evaluate(() => window.scrollTo(0, 0));
    await link.click();
    await atSection(page, personal);
    await page.reload();
    await atSection(page, personal);
    await page.getByRole("link", { name: "factory-résumé", exact: true }).click();
    await atSection(page, "factory-résumé");
    await page.goBack();
    assert.equal(new URL(page.url()).hash, `#${personal}`);
    await page.goForward();
    assert.equal(new URL(page.url()).hash, "#factory-r%C3%A9sum%C3%A9");
    const shared = await page.context().newPage();
    await shared.goto(page.url());
    await atSection(shared, "factory-résumé");
    await shared.close();
    for (const hash of ["#missing", "#%E0%A4%A"]) {
      await page.goto(url + hash);
      await link.waitFor();
      assert.equal(await link.getAttribute("href"), "#factory-personal-information");
    }
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  });
}

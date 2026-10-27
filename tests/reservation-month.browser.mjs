import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

let server, browser, base;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
async function fixture(t, query) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/reservation-month.html?${query}`);
  await page.locator("button[aria-pressed][aria-label]").first().waitFor();
  return page;
}
const requests = (page, count) =>
  page.waitForFunction((n) => window.monthTest.requests.length === n, count);
const daily = (page, count) =>
  page.waitForFunction((n) => window.monthTest.daily.length === n, count);
const resolve = (page, index, value) =>
  page.evaluate(([i, v]) => window.monthTest.resolve(i, v), [index, value]);
const ready = (page) => page.locator('[aria-busy="false"]:has(> button[aria-pressed])').waitFor();

for (const staff of [false, true]) {
  void test(`${staff ? "staff" : "guest"} appointment creation batches the grid but keeps selected-day reads`, async (t) => {
    const page = await fixture(t, staff ? "staff" : "");
    await requests(page, 1);
    await daily(page, 1);
    assert.equal(await page.locator("button[aria-pressed][aria-label]:disabled").count(), 42);
    await resolve(page, 0, true);
    await ready(page);
    await page
      .locator('button[aria-pressed][aria-label]:enabled:not([aria-pressed="true"])')
      .first()
      .click();
    await daily(page, 2);
    assert.equal(await page.evaluate(() => window.monthTest.requests.length), 1);
    await page
      .getByRole("combobox", { name: "Practitioner or resource", exact: true })
      .selectOption("10000000-0000-4000-8000-000000000001");
    await requests(page, 2);
    await daily(page, 3);
    await resolve(page, 1, true);
    await ready(page);
    const service = page.getByRole("combobox", { name: "Service", exact: true });
    await service.selectOption({ index: 1 });
    await requests(page, 3);
    await daily(page, 4);
    const queries = await page.evaluate(() => window.monthTest.requests.map((r) => r.query));
    assert.notEqual(queries[1].resourceId, queries[0].resourceId);
    assert.notEqual(queries[2].serviceId, queries[1].serviceId);
    await resolve(page, 2, true);
    await ready(page);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await requests(page, 4);
    assert.equal(await page.evaluate(() => window.monthTest.daily.length), 4);
  });

  void test(`${staff ? "staff" : "guest"} legacy host uses the daily fallback`, async (t) => {
    const page = await fixture(t, `legacy${staff ? "&staff" : ""}`);
    await daily(page, 43);
    await ready(page);
    assert.equal(await page.evaluate(() => window.monthTest.requests.length), 0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await daily(page, 85);
    await ready(page);
  });
}

void test("failed batches retry without daily fallback; old months cannot replace the current result", async (t) => {
  const page = await fixture(t, "");
  await requests(page, 1);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await requests(page, 2);
  await resolve(page, 1, true);
  await ready(page);
  assert.equal(await page.locator("button[aria-pressed][aria-label]:enabled").count(), 42);
  await resolve(page, 0, false);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  assert.equal(await page.locator("button[aria-pressed][aria-label]:enabled").count(), 42);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await requests(page, 3);
  await page.evaluate(() => window.monthTest.requests[2].reject());
  await page.getByRole("button", { name: "Refresh", exact: true }).waitFor();
  assert.equal(await page.locator("button[aria-pressed][aria-label]:disabled").count(), 42);
  assert.equal(await page.evaluate(() => window.monthTest.daily.length), 1);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await requests(page, 4);
  await resolve(page, 3, true);
  await ready(page);
  assert.equal(await page.locator("button[aria-pressed][aria-label]:enabled").count(), 42);
});

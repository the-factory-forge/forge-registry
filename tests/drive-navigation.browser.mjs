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
async function fixture(t) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await page.goto(`${base}tests/fixtures/drive-navigation.html`);
  await row(page, "Report.txt").waitFor();
  return page;
}
const row = (page, name) => page.getByRole("row").filter({ hasText: name });
const navigation = (page) =>
  page.getByRole("navigation", { name: "Drive navigation", exact: true });
async function leave(page) {
  await page.evaluate(() => window.navigationTest.openFolder());
  await page.getByRole("heading", { name: "Other folder", exact: true }).first().waitFor();
}
void test("folder navigation preserves the sidebar DOM", async (t) => {
  const page = await fixture(t);
  const sidebar = await navigation(page).elementHandle();
  const reads = await page.evaluate(
    () => window.navigationTest.reads.filter((read) => read.tree && read.parentId === null).length,
  );
  await leave(page);
  assert.equal(await sidebar.evaluate((node) => node.isConnected), true);
  assert.equal(
    await page.evaluate(
      () =>
        window.navigationTest.reads.filter((read) => read.tree && read.parentId === null).length,
    ),
    reads,
  );
});

void test("folder navigation cancels old uploads without running queued files in the new folder", async (t) => {
  const page = await fixture(t);
  const file = (name) => ({ name, mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page
    .locator('input[type="file"]')
    .setInputFiles([file("old-a.txt"), file("old-b.txt"), file("queued.txt")]);
  await page.waitForFunction(
    () => window.navigationTest.uploads.filter((job) => job.resolve).length === 2,
  );
  await leave(page);
  await page.waitForFunction(() => window.navigationTest.uploads.every((job) => job.aborted));
  await page.locator('[aria-busy="false"] table').waitFor();
  await page.locator('input[type="file"]').setInputFiles(file("new.txt"));
  await page.waitForFunction(() => window.navigationTest.uploads[2]?.resolve);
  const reads = await page.evaluate(() => window.navigationTest.reads.length);
  await page.evaluate(() => {
    window.navigationTest.uploads[0].resolve();
    window.navigationTest.uploads[1].resolve();
  });
  await page.waitForFunction(() =>
    window.navigationTest.uploads.slice(0, 2).every((job) => job.cancelled),
  );
  const result = await page.evaluate(() => ({
    jobs: window.navigationTest.uploads.map(({ input, completed }) => ({
      name: input.name,
      parentId: input.parentId,
      completed: !!completed,
    })),
    reads: window.navigationTest.reads.length,
  }));
  assert.deepEqual(result, {
    jobs: [
      { name: "old-a.txt", parentId: null, completed: false },
      { name: "old-b.txt", parentId: null, completed: false },
      { name: "new.txt", parentId: "other", completed: false },
    ],
    reads,
  });
  await page.evaluate(() => window.navigationTest.uploads[2].resolve());
  await page.waitForFunction(() => window.navigationTest.uploads[2].completed);
});

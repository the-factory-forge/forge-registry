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
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/drive-uploads.html`);
  await page.waitForFunction(() => !!window.uploadTest);
  return page;
}
async function add(page, count = 1, directory = false) {
  await page.evaluate(
    ([n, folder]) => {
      const files = Array.from({ length: n }, (_, i) => {
        const file = new File(["contents"], `file-${i}.txt`, { type: "text/plain" });
        if (folder)
          Object.defineProperty(file, "webkitRelativePath", { value: `Folder/${file.name}` });
        return file;
      });
      window.uploadTest.queue.add(files, 1000, "destination", folder);
    },
    [count, directory],
  );
}
const state = (page, value) =>
  page.waitForFunction((s) => window.uploadTest.queue.uploads[0]?.state === s, value);
const snapshot = (page) =>
  page.evaluate(() => {
    const { uploads, finished, loading } = window.uploadTest.queue;
    return { uploads, finished, loading };
  });
const action = (page, name) => page.getByRole("button", { name, exact: true }).click();
async function actions(page, names) {
  assert.deepEqual(
    await page.getByRole("listitem").first().getByRole("button").allTextContents(),
    names,
  );
}

void test("preparation cancellation keeps cleanup retry and NOT_FOUND recovery in the queue", async (t) => {
  const page = await fixture(t);
  await add(page);
  await state(page, "uploading");
  await actions(page, ["Cancel"]);
  await action(page, "Cancel");
  await state(page, "cancelling");
  await actions(page, []);
  await page.evaluate(() => window.uploadTest.prepare(0));
  await page.waitForFunction(() => window.uploadTest.cancellations.length === 1);
  await page.evaluate(() => window.uploadTest.failCancellation(0));
  await state(page, "cancelFailed");
  await actions(page, ["Retry"]);
  assert.equal((await snapshot(page)).loading, false);
  assert.equal((await snapshot(page)).finished, false);
  await action(page, "Retry");
  await state(page, "cancelling");
  await page.evaluate(() => window.uploadTest.failCancellation(1, true));
  await state(page, "cancelled");
  await actions(page, ["Dismiss"]);
  const result = await snapshot(page);
  assert.equal(result.finished, true);
  assert.equal(result.uploads[0].failed, false);
  assert.equal(result.uploads[0].error, undefined);
  assert.deepEqual(
    await page.evaluate(() => ({
      ids: window.uploadTest.cancellations.map((r) => r.id),
      transfers: window.uploadTest.transfers.length,
    })),
    { ids: [result.uploads[0].id, result.uploads[0].id], transfers: 0 },
  );
  await action(page, "Dismiss");
  await page.waitForFunction(() => window.uploadTest.queue.uploads.length === 0);
});

void test("an uncertain PUT verifies completion and exposes only presentation data", async (t) => {
  const page = await fixture(t);
  await add(page);
  await page.evaluate(() => window.uploadTest.prepare(0));
  await page.waitForFunction(() => window.uploadTest.transfers.length === 1);
  await page.evaluate(() => window.uploadTest.transfers[0].progress(65));
  await page.waitForFunction(() => window.uploadTest.queue.uploads[0].progress === 65);
  await page.evaluate(() => window.uploadTest.failTransfer(0));
  await state(page, "finishing");
  await actions(page, []);
  assert.equal((await snapshot(page)).loading, true);
  await page.evaluate(() => {
    window.uploadTest.queue.cancel(window.uploadTest.queue.uploads[0].id);
    window.uploadTest.completions[0].resolve();
  });
  await state(page, "done");
  await actions(page, ["Dismiss"]);
  const result = await snapshot(page);
  assert.equal(result.uploads[0].progress, 100);
  assert.equal(result.uploads[0].name, "file-0.txt");
  for (const key of ["file", "parentId", "controller", "reserved", "busy", "cancelled"])
    assert.equal(key in result.uploads[0], false);
  assert.equal(result.finished, true);
  assert.equal(result.loading, false);
  assert.equal(await page.evaluate(() => window.uploadTest.refreshes()), 1);
  assert.equal(await page.evaluate(() => window.uploadTest.cancellations.length), 0);
});

void test("directory preparation retry retains the request and accepts an already completed ticket", async (t) => {
  const page = await fixture(t);
  await add(page, 1, true);
  await page.evaluate(() => window.uploadTest.failPreparation(0));
  await state(page, "failed");
  await actions(page, ["Retry", "Cancel"]);
  assert.equal((await snapshot(page)).uploads[0].failed, true);
  await page.getByText("Folder/file-0.txt", { exact: true }).waitFor();
  await action(page, "Retry");
  await page.waitForFunction(() => window.uploadTest.preparations.length === 2);
  const inputs = await page.evaluate(() => window.uploadTest.preparations.map((r) => r.input));
  assert.deepEqual(inputs[0], inputs[1]);
  assert.equal(inputs[1].parentId, "destination");
  assert.equal(inputs[1].relativePath, "Folder/file-0.txt");
  await page.evaluate(() => window.uploadTest.prepare(1, true));
  await state(page, "done");
  assert.equal(await page.evaluate(() => window.uploadTest.transfers.length), 0);
  assert.equal(await page.evaluate(() => window.uploadTest.completions.length), 0);
});

void test("two active jobs leave the third queued; unmount cancels pending preparation without stale refresh", async (t) => {
  const page = await fixture(t);
  await add(page, 3);
  await page.waitForFunction(() => window.uploadTest.preparations.length === 2);
  const result = await snapshot(page);
  assert.deepEqual(
    result.uploads.map((u) => u.state),
    ["uploading", "uploading", "queued"],
  );
  assert.ok(result.uploads.every((u) => u.canCancel && !u.canRetry && !u.canDismiss));
  await page.evaluate(() => {
    window.uploadTest.unmount();
    window.uploadTest.prepare(0);
    window.uploadTest.prepare(1);
  });
  await page.waitForFunction(() => window.uploadTest.cancellations.length === 2);
  await page.evaluate(() => window.uploadTest.cancellations.forEach((r) => r.resolve()));
  assert.equal(await page.getByRole("dialog", { name: "Uploads", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.uploadTest.preparations.length), 2);
  assert.equal(await page.evaluate(() => window.uploadTest.transfers.length), 0);
  assert.equal(await page.evaluate(() => window.uploadTest.refreshes()), 0);
});

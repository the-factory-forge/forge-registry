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
async function fixture(t, kind = "table") {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/bulk-deletion.html?kind=${kind}`);
  await page.waitForFunction(() => !!window.bulkTest);
  return page;
}
const dialog = (page) => page.getByRole("dialog", { name: /^Delete/ });
const confirm = (page) => dialog(page).getByRole("button", { name: "Delete", exact: true });
async function open(page, auth = false) {
  await page
    .getByRole("checkbox", { name: auth ? "Select all keys" : "Select all rows", exact: true })
    .check();
  await page
    .getByRole("button", { name: auth ? /^Delete selected keys \(/ : /^Delete selected items \(/ })
    .click();
}
const waitCalls = (page, count) =>
  page.waitForFunction((n) => window.bulkTest.calls.length === n, count);
const waitPreviews = (page, count) =>
  page.waitForFunction((n) => window.bulkTest.previewCount() === n, count);

void test("scope changes cancel loading and ready previews, ignoring stale completion", async (t) => {
  const page = await fixture(t, "table&preview");
  await open(page);
  await waitPreviews(page, 1);
  await page.evaluate(() => window.bulkTest.changeView());
  await dialog(page).waitFor({ state: "hidden" });
  await open(page);
  await waitPreviews(page, 2);
  await page.evaluate(() => window.bulkTest.resolvePreview(0, "stale preview"));
  assert.equal(await confirm(page).count(), 0);
  await page.evaluate(() => window.bulkTest.resolvePreview(1, "current preview"));
  await dialog(page).getByText("current preview", { exact: true }).waitFor();
  assert.equal(await dialog(page).getByText("stale preview").count(), 0);
  await page.evaluate(() => window.bulkTest.changeView());
  await dialog(page).waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.bulkTest.calls), []);
});

void test("confirmed batches finish using original targets and callbacks across host page resets", async (t) => {
  const page = await fixture(t);
  await open(page);
  await confirm(page).click();
  await waitCalls(page, 1);
  await page.evaluate(() => {
    window.bulkTest.remove("alpha");
    window.bulkTest.changeView();
  });
  await page.keyboard.press("Escape");
  assert.equal(await dialog(page).isVisible(), true);
  await page.evaluate(() => window.bulkTest.resolve(0));
  await waitCalls(page, 2);
  await page.evaluate(() => window.bulkTest.resolve(1));
  await dialog(page).waitFor({ state: "hidden" });
  assert.deepEqual(
    await page.evaluate(() => window.bulkTest.calls.map(({ id, view }) => ({ id, view }))),
    [
      { id: "alpha", view: 0 },
      { id: "beta", view: 0 },
    ],
  );
});

void test("a failed confirmed batch retains retry and its original callback context after a page reset", async (t) => {
  const page = await fixture(t);
  await open(page);
  await confirm(page).click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.changeView());
  await page.evaluate(() => window.bulkTest.reject(0));
  await waitCalls(page, 2);
  await page.evaluate(() => window.bulkTest.resolve(1));
  await dialog(page).getByRole("alert").waitFor();
  await confirm(page).click();
  await waitCalls(page, 3);
  assert.equal(await page.locator('[aria-label="Select Alpha"]').count(), 1);
  assert.deepEqual(
    await page.evaluate(() => window.bulkTest.calls.map(({ id, view }) => ({ id, view }))),
    [
      { id: "alpha", view: 0 },
      { id: "beta", view: 0 },
      { id: "alpha", view: 0 },
    ],
  );
  await page.evaluate(() => window.bulkTest.resolve(2));
  await dialog(page).waitFor({ state: "hidden" });
});

void test("remounting a table control cannot start another batch while its abandoned request is pending", async (t) => {
  const page = await fixture(t);
  await open(page);
  await confirm(page).click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.showControl(false));
  await dialog(page).waitFor({ state: "hidden" });
  await page.evaluate(() => window.bulkTest.showControl(true));
  const trigger = page.getByRole("button", { name: /^Delete selected items \(/ });
  assert.equal(await trigger.isDisabled(), true);
  await page.evaluate(() => window.bulkTest.resolve(0));
  await page.waitForFunction(
    () => !document.querySelector('button[aria-label^="Delete selected items"]').disabled,
  );
  assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 1);
  await trigger.click();
  await confirm(page).click();
  await waitCalls(page, 2);
  await page.evaluate(() => window.bulkTest.resolve(1));
  await waitCalls(page, 3);
  await page.evaluate(() => window.bulkTest.resolve(2));
  await dialog(page).waitFor({ state: "hidden" });
});

for (const kind of ["table", "auth"]) {
  void test(`${kind}: unmount stops later deletions and retries only failed records`, async (t) => {
    const page = await fixture(t, kind);
    await open(page, kind === "auth");
    await confirm(page).click();
    await waitCalls(page, 1);
    if (kind === "auth") assert.equal(await page.locator("tbody tr").count(), 2);
    await page.evaluate(() => window.bulkTest.resolve(0));
    await waitCalls(page, 2);
    await page.evaluate(() => window.bulkTest.reject(1));
    await dialog(page).getByRole("alert").waitFor();
    assert.equal(await dialog(page).getByText("Alpha", { exact: true }).count(), 0);
    await confirm(page).click();
    await waitCalls(page, 3);
    const calls = await page.evaluate(() => window.bulkTest.calls);
    assert.deepEqual(
      calls.map(({ id }) => id),
      ["alpha", "beta", "beta"],
    );
    assert.equal(calls[1].requestId, calls[2].requestId);
    await page.evaluate(() => {
      window.bulkTest.showControl(false);
    });
    await dialog(page).waitFor({ state: "hidden" });
    await page.evaluate(() => window.bulkTest.resolve(2));
    await page.evaluate(() => window.bulkTest.showControl(true));
    await open(page, kind === "auth");
    await confirm(page).click();
    await waitCalls(page, 4);
    if (kind === "table")
      assert.notEqual(
        (await page.evaluate(() => window.bulkTest.calls[3])).requestId,
        calls[0].requestId,
      );
    await page.evaluate(() => window.bulkTest.showControl(false));
    await dialog(page).waitFor({ state: "hidden" });
    await page.evaluate(() => window.bulkTest.resolve(3));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 4);
  });
}

void test("failed re-preparation blocks deletion until explicit preview retry and confirmation", async (t) => {
  const page = await fixture(t, "table&preview");
  await open(page);
  await waitPreviews(page, 1);
  await page.evaluate(() => window.bulkTest.resolvePreview(0, "initial preview"));
  await confirm(page).click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.reject(0));
  await waitCalls(page, 2);
  await page.evaluate(() => window.bulkTest.resolve(1));
  await waitPreviews(page, 2);
  await page.evaluate(() => window.bulkTest.rejectPreview(1));
  await dialog(page).getByRole("button", { name: "Try again", exact: true }).click();
  await waitPreviews(page, 3);
  assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 2);
  await page.evaluate(() => window.bulkTest.resolvePreview(2, "fresh preview"));
  await confirm(page).click();
  await waitCalls(page, 3);
  const calls = await page.evaluate(() => window.bulkTest.calls);
  assert.deepEqual(
    calls.map(({ id }) => id),
    ["alpha", "beta", "alpha"],
  );
  assert.equal(calls[0].requestId, calls[2].requestId);
  await page.evaluate(() => window.bulkTest.resolve(2));
  await dialog(page).waitFor({ state: "hidden" });
});

void test("Drive keeps the latest preview tokens when old previews finish last", async (t) => {
  const page = await fixture(t, "drive");
  await open(page);
  await waitPreviews(page, 2);
  await page.evaluate(() => window.bulkTest.changeView());
  await dialog(page).waitFor({ state: "hidden" });
  await open(page);
  await waitPreviews(page, 4);
  await page.evaluate(() => {
    window.bulkTest.resolvePreview(2, "current-alpha");
    window.bulkTest.resolvePreview(3, "current-beta");
  });
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).waitFor();
  await page.evaluate(() => {
    window.bulkTest.resolvePreview(0, "stale-alpha");
    window.bulkTest.resolvePreview(1, "stale-beta");
  });
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.resolve(0));
  await waitCalls(page, 2);
  assert.deepEqual(
    await page.evaluate(() => window.bulkTest.calls.map(({ requestId }) => requestId)),
    ["current-alpha", "current-beta"],
  );
  await page.evaluate(() => window.bulkTest.resolve(1));
  await dialog(page).waitFor({ state: "hidden" });
});

const singleDialog = (page) => page.getByRole("dialog");
const singleConfirm = (page, trash = false) =>
  singleDialog(page).getByRole("button", {
    name: trash ? "Move to trash" : "Delete permanently",
    exact: true,
  });
async function openSingle(page) {
  await page.getByRole("button", { name: "Delete", exact: true }).click();
}

for (const trash of [false, true]) {
  void test(`Drive single ${trash ? "trash" : "delete"} waits for an early confirmation exactly once`, async (t) => {
    const page = await fixture(t, trash ? "single&trash" : "single");
    await openSingle(page);
    await waitPreviews(page, 1);
    const button = singleConfirm(page, trash);
    assert.equal(await button.isEnabled(), true);
    assert.equal(
      await singleDialog(page).getByRole("button", { name: "Cancel", exact: true }).isEnabled(),
      true,
    );
    await button.evaluate((node) => {
      node.click();
      node.click();
    });
    assert.equal(await button.isEnabled(), false);
    assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 0);
    await page.evaluate(() => window.bulkTest.resolvePreview(0, "original"));
    await waitCalls(page, 1);
    assert.equal(await page.evaluate(() => window.bulkTest.calls[0].requestId), "original");
    await page.evaluate(() => window.bulkTest.resolve(0));
    await singleDialog(page).waitFor({ state: "hidden" });
  });
}

void test("Drive single retry keeps ordinary failures' tokens but refreshes conflicts without an extra confirmation", async (t) => {
  const page = await fixture(t, "single");
  await openSingle(page);
  await waitPreviews(page, 1);
  await page.evaluate(() => window.bulkTest.resolvePreview(0, "original"));
  await singleConfirm(page).click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.reject(0, "STORAGE"));
  await singleDialog(page).getByRole("alert").waitFor();
  await singleConfirm(page).click();
  await waitCalls(page, 2);
  assert.equal(await page.evaluate(() => window.bulkTest.previewCount()), 1);
  assert.equal(await page.evaluate(() => window.bulkTest.calls[1].requestId), "original");
  await page.evaluate(() => window.bulkTest.reject(1, "CONFLICT"));
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  assert.equal(await page.evaluate(() => window.bulkTest.previewCount()), 1);
  await singleConfirm(page).click();
  await waitPreviews(page, 2);
  assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 2);
  await page.evaluate(() => window.bulkTest.resolvePreview(1, "fresh", 3));
  await waitCalls(page, 3);
  assert.equal(await page.evaluate(() => window.bulkTest.calls[2].requestId), "fresh");
  await page.evaluate(() => window.bulkTest.resolve(2));
  await singleDialog(page).waitFor({ state: "hidden" });
});

void test("Drive single preview failure retries preparation and deletion in the same confirmation", async (t) => {
  const page = await fixture(t, "single");
  await openSingle(page);
  await waitPreviews(page, 1);
  await page.evaluate(() => window.bulkTest.rejectPreview(0));
  await singleDialog(page).getByRole("alert").waitFor();
  await singleConfirm(page).click();
  await waitPreviews(page, 2);
  await page.evaluate(() => window.bulkTest.resolvePreview(1, "retry"));
  await waitCalls(page, 1);
  assert.equal(await page.evaluate(() => window.bulkTest.calls[0].requestId), "retry");
  await page.evaluate(() => window.bulkTest.resolve(0));
  await singleDialog(page).waitFor({ state: "hidden" });
});

void test("Drive single cancellation and reopening ignore an older preview", async (t) => {
  const page = await fixture(t, "single");
  await openSingle(page);
  await waitPreviews(page, 1);
  await singleDialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await singleDialog(page).waitFor({ state: "hidden" });
  await openSingle(page);
  await waitPreviews(page, 2);
  await page.evaluate(() => window.bulkTest.resolvePreview(1, "current", 3));
  await singleDialog(page)
    .getByText(/3 file\(s\)/)
    .waitFor();
  await page.evaluate(async () => {
    window.bulkTest.resolvePreview(0, "stale");
    await new Promise(requestAnimationFrame);
  });
  await singleDialog(page)
    .getByText(/3 file\(s\)/)
    .waitFor();
  await singleConfirm(page).click();
  await waitCalls(page, 1);
  assert.equal(await page.evaluate(() => window.bulkTest.calls[0].requestId), "current");
  await page.evaluate(() => window.bulkTest.resolve(0));
  await singleDialog(page).waitFor({ state: "hidden" });
});

void test("Drive bulk failure refreshes only failed tokens and waits for reconfirmation", async (t) => {
  const page = await fixture(t, "drive");
  await open(page);
  await waitPreviews(page, 2);
  const button = dialog(page).getByRole("button", { name: "Delete permanently", exact: true });
  assert.equal(
    await dialog(page).getByRole("button", { name: "Please wait…", exact: true }).isEnabled(),
    false,
  );
  await page.evaluate(() => {
    window.bulkTest.resolvePreview(0, "alpha-original");
    window.bulkTest.resolvePreview(1, "beta-original");
  });
  await button.click();
  await waitCalls(page, 1);
  await page.evaluate(() => window.bulkTest.reject(0, "CONFLICT"));
  await waitCalls(page, 2);
  assert.equal(await page.evaluate(() => window.bulkTest.calls[1].requestId), "beta-original");
  await page.evaluate(() => window.bulkTest.resolve(1));
  await waitPreviews(page, 3);
  await page.evaluate(() => window.bulkTest.resolvePreview(2, "alpha-fresh", 3));
  await button.waitFor();
  assert.equal(await page.evaluate(() => window.bulkTest.calls.length), 2);
  await button.click();
  await waitCalls(page, 3);
  assert.deepEqual(
    await page.evaluate(() => window.bulkTest.calls.map(({ id, requestId }) => [id, requestId])),
    [
      ["alpha", "alpha-original"],
      ["beta", "beta-original"],
      ["alpha", "alpha-fresh"],
    ],
  );
  await page.evaluate(() => window.bulkTest.resolve(2));
  await dialog(page).waitFor({ state: "hidden" });
});

void test("Drive confirmed bulk retry keeps its original scope and callbacks across a view change", async (t) => {
  const page = await fixture(t, "drive");
  await open(page);
  await waitPreviews(page, 2);
  await page.evaluate(() => {
    window.bulkTest.resolvePreview(0, "alpha-original");
    window.bulkTest.resolvePreview(1, "beta-original");
  });
  const button = dialog(page).getByRole("button", { name: "Delete permanently", exact: true });
  await button.click();
  await waitCalls(page, 1);
  await page.evaluate(() => {
    window.bulkTest.changeView();
    window.bulkTest.reject(0, "CONFLICT");
  });
  await waitCalls(page, 2);
  await page.evaluate(() => window.bulkTest.resolve(1));
  await waitPreviews(page, 3);
  await page.evaluate(() => window.bulkTest.resolvePreview(2, "alpha-fresh"));
  await button.click();
  await waitCalls(page, 3);
  assert.deepEqual(
    await page.evaluate(() => window.bulkTest.calls.map(({ view, scope }) => [view, scope])),
    [
      [0, "0"],
      [0, "0"],
      [0, "0"],
    ],
  );
  assert.equal(await page.evaluate(() => window.bulkTest.calls[2].requestId), "alpha-fresh");
  await page.evaluate(() => window.bulkTest.resolve(2));
  await dialog(page).waitFor({ state: "hidden" });
});

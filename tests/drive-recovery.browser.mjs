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
  await page.goto(`${base}tests/fixtures/drive-recovery.html`);
  await row(page, "Report.txt").waitFor();
  return page;
}
const row = (page, name) => page.getByRole("row").filter({ hasText: name });
const navigation = (page) =>
  page.getByRole("navigation", { name: "Drive navigation", exact: true });
const trash = (page) =>
  navigation(page).getByRole("button", { name: "Trash", exact: true }).click();
const files = (page) =>
  navigation(page).getByRole("link", { name: "Recovery space", exact: true }).click();
const calls = (page, count) =>
  page.waitForFunction((n) => window.recoveryTest.calls.length === n, count);
const settle = (page, index, code) =>
  page.evaluate(
    async ([i, code]) => {
      if (code) window.recoveryTest.calls[i].reject(code);
      else window.recoveryTest.calls[i].resolve();
      await new Promise(requestAnimationFrame);
    },
    [index, code],
  );
async function remove(page) {
  await row(page, "Report.txt").getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Move files and folders to trash", exact: true })
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
}
async function undoReady(page) {
  await remove(page);
  await calls(page, 1);
  await settle(page, 0);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.waitFor();
  await undo.hover();
  return undo;
}
async function leave(page, destination) {
  await page.evaluate((where) => window.recoveryTest.leave(where), destination);
  if (destination === "unmount")
    await page.locator('nav[aria-label="Drive navigation"]').waitFor({ state: "detached" });
  else
    await page.waitForFunction(
      (destination) =>
        window.recoveryTest.reads.some((r) =>
          destination === "space"
            ? r.scope === "second"
            : document.body.textContent.includes("Other folder"),
        ),
      destination,
    );
}
for (const destination of ["unmount", "folder", "space"]) {
  void test(`a trash completion after ${destination} cannot create another Undo control`, async (t) => {
    const page = await fixture(t);
    await remove(page);
    await calls(page, 1);
    await leave(page, destination);
    await settle(page, 0);
    assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).count(), 0);
    assert.equal(
      await page.getByText("Files and folders moved to trash.", { exact: true }).count(),
      0,
    );
  });
}
for (const code of [undefined, "STORAGE", "RESTORE_CONFLICT"]) {
  void test(`a departed Undo completion is silent (${code ?? "success"})`, async (t) => {
    const page = await fixture(t);
    await (await undoReady(page)).click();
    await calls(page, 2);
    await leave(page, "unmount");
    await settle(page, 1, code);
    assert.equal(await page.getByRole("dialog").count(), 0);
  });
}
void test("Undo survives view changes, uses the latest client for retry, and keeps submitted work on its original client", async (t) => {
  const page = await fixture(t);
  const undo = await undoReady(page);
  await trash(page);
  await row(page, "Report.txt").waitFor();
  await undo.click();
  await calls(page, 2);
  await page.evaluate(() => window.recoveryTest.replaceClient());
  await page.waitForFunction(() =>
    window.recoveryTest.reads.some((r) => r.adapter === "B" && r.kind === "trash"),
  );
  await settle(page, 1, "STORAGE");
  await undo.click();
  await calls(page, 3);
  assert.deepEqual(
    await page.evaluate(() => window.recoveryTest.calls.map((call) => [call.kind, call.adapter])),
    [
      ["trash", "A"],
      ["restore", "A"],
      ["restore", "B"],
    ],
  );
  await settle(page, 2);
  await row(page, "Report.txt").waitFor({ state: "hidden" });
  await files(page);
  await row(page, "Report.txt").waitFor();
});
void test("a restore started in Trash survives Files and returns its conflict dialog and draft for retry", async (t) => {
  const page = await fixture(t);
  await trash(page);
  await row(page, "Archived.txt").getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 1);
  await files(page);
  await row(page, "Report.txt").waitFor();
  await settle(page, 0, "RESTORE_CONFLICT");
  const dialog = page.getByRole("dialog", { name: "Restore files and folders", exact: true });
  await dialog.waitFor();
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Recovered.txt");
  await page.evaluate(() => window.recoveryTest.replaceClient());
  await dialog.getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 2);
  await settle(page, 1, "STORAGE");
  assert.equal(
    await dialog.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Recovered.txt",
  );
  await dialog.getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 3);
  await settle(page, 2);
  await dialog.waitFor({ state: "hidden" });
  await row(page, "Recovered.txt").waitFor();
  assert.deepEqual(
    await page.evaluate(() => window.recoveryTest.calls.map((call) => call.adapter)),
    ["A", "B", "B"],
  );
});
for (const destination of ["unmount", "folder", "space"]) {
  for (const code of [undefined, "STORAGE", "RESTORE_CONFLICT"]) {
    void test(`direct restore completion after ${destination} is silent (${code ?? "success"})`, async (t) => {
      const page = await fixture(t);
      await trash(page);
      await row(page, "Archived.txt").getByRole("button", { name: "Restore", exact: true }).click();
      await calls(page, 1);
      await leave(page, destination);
      await settle(page, 0, code);
      assert.equal(await page.getByRole("dialog").count(), 0);
    });
  }
}

void test("confirmed Trash deletion survives a view switch and retries only failed records", async (t) => {
  const page = await fixture(t);
  await page.evaluate(() => window.recoveryTest.addTrash());
  await trash(page);
  await row(page, "Archived.txt").getByRole("checkbox").check();
  await row(page, "Second archive.txt").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Delete selected items (2)", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete selected items?", exact: true });
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await calls(page, 1);
  // A host can change the view while the confirmation dialog owns focus.
  await page
    .locator('nav[aria-label="Drive navigation"] a')
    .filter({ hasText: "Recovery space" })
    .evaluate((link) => link.click());
  await settle(page, 0);
  await calls(page, 2);
  await settle(page, 1, "STORAGE");
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByRole("listitem").filter({ hasText: "Archived.txt" }).count(), 0);
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await calls(page, 3);
  assert.deepEqual(
    await page.evaluate(() => window.recoveryTest.calls.map((call) => call.input.entryId)),
    ["archived", "second-archive", "second-archive"],
  );
  await settle(page, 2);
  await dialog.waitFor({ state: "hidden" });
  await row(page, "Report.txt").waitFor();
  await trash(page);
  assert.equal(await row(page, "Second archive.txt").count(), 0);
});

void test("Trash search survives Files and Trash view switches", async (t) => {
  const page = await fixture(t);
  await trash(page);
  await page.getByRole("button", { name: "Search trash", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search trash", exact: true });
  await search.fill("Archived");
  await files(page);
  await trash(page);
  assert.equal(await search.inputValue(), "Archived");
  await row(page, "Archived.txt").waitFor();
});

void test("view switches retain a pending restore and clear unconfirmed selections", async (t) => {
  const page = await fixture(t);
  await trash(page);
  await row(page, "Archived.txt").getByRole("checkbox").check();
  await files(page);
  await trash(page);
  assert.equal(await row(page, "Archived.txt").getByRole("checkbox").isChecked(), false);
  await row(page, "Archived.txt").getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 1);
  await files(page);
  await trash(page);
  await row(page, "Archived.txt").waitFor({ state: "hidden" });
  await files(page);
  await settle(page, 0);
  await row(page, "Archived.txt").waitFor();
  assert.equal(await page.evaluate(() => window.recoveryTest.calls.length), 1);
});

void test("bulk trash completion after unmount cannot create an orphan Undo", async (t) => {
  const page = await fixture(t);
  await row(page, "Report.txt").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Delete selected items (1)", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete selected items?", exact: true })
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await calls(page, 1);
  await leave(page, "unmount");
  await settle(page, 0);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

void test("permanent deletion from Trash cannot notify after leaving Drive", async (t) => {
  const page = await fixture(t);
  await trash(page);
  await row(page, "Archived.txt").getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete files and folders", exact: true })
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await calls(page, 1);
  await leave(page, "unmount");
  await settle(page, 0);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

void test("conflict-dialog restore cannot notify after leaving Drive", async (t) => {
  const page = await fixture(t);
  await trash(page);
  await row(page, "Archived.txt").getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 1);
  await settle(page, 0, "RESTORE_CONFLICT");
  const dialog = page.getByRole("dialog", { name: "Restore files and folders", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Recovered.txt");
  await dialog.getByRole("button", { name: "Restore", exact: true }).click();
  await calls(page, 2);
  await leave(page, "unmount");
  await settle(page, 1);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

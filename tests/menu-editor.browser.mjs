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
const name = (page) => page.getByRole("textbox", { name: "Name *", exact: true });
const save = (page) => page.getByRole("button", { name: "Save", exact: true });
async function fixture(t) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await page.goto(`${base}tests/fixtures/menu-editor.html`);
  await name(page).waitFor();
  return page;
}
const calls = (page, count) =>
  page.waitForFunction((n) => window.menuEditorTest.calls.length === n, count);
const settle = (page, index, success = true) =>
  page.evaluate(
    async ([i, ok]) => {
      window.menuEditorTest.calls[i][ok ? "resolve" : "reject"]();
      await new Promise(requestAnimationFrame);
    },
    [index, success],
  );

for (const change of ["item", "client"]) {
  for (const success of [true, false]) {
    void test(`${change} replacement resets the editor and ignores old save ${success ? "success" : "failure"}`, async (t) => {
      const page = await fixture(t);
      await name(page).fill("Old draft");
      await save(page).click();
      await calls(page, 1);
      await page.evaluate((change) => {
        window.menuEditorTest.select(
          change === "item" ? "second" : "first",
          change === "client" ? "B" : "A",
        );
      }, change);
      await page.waitForFunction(
        () => document.querySelector('input[aria-label="Name *"]').value !== "Old draft",
      );
      assert.equal(await name(page).inputValue(), change === "item" ? "A second" : "B first");
      await save(page).click();
      await calls(page, 2);
      await settle(page, 0, success);
      assert.equal(
        await page.getByRole("button", { name: "Saving…", exact: true }).isDisabled(),
        true,
      );
      assert.equal(await page.getByText("Saved.", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.deepEqual(await page.evaluate(() => window.menuEditorTest.saved), []);
      await settle(page, 1);
      await save(page).waitFor();
      assert.equal(await page.evaluate(() => window.menuEditorTest.saved.length), 1);
    });
  }
}

void test("returning to the same item/client creates a fresh editor; unmount ignores a pending create", async (t) => {
  const page = await fixture(t);
  await name(page).fill("Old draft");
  await save(page).click();
  await calls(page, 1);
  await page.evaluate(() => window.menuEditorTest.select("second", "B"));
  await page.waitForFunction(
    () => document.querySelector('input[aria-label="Name *"]').value === "B second",
  );
  await page.evaluate(() => window.menuEditorTest.select("first"));
  await page.waitForFunction(
    () => document.querySelector('input[aria-label="Name *"]').value === "A first",
  );
  await settle(page, 0);
  assert.deepEqual(await page.evaluate(() => window.menuEditorTest.saved), []);
  assert.equal(await page.getByText("Saved.", { exact: true }).count(), 0);
  await page.evaluate(() => window.menuEditorTest.select());
  await page.getByRole("heading", { name: "New item", exact: true }).waitFor();
  assert.equal(await name(page).inputValue(), "");
  await name(page).fill("New dish");
  await save(page).click();
  await calls(page, 2);
  await page.evaluate(() => window.menuEditorTest.unmount());
  await name(page).waitFor({ state: "hidden" });
  await settle(page, 1);
  assert.deepEqual(await page.evaluate(() => window.menuEditorTest.saved), []);
  assert.equal(await page.getByText("Saved.", { exact: true }).count(), 0);
});

void test("refresh and folder navigation preserve drafts and versions; edits during save survive success and retry", async (t) => {
  const page = await fixture(t);
  await name(page).fill("Submitted draft");
  await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).fill("12.34");
  await page.evaluate(() => {
    window.menuEditorTest.refresh();
    window.menuEditorTest.folder();
  });
  assert.equal(await name(page).inputValue(), "Submitted draft");
  assert.equal(
    await page.getByRole("textbox", { name: "Price (CHF)", exact: true }).inputValue(),
    "12.34",
  );
  await save(page).click();
  await calls(page, 1);
  await name(page).fill("Typed while saving");
  await settle(page, 0);
  await save(page).waitFor();
  assert.equal(await name(page).inputValue(), "Typed while saving");
  await save(page).click();
  await calls(page, 2);
  await settle(page, 1, false);
  await save(page).waitFor();
  assert.equal(await name(page).inputValue(), "Typed while saving");
  assert.equal(await page.getByRole("alert").count(), 1);
  await save(page).click();
  await calls(page, 3);
  const inputs = await page.evaluate(() =>
    window.menuEditorTest.calls.map(({ version, input }) => ({
      version,
      name: input.translations.en.name,
      price: input.priceMinor,
    })),
  );
  assert.deepEqual(inputs, [
    { version: 1, name: "Submitted draft", price: 1234 },
    { version: 2, name: "Typed while saving", price: 1234 },
    { version: 2, name: "Typed while saving", price: 1234 },
  ]);
  await settle(page, 2);
  await save(page).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
});

void test("the portable menu editor protects native reloads without a host router", async (t) => {
  const page = await fixture(t);
  await name(page).fill("Keep through reload");
  const warnings = [];
  page.on("dialog", async (warning) => {
    warnings.push(warning.type());
    await warning.dismiss();
  });
  const warning = page.waitForEvent("dialog");
  await page.evaluate(() => location.reload());
  await warning;
  assert.equal(await name(page).inputValue(), "Keep through reload");
  assert.deepEqual(warnings, ["beforeunload"]);
});

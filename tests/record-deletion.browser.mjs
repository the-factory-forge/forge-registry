import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

let server;
let browser;
let base;
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
async function fixture(t, kind, options = {}) {
  const page = await browser.newPage({ reducedMotion: "reduce", ...options });
  page.setDefaultTimeout(10000);
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}tests/fixtures/record-deletion.html?kind=${kind}`);
  await page.waitForFunction(() => !!window.deletionTest);
  return page;
}
const trigger = (page, kind) =>
  page
    .getByRole("button", {
      name: kind.startsWith("customer") ? "Delete customer" : "Delete project",
      exact: true,
    })
    .first();
const dialog = (page) => page.getByRole("dialog", { name: /^Delete (customer|project)$/ });
const confirm = (page) => dialog(page).getByRole("button", { name: "Delete", exact: true });
const row = (page, name) => page.locator("tbody tr").filter({ hasText: name });

for (const kind of ["customers", "projects"]) {
  void test(`${kind}: refresh updates the name, and removal or scope changes dismiss unsubmitted confirmation`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await page.evaluate(() => window.deletionTest.rename("alpha", "Renamed Alpha"));
    await dialog(page)
      .getByText("Delete Renamed Alpha? This action cannot be undone.", { exact: true })
      .waitFor();
    await page.evaluate(() => window.deletionTest.changeView());
    await dialog(page).waitFor({ state: "hidden" });
    await trigger(page, kind).click();
    await page.evaluate(() => window.deletionTest.remove("alpha"));
    await dialog(page).waitFor({ state: "hidden" });
    await page.locator("section[tabindex='-1']:focus").waitFor();
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), []);
  });

  void test(`${kind}: submitted deletion survives early source removal and focuses the list on success`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await confirm(page).click();
    await row(page, "Alpha").waitFor({ state: "detached" });
    await page.waitForFunction(() => window.deletionTest.calls.length === 1);
    await page.evaluate(() => window.deletionTest.rename("alpha", "Renamed Alpha"));
    await dialog(page).getByText("Delete Renamed Alpha? This action cannot be undone.").waitFor();
    await page.evaluate(() => {
      window.deletionTest.remove("alpha");
      window.deletionTest.rename("beta", "Updated Beta");
      window.deletionTest.changeView();
    });
    assert.equal(await dialog(page).isVisible(), true);
    await dialog(page).getByText("Delete Renamed Alpha? This action cannot be undone.").waitFor();
    assert.equal(
      await dialog(page).getByRole("button", { name: "Cancel", exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      await dialog(page).getByRole("button", { name: "Close", exact: true }).isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await dialog(page).isVisible(), true);
    await page.evaluate(() => window.deletionTest.resolve());
    await dialog(page).waitFor({ state: "hidden" });
    await page.locator("section[tabindex='-1']:focus").waitFor();
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), ["alpha"]);
    assert.equal(await row(page, "Alpha").count(), 0);
    await row(page, "Updated Beta").waitFor();
  });

  void test(`${kind}: rejection preserves current host data and retry targets the same record`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await confirm(page).click();
    await row(page, "Alpha").waitFor({ state: "detached" });
    await page.evaluate(() => {
      window.deletionTest.rename("alpha", "Renamed Alpha");
      window.deletionTest.rename("beta", "Updated Beta");
      window.deletionTest.reject();
    });
    await dialog(page).getByRole("alert").waitFor();
    await row(page, "Renamed Alpha").waitFor();
    await row(page, "Updated Beta").waitFor();
    await confirm(page).click();
    await page.waitForFunction(() => window.deletionTest.calls.length === 2);
    await page.evaluate(() => {
      window.deletionTest.remove("alpha");
      window.deletionTest.resolve();
    });
    await dialog(page).waitFor({ state: "hidden" });
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), ["alpha", "alpha"]);
  });

  void test(`${kind}: failed submitted deletion cannot resurrect or retry an absent target`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await confirm(page).click();
    await page.waitForFunction(() => window.deletionTest.calls.length === 1);
    await page.evaluate(() => {
      window.deletionTest.remove("alpha");
      window.deletionTest.reject();
    });
    await dialog(page).getByRole("alert").waitFor();
    assert.equal(await row(page, "Alpha").count(), 0);
    assert.equal(await confirm(page).isDisabled(), true);
    await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.locator("section[tabindex='-1']:focus").waitFor();
  });
}

for (const kind of ["customer-form", "project-form"]) {
  void test(`${kind}: losing the trigger dismisses an unsubmitted confirmation and restores form focus`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await page.evaluate(() => window.deletionTest.remove("alpha"));
    await dialog(page).waitFor({ state: "hidden" });
    await page.locator("form:focus").waitFor();
    await trigger(page, kind).click();
    await page.evaluate(() => window.deletionTest.revoke());
    await dialog(page).waitFor({ state: "hidden" });
    await page.locator("form:focus").waitFor();
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), []);
  });

  void test(`${kind}: switching records during submission keeps the original target without stale retry`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).click();
    await confirm(page).click();
    await page.waitForFunction(() => window.deletionTest.calls.length === 1);
    await page.evaluate(() => {
      window.deletionTest.remove("alpha");
      window.deletionTest.revoke();
      window.deletionTest.reject();
    });
    await dialog(page).getByRole("alert").waitFor();
    assert.equal(await confirm(page).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), ["alpha"]);
    await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.locator("form:focus").waitFor();
  });

  void test(`${kind}: keyboard cancel restores the trigger and failure retains the form for retry`, async (t) => {
    const page = await fixture(t, kind);
    await trigger(page, kind).focus();
    await page.keyboard.press("Enter");
    await dialog(page)
      .getByRole("button", { name: "Cancel", exact: true })
      .and(page.locator(":focus"))
      .waitFor();
    await page.keyboard.press("Escape");
    await trigger(page, kind).and(page.locator(":focus")).waitFor();
    await trigger(page, kind).click();
    await page.evaluate(() => window.deletionTest.rename("alpha", "Renamed Alpha"));
    await dialog(page)
      .getByText("Delete Renamed Alpha? This action cannot be undone.", { exact: true })
      .waitFor();
    await confirm(page).click();
    await page.waitForFunction(() => window.deletionTest.calls.length === 1);
    await page.locator("fieldset[disabled]").waitFor();
    await page.evaluate(() => window.deletionTest.reject());
    await dialog(page).getByRole("alert").waitFor();
    await confirm(page).click();
    await page.waitForFunction(() => window.deletionTest.calls.length === 2);
    await page.evaluate(() => window.deletionTest.resolve());
    await dialog(page).waitFor({ state: "hidden" });
    assert.deepEqual(await page.evaluate(() => window.deletionTest.calls), ["alpha", "alpha"]);
    assert.equal(await page.locator("fieldset").getAttribute("disabled"), null);
  });
}

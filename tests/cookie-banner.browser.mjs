import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const consentKey = "forge-cookie-banner-preview";
const denied = { necessary: true, analytics: false, marketing: false };
const granted = { necessary: true, analytics: true, marketing: true };
let browser;

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function openPreview(t, initScript) {
  const context = await browser.newContext();
  t.after(() => context.close());
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}/cookie-banner`);
  return { context, page, dialog: page.getByRole("dialog", { name: "Cookies" }) };
}

async function expectApplied(page, analytics, marketing) {
  const text = `Analytics: ${analytics ? "granted" : "denied"}; marketing: ${marketing ? "granted" : "denied"}`;
  await page
    .getByRole("status", { name: "Applied cookie preferences" })
    .filter({ hasText: text })
    .waitFor();
  const update = await page.evaluate(() => window.dataLayer.at(-1));
  assert.deepEqual(update, [
    "consent",
    "update",
    {
      ad_storage: marketing ? "granted" : "denied",
      analytics_storage: analytics ? "granted" : "denied",
      ad_user_data: marketing ? "granted" : "denied",
      ad_personalization: marketing ? "granted" : "denied",
    },
  ]);
}

function storedConsent(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), consentKey);
}

const reopen = (page) => page.getByRole("button", { name: "Open cookie banner" }).click();
const customize = (dialog) => dialog.getByRole("button", { name: "Custom selection" }).click();

test("compact actions, custom selection, and saved preferences work", async (t) => {
  const { page, dialog } = await openPreview(t);
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("checkbox").count(), 0);
  assert.deepEqual(await dialog.getByRole("button").allTextContents(), [
    "Custom selection",
    "Accept all",
  ]);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox").count(), 3);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Necessary/ }).isDisabled(), true);
  assert.deepEqual(await dialog.getByRole("button").allTextContents(), [
    "Cancel",
    "Confirm selection",
  ]);
  await expectApplied(page, false, false);

  await dialog.getByRole("checkbox", { name: /^Statistics/ }).check();
  await expectApplied(page, false, false); // Draft changes must not grant consent.
  assert.equal(await storedConsent(page), null);
  await dialog.getByRole("button", { name: "Confirm selection" }).click();
  await expectApplied(page, true, false);
  assert.deepEqual(await storedConsent(page), { ...denied, analytics: true });

  await page.reload();
  await expectApplied(page, true, false); // The host also receives saved consent on hydration.
  assert.equal(await dialog.isVisible(), false);
  await reopen(page);
  assert.equal(await dialog.getByRole("checkbox").count(), 0);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Statistics/ }).isChecked(), true);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Marketing/ }).isChecked(), false);
  await dialog.getByRole("checkbox", { name: /^Marketing/ }).check();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await customize(dialog); // Unsaved edits must not replace the saved preference.
  assert.equal(await dialog.getByRole("checkbox", { name: /^Marketing/ }).isChecked(), false);

  await dialog.getByRole("checkbox", { name: /^Statistics/ }).uncheck();
  await dialog.getByRole("button", { name: "Confirm selection" }).click();
  await expectApplied(page, false, false);
  assert.deepEqual(await storedConsent(page), denied);
  await reopen(page);
  await dialog.getByRole("button", { name: "Accept all" }).click();
  await expectApplied(page, true, true);
  assert.deepEqual(await storedConsent(page), granted);
});

test("unavailable categories are denied on restore and Accept all", async (t) => {
  const { page, dialog } = await openPreview(t);
  await dialog.getByRole("button", { name: "Accept all" }).click();
  await page.getByRole("checkbox", { name: "Offer marketing cookies" }).uncheck();
  await expectApplied(page, true, false);
  await reopen(page);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Marketing/ }).count(), 0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.getByRole("button", { name: "Accept all" }).click();
  assert.deepEqual(await storedConsent(page), { ...denied, analytics: true });

  await page.getByRole("checkbox", { name: "Offer analytics cookies" }).uncheck();
  await expectApplied(page, false, false);
  await reopen(page);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox").count(), 1);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.getByRole("button", { name: "Accept all" }).click();
  assert.deepEqual(await storedConsent(page), denied);
});

test("saved changes and cleared consent synchronize across tabs", async (t) => {
  const { context, page, dialog } = await openPreview(t);
  const secondPage = await context.newPage();
  await secondPage.goto(`${baseURL}/cookie-banner`);
  await expectApplied(secondPage, false, false);
  await dialog.getByRole("button", { name: "Accept all" }).click();
  await expectApplied(secondPage, true, true);
  await reopen(secondPage);
  const secondDialog = secondPage.getByRole("dialog", { name: "Cookies" });
  await customize(secondDialog);
  await secondDialog.getByRole("checkbox", { name: /^Statistics/ }).uncheck();
  await secondDialog.getByRole("checkbox", { name: /^Marketing/ }).uncheck();
  await secondDialog.getByRole("button", { name: "Confirm selection" }).click();
  await expectApplied(page, false, false);
  await secondPage.evaluate(() => localStorage.clear());
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("checkbox").count(), 0);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Statistics/ }).isChecked(), false);
});

test("invalid stored consent starts denied with visible controls", async (t) => {
  const { page, dialog } = await openPreview(t, () => {
    localStorage.setItem("forge-cookie-banner-preview", '{"analytics":"yes","marketing":true}');
  });
  await dialog.waitFor();
  await expectApplied(page, false, false);
  await customize(dialog);
  await dialog.getByRole("button", { name: "Confirm selection" }).click();
  assert.deepEqual(await storedConsent(page), denied);
});

test("blocked storage still applies consent and retains it while mounted", async (t) => {
  const { page, dialog } = await openPreview(t, () => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        value() {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      });
    }
  });
  await dialog.waitFor();
  await customize(dialog);
  await dialog.getByRole("checkbox", { name: /^Statistics/ }).check();
  await dialog.getByRole("button", { name: "Confirm selection" }).click();
  await expectApplied(page, true, false);
  await reopen(page);
  await customize(dialog);
  assert.equal(await dialog.getByRole("checkbox", { name: /^Statistics/ }).isChecked(), true);
  await dialog.getByRole("checkbox", { name: /^Statistics/ }).uncheck();
  await dialog.getByRole("button", { name: "Confirm selection" }).click();
  await expectApplied(page, false, false);
});

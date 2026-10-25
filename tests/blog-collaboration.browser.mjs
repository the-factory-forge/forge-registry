import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function confirmHistoryPublication(page) {
  const dialog = page.getByRole("dialog", { name: "Review publication", exact: true });
  await Promise.race([
    dialog.waitFor(),
    page.getByRole("dialog").filter({ hasText: "This language is now published" }).last().waitFor(),
  ]);
  if (await dialog.isVisible())
    await dialog.getByRole("button", { name: "Publish", exact: true }).click();
}
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
async function preview(t, path, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}

void test("colleagues save drafts; author/admin control publication and attribution", async (t) => {
  const page = await preview(t, "/en/admin/blogs");
  await page.getByLabel("Administrator", { exact: true }).uncheck();
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  await page.getByRole("columnheader", { name: "Author", exact: true }).waitFor();
  await page.getByRole("columnheader", { name: "Last modified by", exact: true }).waitFor();
  const row = page.getByRole("row").filter({ hasText: "Make room for better ideas" });
  assert.equal(await row.getByRole("button", { name: /^Delete:/ }).count(), 0);
  assert.equal(await row.getByRole("button", { name: /^Publication status:/ }).count(), 0);
  await row.getByRole("link", { name: "Make room for better ideas", exact: true }).click();
  assert.equal(await page.getByLabel("Author", { exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Publish", exact: true }).count(), 0);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Colleague correction");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await page.getByLabel("Editor", { exact: true }).selectOption("jordan");
  await page.getByLabel("Author", { exact: true }).selectOption("alex");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  assert.equal(await page.getByLabel("Author", { exact: true }).isDisabled(), true);
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await confirmHistoryPublication(page);
  await actionToast(page, "This language is now published");
  await page.screenshot({ path: "/private/tmp/registry-intranet-blog.png", fullPage: true });
});

void test("an admin explicitly confirms a legacy author before publication", async (t) => {
  const page = await preview(t, "/en/admin/blogs");
  await page.getByRole("link", { name: "An idea for tomorrow", exact: true }).click();
  const author = page.getByLabel("Author", { exact: true });
  assert.equal(await author.inputValue(), "");
  await page
    .getByText(
      "An administrator must select and save a confirmed author before publishing this older article.",
      { exact: true },
    )
    .waitFor();
  await page.getByLabel("Administrator", { exact: true }).uncheck();
  assert.equal(await author.isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Publish", exact: true }).count(), 0);
  await page.getByLabel("Administrator", { exact: true }).check();
  await author.selectOption("jordan");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("Reviewed legacy draft.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await confirmHistoryPublication(page);
  await actionToast(page, "This language is now published");
});

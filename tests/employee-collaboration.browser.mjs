import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";
import { openPreviewControls } from "./showroom-helpers.mjs";

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
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
  await openPreviewControls(page);
  return page;
}

void test("employee deletion reviews linked groups and retains failure feedback before retry", async (t) => {
  const page = await preview(t, "/en/employees", {
    viewport: { width: 390, height: 900 },
    colorScheme: "dark",
  });
  await page.getByLabel("Review related plugin data").check();
  await page.getByLabel("Fail deletion confirmation").check();
  await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "Delete Sam Rivera", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete employee", exact: true });
  await dialog.getByText("Blogs", { exact: true }).waitFor();
  await dialog.getByText("Affected items (1)", { exact: true }).first().click();
  const link = dialog.getByRole("link", { name: "Make room for better ideas" });
  assert.match(await link.getAttribute("href"), /admin\/blogs/);
  const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
  assert.equal(await confirm.isDisabled(), true);
  await dialog.getByLabel("Reassign articles", { exact: true }).check();
  await dialog.getByLabel("Keep pages", { exact: true }).check();
  assert.equal(await confirm.isDisabled(), true);
  await dialog.getByLabel("Replacement", { exact: true }).selectOption("admin");
  await page.screenshot({
    path: "/private/tmp/registry-intranet-delete-mobile.png",
    fullPage: true,
  });
  await confirm.click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await confirm.isDisabled(), true);
  assert.equal(
    await page.getByRole("cell", { name: "Sam Rivera", exact: true, includeHidden: true }).count(),
    1,
  );
  // Switch the demo failure before reopening; background controls are intentionally modal-inert.
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Delete Sam Rivera", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await confirm.isDisabled(), true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByLabel("Fail deletion confirmation").uncheck();
  // The bulk trigger must use the same retention flow.
  await page.getByRole("checkbox", { name: "Select row: Sam Rivera", exact: true }).check();
  await page.getByRole("button", { name: "Delete selected items", exact: true }).click();
  await dialog.getByLabel("Keep articles and their author signature", { exact: true }).check();
  await dialog.getByLabel("Keep pages", { exact: true }).check();
  await confirm.click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("cell", { name: "Sam Rivera", exact: true }).count(), 0);
});

void test("optional employee photos crop to WebP and preserve the editor on invalid input", async (t) => {
  const page = await preview(t, "/en/employees");
  await page.getByRole("button", { name: "Edit Sam Rivera", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit employee", exact: true });
  await editor.getByRole("textbox", { name: "Name", exact: true }).fill("Unsaved employee name");
  const field = editor.getByLabel("Employee photo", { exact: true });
  const choosePhoto = editor.getByRole("button", { name: "Choose photo", exact: true });
  await choosePhoto.focus();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    choosePhoto.press("Enter"),
  ]);
  await chooser.setFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  const crop = page.getByRole("dialog", { name: "Crop image", exact: true });
  await crop.getByRole("alert").waitFor();
  await crop.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await choosePhoto.isEnabled(), true);
  assert.equal(
    await editor.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Unsaved employee name",
  );
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d");
    context.fillStyle = "teal";
    context.fillRect(0, 0, 600, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await field.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes, "base64"),
  });
  await crop.getByRole("button", { name: "Use image", exact: true }).click();
  await crop.waitFor({ state: "hidden" });
  const image = editor.getByRole("img", { name: "Employee photo", exact: true });
  await image.waitFor();
  assert.equal(
    await editor.getByRole("button", { name: "Change photo", exact: true }).isEnabled(),
    true,
  );
  assert.match(await image.getAttribute("src"), /^data:image\/webp;/);
  assert.equal(await image.evaluate((element) => element.naturalWidth), 512);
  assert.equal(
    await editor.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Unsaved employee name",
  );
});

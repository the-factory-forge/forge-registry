import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";
const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t, path = "/en/drive", options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}${path}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  if (options.colorScheme === "dark")
    await page.getByRole("button", { name: "Dark", exact: true }).click();
  return page;
}
async function folder(page, name) {
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("link", { name, exact: true }).waitFor();
}
const file = (name, text = "hello") => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});
const row = (page, name) => page.getByRole("row").filter({ hasText: name });

test("Drive navigation, scoped folders, search, permissions and listing failures", async (t) => {
  const page = await preview(t);
  await page.getByRole("link", { name: "Team handbook", exact: true }).waitFor();
  for (const customer of ["Acme Studio", "Sam Rivera"])
    assert.equal(await page.getByRole("link", { name: customer, exact: true }).count(), 0);
  const search = page.getByRole("searchbox", { name: "Search spaces", exact: true });
  await search.fill("team");
  await page
    .getByRole("link", { name: "Studio website", exact: true })
    .waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Team handbook", exact: true }).click();
  await row(page, "Welcome.txt").waitFor();
  assert.equal(await page.getByRole("button", { name: "Upload files", exact: true }).count(), 0);
  await page.getByText("Read only", { exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await row(page, "Welcome.txt").getByRole("button", { name: "Download", exact: true }).click();
  await download;
  await page.getByRole("link", { name: "Back to Drive", exact: true }).click();
  await page.getByRole("link", { name: "Studio website", exact: true }).click();
  await folder(page, "Assets");
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Assets", exact: true })
    .waitFor();
  await folder(page, "Nested");
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("missing");
  await page.getByText("No matching files or folders.", { exact: true }).waitFor();
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("");
  await page.getByRole("link", { name: "Open linked record", exact: true }).click();
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await page.getByRole("link", { name: "Nested", exact: true }).waitFor();
  await page.getByLabel("Directory state").selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  await page.getByLabel("Directory state").selectOption("loading");
  await page.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await page.getByLabel("Directory state").selectOption("ready");
  await page.getByRole("link", { name: "Nested", exact: true }).waitFor();
  await page.getByRole("link", { name: "Customer directory", exact: true }).click();
  await row(page, "Acme Studio")
    .getByRole("link", { name: "Edit customer details", exact: true })
    .click();
  await page.getByRole("heading", { name: "Acme Studio", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Drive", exact: true }).count(), 0);
  await page.getByLabel("Projects integration", { exact: true }).check();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("link", { name: "Studio website", exact: true }).click();
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await page.getByRole("link", { name: "Assets", exact: true }).waitFor();
  assert.match(page.url(), /projects\/website\/drive\?customerId=acme$/);
  await page.goto(`${baseURL}/en/customers/acme/drive`);
  await page.getByRole("heading", { name: "Customer page not found", exact: true }).waitFor();
  await page.goto(`${baseURL}/en/drive/customer/acme`);
  await page
    .getByRole("alert")
    .filter({ hasText: "This space or item is no longer available" })
    .waitFor();
});

test("uploads progress independently, retry, cancel, retain failures and share embedded data", async (t) => {
  const page = await preview(t, "/en/projects/website/drive");
  await page.getByRole("button", { name: "Upload files", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles([file("one.txt"), file("two.txt"), file("three.txt")]);
  await page
    .getByRole("progressbar", { name: "Upload progress for one.txt", exact: true })
    .waitFor();
  const one = page.getByRole("listitem").filter({ hasText: "one.txt" });
  await one.getByRole("button", { name: "Retry", exact: true }).waitFor();
  await one.getByRole("button", { name: "Retry", exact: true }).click();
  for (const name of ["one.txt", "two.txt", "three.txt"]) await row(page, name).waitFor();
  assert.equal(await row(page, "one.txt").count(), 1);
  await page.locator('input[type="file"]').setInputFiles(file("cancel.txt"));
  const cancelled = page.getByRole("listitem").filter({ hasText: "cancel.txt" });
  await cancelled.getByRole("button", { name: "Cancel", exact: true }).click();
  await cancelled.getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(await row(page, "cancel.txt").count(), 0);
  await cancelled.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByRole("link", { name: "Back to Drive", exact: true }).click();
  await page.getByRole("link", { name: "Studio website", exact: true }).click();
  await row(page, "one.txt").waitFor();
  await page.getByLabel("Simulate action failures").check();
  await row(page, "one.txt").getByRole("button", { name: "Rename", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
  await dialog.getByRole("textbox").fill("draft.txt");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByRole("textbox").inputValue(), "draft.txt");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await row(page, "one.txt").getByRole("button", { name: "Rename", exact: true }).click();
  await dialog.getByRole("textbox").fill("two.txt");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "already used" }).waitFor();
  await dialog.getByRole("textbox").fill("renamed.txt");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await row(page, "renamed.txt").waitFor();
});

test("recursive deletion confirmation cancels, restores focus, and retries durable failures", async (t) => {
  const page = await preview(t, "/en/drive/project/website");
  await folder(page, "Documents");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Documents", exact: true })
    .waitFor();
  await page.locator('input[type="file"]').setInputFiles(file("nested.txt"));
  await row(page, "nested.txt").waitFor();
  await page.getByRole("link", { name: "All files", exact: true }).click();
  const trigger = row(page, "Documents").getByRole("button", { name: "Delete", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Delete files and folders", exact: true });
  await dialog.getByText(/including 1 file\(s\) and 1 folder\(s\)/).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await page.getByRole("button", { name: "Interrupt next deletion", exact: true }).click();
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "Deletion is incomplete" }).waitFor();
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("This folder is empty.", { exact: true }).waitFor();
});

test("Drive fits mobile and desktop in light and dark themes", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/workspace/handbook", {
        viewport: { width, height: 900 },
        colorScheme,
      });
      await row(page, "Welcome.txt").waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: `/tmp/forge-drive-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "Back to Drive", exact: true }).click();
      await page.getByRole("link", { name: "Studio website", exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "Space action labels must stay inside the horizontally scrolling table",
      );
      await page.close();
    }
});

test("drag-and-drop rejects folders, file lists paginate, and duplicate mutations are guarded", async (t) => {
  const page = await preview(t, "/en/drive/project/website");
  await page.getByRole("button", { name: "Upload files", exact: true }).waitFor();
  const target = page.getByText(/Drop files here or choose Upload files/).locator("..");
  const drop = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["dragged"], "dropped.txt", { type: "text/plain" }));
    return data;
  });
  await target.dispatchEvent("drop", { dataTransfer: drop });
  await row(page, "dropped.txt").waitFor();
  await target.evaluate((element) => {
    const original = Object.getOwnPropertyDescriptor(
      DataTransferItem.prototype,
      "webkitGetAsEntry",
    );
    DataTransferItem.prototype.webkitGetAsEntry = () => ({ isDirectory: true });
    try {
      const data = new DataTransfer();
      data.items.add(new File([""], "folder"));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: data }));
    } finally {
      if (original) Object.defineProperty(DataTransferItem.prototype, "webkitGetAsEntry", original);
    }
  });
  await page.getByRole("alert").filter({ hasText: "Folder uploads are not supported" }).waitFor();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
  await dialog.getByRole("textbox").fill("../invalid");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("textbox").fill("Valid");
  await dialog.getByRole("button", { name: "Create", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Valid", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Valid", exact: true }).count(), 1);
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      Array.from({ length: 10 }, (_, index) => file(`page-${index}.txt`, "x".repeat(index + 1))),
    );
  await page
    .getByRole("listitem")
    .filter({ hasText: "page-9.txt" })
    .getByText("Uploaded", { exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: "First page", exact: true }).waitFor();
  await row(page, "page-9.txt").waitFor();
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "First page", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  const names = await page.locator("tbody tr td:first-child").allTextContents();
  assert.equal(names[0].trim(), "Valid");
  assert.equal(names[1].trim(), "page-9.txt");
  assert.equal(await row(page, "page-0.txt").count(), 0);
});

test("Drive tables expose customer ownership and sort metadata with keyboard-accessible headers", async (t) => {
  const page = await preview(t);
  const table = page.getByRole("table", { name: "Drive spaces", exact: true });
  await table.waitFor();
  assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
    "Name",
    "Modified",
    "Size",
    "Owned",
    "Actions",
  ]);
  const portal = row(page, "Customer portal");
  assert.equal(await portal.getByRole("cell").nth(3).innerText(), "Acme Studio");
  assert.match(await portal.getByRole("cell").nth(2).innerText(), /232.3/);
  assert.equal(await row(page, "Team handbook").getByRole("cell").nth(3).innerText(), "—");
  assert.equal(await row(page, "Studio website").getByRole("cell").nth(1).innerText(), "—");
  const names = () => table.locator("tbody tr td:first-child a").allTextContents();
  const sortBy = async (label) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.locator('[aria-busy="false"] table').waitFor();
  };
  await sortBy("Name");
  assert.deepEqual(await names(), ["Team handbook", "Studio website", "Customer portal"]);
  await sortBy("Modified");
  assert.deepEqual(await names(), ["Customer portal", "Team handbook", "Studio website"]);
  await sortBy("Modified");
  assert.deepEqual(await names(), ["Team handbook", "Customer portal", "Studio website"]);
  await sortBy("Size");
  assert.deepEqual(await names(), ["Studio website", "Team handbook", "Customer portal"]);
  await sortBy("Size");
  assert.deepEqual(await names(), ["Customer portal", "Team handbook", "Studio website"]);
  await sortBy("Owned");
  const owner = page.getByRole("button", { name: "Owned", exact: true });
  await owner.focus();
  await page.keyboard.press("Enter");
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(await owner.evaluate((element) => element === document.activeElement), true);
  assert.equal(
    await table.getByRole("columnheader", { name: "Owned", exact: true }).getAttribute("aria-sort"),
    "descending",
  );
  assert.deepEqual(await names(), ["Customer portal", "Studio website", "Team handbook"]);
  await page.getByRole("link", { name: "Customer portal", exact: true }).click();
  await row(page, "Annual report.txt").waitFor();
  assert.equal(
    await row(page, "Annual report.txt").getByRole("cell").nth(3).innerText(),
    "Acme Studio",
  );
  const files = async () =>
    (await page.locator("tbody tr td:first-child").allTextContents()).map((name) => name.trim());
  await sortBy("Modified");
  assert.deepEqual(await files(), ["Design brief.txt", "Annual report.txt"]);
  await sortBy("Modified");
  assert.deepEqual(await files(), ["Annual report.txt", "Design brief.txt"]);
  await sortBy("Size");
  assert.deepEqual(await files(), ["Design brief.txt", "Annual report.txt"]);
  await sortBy("Size");
  assert.deepEqual(await files(), ["Annual report.txt", "Design brief.txt"]);
  await page.getByRole("link", { name: "Open linked record", exact: true }).click();
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await row(page, "Annual report.txt").waitFor();
  assert.equal(
    await row(page, "Annual report.txt").getByRole("cell").nth(3).innerText(),
    "Acme Studio",
  );
});

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
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
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
async function driveNavigation(page, name) {
  const toggle = page.getByRole("button", { name: "Drive navigation", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const navigation = page.getByRole("navigation", { name: "Drive navigation", exact: true });
  await navigation
    .getByRole(name === "All files" ? "link" : "button", { name, exact: true })
    .click();
}
const file = (name, text = "hello") => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});
const row = (page, name) => page.getByRole("row").filter({ hasText: name });

test("Drive confirmation stays available while its preview loads", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/project/portal", {
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
      });
      await row(page, "Design brief.txt").waitFor();
      const now = new Date();
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 1000));
      const trigger = row(page, "Design brief.txt").getByRole("button", {
        name: "Delete",
        exact: true,
      });
      await trigger.evaluate((button) => button.click());
      const dialog = page.getByRole("dialog", {
        name: "Move files and folders to trash",
        exact: true,
      });
      const confirm = dialog.getByRole("button", { name: "Move to trash", exact: true });
      assert.equal(
        await confirm.count(),
        1,
        "Keep the action visible while preparing confirmation",
      );
      assert.equal(await confirm.isEnabled(), true);
      const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
      assert.equal(await cancel.isEnabled(), true);
      await dialog.getByRole("status").filter({ hasText: "Loading" }).waitFor();
      const position = await confirm.boundingBox();
      await page.screenshot({ path: `/tmp/forge-delete-preview-${width}-${colorScheme}.png` });
      await page.clock.runFor(300);
      await dialog.getByText(/including 1 file\(s\) and 0 folder\(s\)/).waitFor();
      assert.deepEqual(
        await confirm.boundingBox(),
        position,
        "Preview feedback must not move the button",
      );
      await cancel.click();
      await page.clock.runFor(1000);
      await dialog.waitFor({ state: "hidden" });
      await trigger.evaluate((button) => button.click());
      await dialog.getByRole("status").filter({ hasText: "Loading" }).waitFor();
      await confirm.evaluate((button) => {
        button.click();
        button.click();
      });
      assert.equal(await confirm.isDisabled(), true);
      await dialog.getByRole("status").filter({ hasText: "Please wait" }).waitFor();
      await page.clock.runFor(1000);
      await dialog.waitFor({ state: "hidden" });
      await row(page, "Design brief.txt").waitFor({ state: "hidden" });
      await driveNavigation(page, "Trash");
      await page.clock.runFor(1000);
      await row(page, "Design brief.txt").waitFor();
      assert.equal(await row(page, "Design brief.txt").count(), 1);
      await page.close();
    }
});

test("Drive can cancel a loading preview and retry a failed confirmation", async (t) => {
  const page = await preview(t, "/en/drive/project/portal", { reducedMotion: "reduce" });
  await row(page, "Design brief.txt").waitFor();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await row(page, "Design brief.txt")
    .getByRole("button", { name: "Delete", exact: true })
    .evaluate((button) => button.click());
  const dialog = page.getByRole("dialog", { name: "Move files and folders to trash", exact: true });
  const confirm = dialog.getByRole("button", { name: "Move to trash", exact: true });
  await dialog.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.clock.runFor(1000);
  assert.equal(await row(page, "Design brief.txt").count(), 1);
  await page.getByLabel("Simulate action failures").check();
  await page.clock.runFor(1000);
  await row(page, "Design brief.txt").getByRole("button", { name: "Delete", exact: true }).click();
  await confirm.click();
  await page.clock.runFor(1000);
  await dialog.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await confirm.isEnabled(), true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByLabel("Simulate action failures").uncheck();
  await page.clock.runFor(1000);
  await row(page, "Design brief.txt").getByRole("button", { name: "Delete", exact: true }).click();
  await confirm.click();
  await page.clock.runFor(1000);
  await dialog.waitFor({ state: "hidden" });
  await row(page, "Design brief.txt").waitFor({ state: "hidden" });
  await driveNavigation(page, "Trash");
  await page.clock.runFor(1000);
  await row(page, "Design brief.txt").waitFor();
  assert.equal(await row(page, "Design brief.txt").count(), 1);
});

test("Drive keeps permitted actions visible while search results load", async (t) => {
  const page = await preview(t, "/en/drive/project/portal");
  await row(page, "Annual report.txt").waitFor();
  const newFolder = page.getByRole("button", { name: "New folder", exact: true });
  const upload = page.getByRole("button", { name: "Upload files", exact: true });
  await page.getByRole("button", { name: "Search this folder", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search this folder", exact: true });

  await page.getByLabel("Directory state").selectOption("loading");
  await search.fill("annual");
  await page.getByRole("table").getByRole("status").filter({ hasText: "Loading" }).waitFor();
  assert.equal(await newFolder.isVisible(), true);
  assert.equal(await upload.isVisible(), true);
  assert.equal(await newFolder.isDisabled(), true);
  assert.equal(await upload.isDisabled(), true);
  for (const name of ["Download", "Rename", "Delete"]) {
    const action = row(page, "Annual report.txt").getByRole("button", { name, exact: true });
    assert.equal(await action.isVisible(), true);
    assert.equal(await action.isDisabled(), true);
  }
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);

  await page.getByLabel("Directory state").selectOption("ready");
  await row(page, "Design brief.txt").waitFor({ state: "hidden" });
  assert.equal(await newFolder.isVisible(), true);
  assert.equal(await upload.isVisible(), true);
  assert.equal(await newFolder.isEnabled(), true);
  assert.equal(await upload.isEnabled(), true);
  await search.fill("missing");
  await page.getByText("No matching files or folders.", { exact: true }).waitFor();
  assert.equal(await newFolder.isVisible(), true);
  assert.equal(await upload.isVisible(), true);

  await page.getByLabel("Directory state").selectOption("error");
  await page
    .getByRole("table")
    .getByRole("alert")
    .filter({ hasText: "Storage is unavailable" })
    .waitFor();
  assert.equal(await newFolder.count(), 0);
  assert.equal(await upload.count(), 0);
  await page.getByLabel("Directory state").selectOption("loading");
  await search.fill("annual");
  await page.getByRole("table").getByRole("status").filter({ hasText: "Loading" }).waitFor();
  assert.equal(await newFolder.count(), 0);
  assert.equal(await upload.count(), 0);

  await page.getByLabel("Directory state").selectOption("ready");
  await row(page, "Annual report.txt").waitFor();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Drive", exact: true })
    .click();
  await page.getByRole("link", { name: "Team handbook", exact: true }).click();
  await row(page, "Welcome.txt").waitFor();
  await page.getByLabel("Directory state").selectOption("loading");
  await page.getByRole("button", { name: "Search this folder", exact: true }).click();
  await search.fill("welcome");
  await page.getByRole("table").getByRole("status").filter({ hasText: "Loading" }).waitFor();
  assert.equal(await newFolder.count(), 0);
  assert.equal(await upload.count(), 0);
  assert.equal(await page.getByRole("button", { name: "Rename", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Delete", exact: true }).count(), 0);
});

test("Drive navigation, scoped folders, search, permissions and listing failures", async (t) => {
  const page = await preview(t);
  await page.getByRole("link", { name: "Team handbook", exact: true }).waitFor();
  for (const customer of ["Acme Studio", "Sam Rivera"])
    assert.equal(await page.getByRole("link", { name: customer, exact: true }).count(), 0);
  await page.getByRole("button", { name: "Search spaces", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search spaces", exact: true });
  await search.fill("team");
  await page
    .getByRole("link", { name: "Studio website", exact: true })
    .waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Team handbook", exact: true }).click();
  await row(page, "Welcome.txt").waitFor();
  assert.equal(await page.getByRole("button", { name: "Upload files", exact: true }).count(), 0);
  await page.getByText("Read-only", { exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await row(page, "Welcome.txt").getByRole("button", { name: "Download", exact: true }).click();
  await download;
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Drive", exact: true })
    .click();
  await page.getByRole("link", { name: "Studio website", exact: true }).click();
  await folder(page, "Assets");
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("heading", { name: "Assets", exact: true })
    .waitFor();
  await folder(page, "Nested");
  await page.getByRole("button", { name: "Search this folder", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("missing");
  await page.getByText("No matching files or folders.", { exact: true }).waitFor();
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("");
  await page.getByRole("link", { name: "Open linked record: Studio website", exact: true }).click();
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await page.getByRole("link", { name: "Nested", exact: true }).waitFor();
  await page.getByLabel("Directory state").selectOption("error");
  await page
    .getByRole("table")
    .getByRole("alert")
    .filter({ hasText: "Storage is unavailable" })
    .waitFor();
  await page.getByLabel("Directory state").selectOption("loading");
  await page.getByRole("table").getByRole("status").filter({ hasText: "Loading" }).waitFor();
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
    .getByRole("table")
    .getByRole("alert")
    .filter({ hasText: "This space or item is no longer available" })
    .waitFor();
});

test("uploads progress independently, retry, cancel, retain failures and share embedded data", async (t) => {
  const page = await preview(t, "/en/projects/website/drive");
  await page.getByRole("button", { name: "Upload files", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
  await page
    .locator('input[type="file"]:enabled')
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
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link", { name: "Drive", exact: true })
    .click();
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

test("upload toasts preserve layout and recovery, then dismiss completed feedback", async (t) => {
  async function checkFooter(upload, statusLabel, actionLabels) {
    const progress = await upload.getByRole("progressbar").boundingBox();
    const status = await upload.getByText(statusLabel, { exact: true }).boundingBox();
    const actions = await Promise.all(
      actionLabels.map((name) => upload.getByRole("button", { name, exact: true }).boundingBox()),
    );
    assert.equal(status.x, progress.x, "Status stays at the left edge of the upload");
    assert.ok(status.y >= progress.y + progress.height, "Status sits below progress");
    assert.ok(status.x + status.width <= actions[0].x, "Actions stay to the right of status");
    const last = actions.at(-1);
    assert.equal(last.x + last.width, progress.x + progress.width, "Actions align right");
    assert.ok(status.y < last.y + last.height && last.y < status.y + status.height);
    if (actions.length > 1)
      assert.ok(actions[1].x - actions[0].x - actions[0].width >= 8, "Actions retain their gap");
  }
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/project/portal", {
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
      });
      await row(page, "Annual report.txt").waitFor();
      const headerTop = () =>
        page.locator("thead").evaluate((element) => element.getBoundingClientRect().top + scrollY);
      await page.getByRole("button", { name: "Fail next upload", exact: true }).click();
      await page.locator('input[type="file"]:enabled').waitFor({ state: "attached" });
      const top = await headerTop();
      const name = "W1405-2_participants_with_additional_customer_portal_notes.xlsx";
      const now = new Date();
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 1000));
      await page.locator('input[type="file"]:enabled').setInputFiles(file(name));
      const toast = page.getByRole("dialog", { name: "Uploads", exact: true });
      const upload = toast.getByRole("listitem").filter({ hasText: name });
      await upload.getByRole("progressbar").waitFor();
      assert.equal(await toast.getAttribute("data-type"), "loading");
      assert.equal(await toast.getAttribute("aria-busy"), "true");
      await page.clock.runFor(500);
      assert.ok(Number(await upload.getByRole("progressbar").getAttribute("value")) > 0);
      const spinner = toast.locator("svg").first();
      assert.ok((await spinner.getAttribute("class")).includes("text-status-pending-foreground"));
      const pendingColor = await spinner.evaluate((element) => getComputedStyle(element).color);
      assert.equal(
        await upload
          .getByRole("progressbar")
          .evaluate((element) => getComputedStyle(element).color),
        pendingColor,
      );
      await checkFooter(upload, "Uploading", ["Cancel"]);
      assert.equal(
        await spinner.evaluate((element) => getComputedStyle(element).animationName),
        "none",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      assert.equal(
        await spinner.evaluate((element) => getComputedStyle(element).animationName),
        "spin",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      const iconBounds = await spinner.boundingBox();
      const titleBounds = await toast.getByText("Uploads", { exact: true }).boundingBox();
      assert.equal(iconBounds.y + iconBounds.height / 2, titleBounds.y + titleBounds.height / 2);
      await toast.screenshot({
        path: `/tmp/forge-drive-upload-loading-${width}-${colorScheme}.png`,
      });
      assert.equal(await toast.getByRole("button", { name: "Close", exact: true }).count(), 0);
      await upload.getByRole("button", { name: "Cancel", exact: true }).focus();
      await page.keyboard.press("Escape");
      assert.equal(await toast.isVisible(), true);
      await page.clock.resume();
      await upload.getByRole("button", { name: "Retry", exact: true }).waitFor();
      await checkFooter(upload, "Failed", ["Retry", "Cancel"]);
      assert.equal(await toast.getAttribute("data-type"), "error");
      assert.equal(await toast.getAttribute("aria-busy"), "false");
      assert.equal(await headerTop(), top);
      assert.equal(
        await toast.evaluate((element) => getComputedStyle(element.parentElement).position),
        "fixed",
      );
      assert.equal(
        await toast.evaluate((element) => element.closest('section[aria-label="Drive"]') === null),
        true,
      );
      // Other confirmations must not limit away a failed upload's recovery controls.
      for (let index = 0; index < 3; index++) await folder(page, `Toast ${index}`);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(5200);
      assert.equal(
        await upload.getByRole("button", { name: "Retry", exact: true }).isEnabled(),
        true,
      );
      await toast.screenshot({
        path: `/tmp/forge-drive-upload-failed-${width}-${colorScheme}.png`,
      });
      await upload.getByRole("button", { name: "Retry", exact: true }).click();
      await upload.getByText("Uploaded", { exact: true }).waitFor();
      assert.equal(await toast.getAttribute("data-type"), "success");
      const success = toast.locator("svg").first();
      assert.ok((await success.getAttribute("class")).includes("text-status-success-foreground"));
      const successColor = await success.evaluate((element) => getComputedStyle(element).color);
      assert.notEqual(successColor, pendingColor);
      assert.equal(
        await upload
          .getByRole("progressbar")
          .evaluate((element) => getComputedStyle(element).color),
        successColor,
      );
      await checkFooter(upload, "Uploaded", ["Dismiss"]);
      await row(page, name).waitFor();
      assert.equal(await headerTop(), top);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await toast.screenshot({ path: `/tmp/forge-drive-upload-done-${width}-${colorScheme}.png` });
      await page.mouse.move(0, 0);
      await toast.waitFor({ state: "hidden", timeout: 8000 });
      assert.equal(await row(page, name).count(), 1);
      // A dismissed batch must not reappear when a later upload starts.
      await page.locator('input[type="file"]:enabled').setInputFiles(file("next.txt"));
      await toast.getByText("next.txt", { exact: true }).waitFor();
      assert.equal(await toast.getByText(name, { exact: true }).count(), 0);
      await toast.getByText("Uploaded", { exact: true }).waitFor();
      await toast.getByRole("button", { name: "Close", exact: true }).click();
      await toast.waitFor({ state: "hidden" });
      await page.close();
    }
});

test("trash confirmation preserves folders and permanent purge retries failures", async (t) => {
  const page = await preview(t, "/en/drive/project/website");
  await folder(page, "Documents");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file("nested.txt"));
  await row(page, "nested.txt").waitFor();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link")
    .nth(1)
    .click();
  const trigger = row(page, "Documents").getByRole("button", { name: "Delete", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Move files and folders to trash", exact: true });
  await dialog.getByText(/including 1 file\(s\) and 1 folder\(s\)/).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await trigger.click();
  await dialog.getByRole("button", { name: "Move to trash", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await driveNavigation(page, "Trash");
  await row(page, "Documents").getByRole("button", { name: "Restore", exact: true }).click();
  await row(page, "Documents").waitFor({ state: "hidden" });
  await driveNavigation(page, "All files");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await row(page, "nested.txt").waitFor();
  await page
    .getByRole("navigation", { name: "Folder navigation" })
    .getByRole("link")
    .nth(1)
    .click();
  await row(page, "Documents").getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Move to trash", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await driveNavigation(page, "Trash");
  await page.getByRole("button", { name: "Interrupt next deletion", exact: true }).click();
  await row(page, "Documents").getByRole("button", { name: "Delete", exact: true }).click();
  const purge = page.getByRole("dialog", { name: "Delete files and folders", exact: true });
  await purge.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await purge.getByRole("alert").filter({ hasText: "Deletion is incomplete" }).waitFor();
  await purge.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await row(page, "Documents").getByText("Deletion pending", { exact: true }).waitFor();
  assert.equal(
    await row(page, "Documents").getByRole("button", { name: "Restore", exact: true }).count(),
    0,
  );
  await row(page, "Documents").getByRole("button", { name: "Delete", exact: true }).click();
  await purge.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await purge.waitFor({ state: "hidden" });
  await page.getByText(/Trash is empty/).waitFor();
});

test("Drive confirmations use dismissible toasts without moving the file table", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/project/website", {
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
      });
      await page.getByRole("button", { name: "Upload files", exact: true }).waitFor();
      const table = page.getByRole("table");
      await table.waitFor();
      await page.locator('input[type="file"]:enabled').waitFor({ state: "attached" });
      const tableTop = await table.evaluate(
        (element) => element.getBoundingClientRect().top + scrollY,
      );
      await folder(page, "Toast folder");
      const saved = page.getByRole("dialog", { name: "Changes saved.", exact: true });
      await saved.waitFor();
      assert.equal(
        await page.locator("section p").filter({ hasText: "Changes saved." }).count(),
        0,
      );
      assert.equal(
        await saved.locator("..").evaluate((element) => getComputedStyle(element).position),
        "fixed",
      );
      assert.equal(
        await table.evaluate((element) => element.getBoundingClientRect().top + scrollY),
        tableTop,
      );
      const bounds = await saved.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: `/tmp/forge-drive-toast-${width}-${colorScheme}.png` });
      await page.keyboard.press("F6");
      await page.keyboard.press("Tab");
      assert.equal(await saved.evaluate((element) => element === document.activeElement), true);
      await page.keyboard.press("Tab");
      assert.equal(
        await saved
          .getByRole("button", { name: "Close", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Enter");
      await saved.waitFor({ state: "hidden" });

      await row(page, "Toast folder").getByRole("button", { name: "Rename", exact: true }).click();
      const rename = page.getByRole("dialog", { name: "Rename", exact: true });
      await rename.getByRole("textbox").fill("Renamed folder");
      await rename.getByRole("button", { name: "Save", exact: true }).click();
      await saved.waitFor();
      await page.mouse.move(0, 0);
      await saved.waitFor({ state: "hidden", timeout: 8000 });
      await row(page, "Renamed folder")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      const deletion = page.getByRole("dialog", {
        name: "Move files and folders to trash",
        exact: true,
      });
      await deletion.getByRole("button", { name: "Move to trash", exact: true }).click();
      const deleted = page.getByRole("dialog", {
        name: "Files and folders moved to trash.",
        exact: true,
      });
      await deleted.waitFor();
      const undo = deleted.getByRole("button", { name: "Undo", exact: true });
      await undo.waitFor();
      await deleted.screenshot({ path: `/tmp/forge-drive-undo-${width}-${colorScheme}.png` });
      const toastBounds = await deleted.boundingBox();
      assert.ok(toastBounds.x >= 0 && toastBounds.x + toastBounds.width <= width);
      assert.equal(
        await table.evaluate((element) => element.getBoundingClientRect().top + scrollY),
        tableTop,
      );
      const undoInTrash = width === 390 && colorScheme === "dark";
      if (undoInTrash) {
        await driveNavigation(page, "Trash");
        await page.getByRole("table", { name: "Trash", exact: true }).waitFor();
        await row(page, "Renamed folder").waitFor();
      }
      await undo.focus();
      await page.keyboard.press("Enter");
      const restoring = page.getByRole("dialog", { name: "Restoring…", exact: true });
      await restoring.waitFor();
      assert.equal(
        await restoring.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
        true,
      );
      assert.equal(await restoring.getAttribute("data-type"), "loading");
      const pendingToast = await restoring.elementHandle();
      await page.keyboard.press("Enter");
      const restored = page.getByRole("dialog", {
        name: "Files and folders restored.",
        exact: true,
      });
      await restored.waitFor();
      assert.equal(
        await restored.evaluate((element, pending) => element === pending, pendingToast),
        true,
      );
      assert.equal(await restored.getAttribute("data-type"), "success");
      if (undoInTrash) {
        await row(page, "Renamed folder").waitFor({ state: "hidden" });
        await driveNavigation(page, "All files");
      }
      await row(page, "Renamed folder").waitFor();
      await restored.getByRole("button", { name: "Close", exact: true }).click();
      await row(page, "Renamed folder")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await deletion.getByRole("button", { name: "Move to trash", exact: true }).click();
      await deleted.waitFor();
      await deleted.getByRole("button", { name: "Close", exact: true }).click();
      await deleted.waitFor({ state: "hidden" });

      await page
        .getByRole("navigation", { name: "Folder navigation" })
        .getByRole("link", { name: "Drive", exact: true })
        .click();
      await page.getByRole("link", { name: "Team handbook", exact: true }).click();
      const download = page.waitForEvent("download");
      await row(page, "Welcome.txt").getByRole("button", { name: "Download", exact: true }).click();
      await download;
      await page.getByRole("dialog", { name: "Download started.", exact: true }).waitFor();
      await page
        .getByRole("navigation", { name: "Folder navigation" })
        .getByRole("link", { name: "Drive", exact: true })
        .click();
      assert.equal(
        await page.getByRole("dialog", { name: "Download started.", exact: true }).count(),
        0,
      );
      await page.close();
    }
});

void test("download promise toast updates in place through loading, success and error", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const reducedMotion = width === 1440 && colorScheme === "light" ? "no-preference" : "reduce";
      const page = await preview(t, "/en/drive/project/portal", {
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion,
      });
      const download = row(page, "Annual report.txt").getByRole("button", {
        name: "Download",
        exact: true,
      });
      await download.waitFor();
      const now = new Date();
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 1000));
      await download.click();
      const loading = page.getByRole("dialog", { name: "Loading…", exact: true });
      await loading.waitFor();
      const pending = await loading.elementHandle();
      assert.equal(await loading.getAttribute("data-type"), "loading");
      assert.equal(await loading.getAttribute("aria-busy"), "true");
      const animation = await loading
        .locator("svg")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName);
      assert.equal(animation === "none", reducedMotion === "reduce");
      assert.equal(await download.isDisabled(), true);
      await loading.screenshot({
        path: `/tmp/forge-drive-download-loading-${width}-${colorScheme}.png`,
      });
      const started = page.waitForEvent("download");
      await page.clock.runFor(1000);
      await started;
      const success = page.getByRole("dialog", { name: "Download started.", exact: true });
      await success.waitFor();
      assert.equal(
        await success.evaluate((element, previous) => element === previous, pending),
        true,
      );
      assert.equal(await success.getAttribute("data-type"), "success");
      assert.equal(await success.getAttribute("aria-busy"), "false");
      await success.getByRole("button", { name: "Close", exact: true }).click();

      await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).check();
      await page.clock.runFor(1000);
      await page.locator('[aria-busy="false"] table').waitFor();
      await download.click();
      await loading.waitFor();
      const failed = await loading.elementHandle();
      await page.clock.runFor(1000);
      const error = page.getByRole("dialog", {
        name: "Storage is unavailable. Please retry.",
        exact: true,
      });
      await error.waitFor();
      assert.equal(await error.evaluate((element, previous) => element === previous, failed), true);
      assert.equal(await error.getAttribute("data-type"), "error");
      assert.equal(await error.getAttribute("aria-busy"), "false");
      assert.equal(await download.isEnabled(), true);
      await page.clock.runFor(6000);
      assert.equal(await error.isVisible(), true);
      await error.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).uncheck();
      await page.clock.runFor(1000);
      await page.locator('[aria-busy="false"] table').waitFor();
      const retried = page.waitForEvent("download");
      await download.click();
      await page.clock.runFor(1000);
      await retried;
      await success.waitFor();
      await page.close();
    }
});

test("trash Undo retries failures and offers Trash for restore conflicts", async (t) => {
  const page = await preview(t, "/en/drive/project/portal");
  async function trashReport() {
    await row(page, "Annual report.txt")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Move files and folders to trash",
      exact: true,
    });
    await dialog.getByRole("button", { name: "Move to trash", exact: true }).click();
    const toast = page.getByRole("dialog", {
      name: "Files and folders moved to trash.",
      exact: true,
    });
    await toast.waitFor();
    await toast.hover();
    return toast;
  }
  const toast = await trashReport();
  await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).check();
  await page.locator('[aria-busy="false"] table').waitFor();
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await toast.getByText("Storage is unavailable. Please retry.", { exact: true }).waitFor();
  assert.equal(await row(page, "Annual report.txt").count(), 0);
  await page.getByRole("checkbox", { name: "Simulate action failures", exact: true }).uncheck();
  await page.locator('[aria-busy="false"] table').waitFor();
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await row(page, "Annual report.txt").waitFor();
  const restored = page.getByRole("dialog", { name: "Files and folders restored.", exact: true });
  await restored.getByRole("button", { name: "Close", exact: true }).click();

  const conflict = await trashReport();
  await page.locator('input[type="file"]').setInputFiles(file("Annual report.txt", "replacement"));
  await row(page, "Annual report.txt").waitFor();
  await conflict.getByRole("button", { name: "Undo", exact: true }).click();
  await conflict
    .getByText("Open Trash to choose a folder or another name for this item.", { exact: true })
    .waitFor();
  assert.equal(await row(page, "Annual report.txt").count(), 1);
  await conflict.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("table", { name: "Trash", exact: true }).waitFor();
  await row(page, "Annual report.txt")
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Restore files and folders", exact: true }).waitFor();
});

test("Drive loading preserves table headers, guidance and disabled actions", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive", {
        viewport: { width, height: 900 },
        colorScheme,
      });
      for (const path of ["/en/drive", "/en/drive/project/portal", "/en/drive/project/website"]) {
        await page.goto(`${baseURL}${path}`);
        await page.locator('[data-preview-ready="true"]').waitFor();
        const table = page.getByRole("table");
        await page.locator('[aria-busy="false"] table').waitFor();
        const panel = table.locator("../..");
        const headings = await table.getByRole("columnheader").allTextContents();
        const position = () =>
          table
            .locator("thead")
            .evaluate((element) => element.getBoundingClientRect().top + scrollY);
        const top = await position();
        const rows = await table.locator("tbody tr").allTextContents();
        const guidance = panel.getByText(/Drop files here or choose Upload files/);
        const guideTop =
          path === "/en/drive"
            ? undefined
            : await guidance.evaluate((element) => element.getBoundingClientRect().top + scrollY);
        await page.getByLabel("Directory state").selectOption("loading");
        await panel.locator('[role="status"]').filter({ hasText: "Loading" }).waitFor();
        assert.deepEqual(await table.getByRole("columnheader").allTextContents(), headings);
        assert.equal(await position(), top);
        if (guideTop !== undefined) {
          assert.equal(await guidance.isVisible(), true);
          assert.equal(
            await guidance.evaluate((element) => element.getBoundingClientRect().top + scrollY),
            guideTop,
          );
          assert.equal(
            await page.getByRole("button", { name: "Upload files", exact: true }).isDisabled(),
            true,
          );
          assert.equal(
            await page.getByRole("button", { name: "New folder", exact: true }).isDisabled(),
            true,
          );
          assert.equal(await page.locator('input[type="file"]').isDisabled(), true);
        }
        if (!path.endsWith("website")) {
          assert.deepEqual(await table.locator("tbody tr").allTextContents(), rows);
        } else {
          assert.equal(
            await table.getByRole("cell").filter({ hasText: "Loading" }).getAttribute("colspan"),
            "5",
          );
        }
        if (path.endsWith("portal")) {
          assert.equal(
            await table.getByRole("button", { name: "Rename", exact: true }).first().isDisabled(),
            true,
          );
          assert.equal(
            await table.getByRole("button", { name: "Download", exact: true }).first().isDisabled(),
            true,
          );
        }
        await panel.screenshot({
          path: `/tmp/forge-drive-loading-${width}-${colorScheme}-${path.split("/").at(-1)}.png`,
        });
        await page.getByLabel("Directory state").selectOption("ready");
        await page.locator('[aria-busy="false"] table').waitFor();
        assert.equal(await position(), top);
      }
      await page.getByLabel("Directory state").selectOption("loading");
      await page
        .getByRole("navigation", { name: "Folder navigation" })
        .getByRole("link", { name: "Drive", exact: true })
        .click();
      await page.getByRole("table").getByRole("cell").filter({ hasText: "Loading" }).waitFor();
      assert.equal(await page.getByRole("table").getByRole("columnheader").count(), 5);
      await page.getByLabel("Directory state").selectOption("ready");
      await page.getByRole("link", { name: "Customer portal", exact: true }).waitFor();
      await page.getByLabel("Directory state").selectOption("loading");
      await page.getByRole("link", { name: "Customer portal", exact: true }).click();
      const table = page.getByRole("table");
      await table.getByRole("cell").filter({ hasText: "Loading" }).waitFor();
      assert.equal(await table.getByRole("columnheader").count(), 5);
      assert.equal(
        await page.getByRole("button", { name: "Upload files", exact: true }).count(),
        0,
      );
      const top = await table
        .locator("thead")
        .evaluate((element) => element.getBoundingClientRect().top + scrollY);
      await page.getByLabel("Directory state").selectOption("ready");
      await row(page, "Annual report.txt").waitFor();
      assert.equal(
        await table
          .locator("thead")
          .evaluate((element) => element.getBoundingClientRect().top + scrollY),
        top,
      );
      await row(page, "Annual report.txt")
        .getByRole("button", { name: "Rename", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
      await page.getByLabel("Directory state").selectOption("loading");
      assert.equal(
        await dialog.getByRole("button", { name: "Save", exact: true }).isDisabled(),
        true,
      );
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByLabel("Directory state").selectOption("error");
      await table.getByRole("alert").waitFor();
      assert.equal(await table.getByRole("columnheader").count(), 5);
      await page.close();
    }
});

test("Drive empty results retain table headers and a full-width feedback row", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive", {
        viewport: { width, height: 900 },
        colorScheme,
      });
      for (const [path, searchLabel, query, message] of [
        ["/en/drive", "Search spaces", "missing", "No spaces found."],
        ["/en/drive/project/website", "Search this folder", "", "This folder is empty."],
        [
          "/en/drive/workspace/handbook",
          "Search this folder",
          "missing",
          "No matching files or folders.",
        ],
      ]) {
        await page.goto(`${baseURL}${path}`);
        await page.locator('[data-preview-ready="true"]').waitFor();
        if (query) {
          await page.getByRole("button", { name: searchLabel, exact: true }).click();
          await page.getByRole("searchbox", { name: searchLabel, exact: true }).fill(query);
        }
        const table = page.getByRole("table");
        const feedback = table.getByRole("status").filter({ hasText: message });
        await feedback.waitFor();
        assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
          "Name",
          "Modified",
          "Size",
          "Owner",
          "Actions",
        ]);
        assert.equal(await table.getByRole("row").count(), 2);
        assert.equal(
          await table.getByRole("cell").filter({ hasText: message }).getAttribute("colspan"),
          "5",
        );
        assert.equal(await page.getByRole("button", { name: "Next page" }).isDisabled(), true);
        assert.equal(
          await feedback.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const { left, right } = range.getBoundingClientRect();
            return left >= 0 && right <= innerWidth;
          }),
          true,
          "Empty feedback must be readable without horizontal scrolling",
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await table.locator("../..").screenshot({
          path: `/tmp/forge-drive-empty-${width}-${colorScheme}-${path.split("/").at(-1)}.png`,
        });
      }
      await page.close();
    }
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
      await page
        .getByRole("navigation", { name: "Folder navigation" })
        .getByRole("link", { name: "Drive", exact: true })
        .click();
      await page.getByRole("link", { name: "Studio website", exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "Space action labels must stay inside the horizontally scrolling table",
      );
      const openRecord = page.getByRole("link", {
        name: "Open linked record: Customer portal",
        exact: true,
      });
      assert.equal(await openRecord.innerText(), "");
      const target = await openRecord.boundingBox();
      assert.ok(target.width >= (width < 768 ? 40 : 32));
      assert.ok(target.height >= (width < 768 ? 40 : 32));
      await page.screenshot({
        path: `/tmp/forge-drive-spaces-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await openRecord.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: "Customer portal", exact: true }).waitFor();
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
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.getByRole("link", { name: "Valid", exact: true }).count(), 1);
  await page
    .getByRole("button", { name: "Upload files", exact: true })
    .and(page.locator(":enabled"))
    .waitFor();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      Array.from({ length: 20 }, (_, index) => file(`page-${index}.txt`, "x".repeat(index + 1))),
    );
  await page
    .getByRole("listitem")
    .filter({ hasText: "page-19.txt" })
    .getByText("Uploaded", { exact: true })
    .waitFor({ timeout: 20000 });
  const pagination = page.getByRole("navigation", { name: "Drive", exact: true });
  assert.equal(await pagination.locator("[aria-live]").innerText(), "1");
  await pagination.getByRole("button", { name: "Next page", exact: true }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(await pagination.locator("[aria-live]").innerText(), "2");
  const secondPage = await page.locator("tbody tr td:first-child").allTextContents();
  await pagination.getByRole("button", { name: "Next page", exact: true }).click();
  await row(page, "page-9.txt").waitFor();
  assert.equal(await pagination.locator("[aria-live]").innerText(), "3");
  assert.equal(await pagination.getByRole("button", { name: "Next page" }).isDisabled(), true);
  await pagination.getByRole("button", { name: "Previous page" }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(await pagination.locator("[aria-live]").innerText(), "2");
  assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), secondPage);
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Previous page", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.locator('[aria-busy="false"] table').waitFor();
  const names = await page.locator("tbody tr td:first-child").allTextContents();
  assert.equal(names[0].trim(), "Valid");
  assert.equal(names[1].trim(), "page-19.txt");
  assert.equal(await row(page, "page-0.txt").count(), 0);
});

test("Drive tables expose customer ownership and sort metadata with keyboard-accessible headers", async (t) => {
  const page = await preview(t);
  const pagination = page.getByRole("navigation", { name: "Drive", exact: true });
  assert.equal(await pagination.locator("[aria-live]").innerText(), "1");
  const table = page.getByRole("table", { name: "Drive spaces", exact: true });
  await table.waitFor();
  assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
    "Name",
    "Modified",
    "Size",
    "Owner",
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
  await sortBy("Owner");
  const owner = page.getByRole("button", { name: "Owner", exact: true });
  await owner.focus();
  await page.keyboard.press("Enter");
  await page.locator('[aria-busy="false"] table').waitFor();
  assert.equal(await owner.evaluate((element) => element === document.activeElement), true);
  assert.equal(
    await table.getByRole("columnheader", { name: "Owner", exact: true }).getAttribute("aria-sort"),
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
  await page
    .getByRole("link", { name: "Open linked record: Customer portal", exact: true })
    .click();
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await row(page, "Annual report.txt").waitFor();
  assert.equal(
    await row(page, "Annual report.txt").getByRole("cell").nth(3).innerText(),
    "Acme Studio",
  );
});

test("trash conflicts offer name and nested destination recovery in both themes and widths", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/project/portal", {
        viewport: { width, height: 900 },
        colorScheme,
      });
      await row(page, "Annual report.txt").waitFor();
      await row(page, "Annual report.txt")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      const trash = page.getByRole("dialog", {
        name: "Move files and folders to trash",
        exact: true,
      });
      await trash.getByRole("button", { name: "Move to trash", exact: true }).click();
      await trash.waitFor({ state: "hidden" });
      await folder(page, "Destination");
      await page.getByRole("link", { name: "Destination", exact: true }).click();
      await folder(page, "Nested");
      await page
        .getByRole("navigation", { name: "Folder navigation" })
        .getByRole("link")
        .nth(1)
        .click();
      await page
        .locator('input[type="file"]')
        .setInputFiles(file("Annual report.txt", "new bytes"));
      await row(page, "Annual report.txt").waitFor();
      await driveNavigation(page, "Trash");
      assert.deepEqual(
        await page
          .getByRole("table", { name: "Trash", exact: true })
          .getByRole("columnheader")
          .allTextContents(),
        ["Name", "Original location", "Deleted", "Expires", "Actions"],
      );
      await row(page, "Annual report.txt").waitFor();
      await page.locator('[aria-busy="false"] table').waitFor();
      assert.equal(
        await page
          .getByRole("navigation", { name: "Drive", exact: true })
          .locator("[aria-live]")
          .innerText(),
        "1",
      );
      await page.screenshot({
        path: `/tmp/forge-trash-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await row(page, "Annual report.txt")
        .getByRole("button", { name: "Restore", exact: true })
        .click();
      const restore = page.getByRole("dialog", { name: "Restore files and folders", exact: true });
      await restore.getByRole("alert").filter({ hasText: "original folder" }).waitFor();
      await restore
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Recovered report.txt");
      const pagination = restore.getByRole("navigation", {
        name: "Destination folder",
        exact: true,
      });
      assert.equal(await pagination.locator("[aria-live]").innerText(), "1");
      const picker = restore.getByRole("combobox", { name: "Destination folder", exact: true });
      const restoreButton = restore.getByRole("button", { name: "Restore", exact: true });
      await restore.locator("select:enabled").waitFor({ state: "attached" });
      const beforeLoading = await restoreButton.boundingBox();
      await picker.selectOption({ label: "Destination" });
      const duringLoading = await restoreButton.boundingBox();
      assert.ok(
        Math.abs(beforeLoading.y - duringLoading.y) <= 1,
        "Folder loading must keep the restore action in place",
      );
      await picker.selectOption({ label: "Nested" });
      await restore.locator("select:enabled").waitFor({ state: "attached" });
      await page.screenshot({ path: `/tmp/forge-trash-restore-${width}-${colorScheme}.png` });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await restore.getByRole("button", { name: "Restore", exact: true }).click();
      await restore.waitFor({ state: "hidden" });
      await row(page, "Annual report.txt").waitFor({ state: "hidden" });
      await driveNavigation(page, "All files");
      await row(page, "Annual report.txt").waitFor();
      await page.getByRole("link", { name: "Destination", exact: true }).click();
      await page.getByRole("link", { name: "Nested", exact: true }).click();
      await row(page, "Recovered report.txt").waitFor();
      await page.close();
    }
});

test("breadcrumb rename preserves drafts, updates host records and navigates nested folders", async (t) => {
  const page = await preview(t, "/en/drive/project/portal", { reducedMotion: "reduce" });
  const nav = page.getByRole("navigation", { name: "Folder navigation" });
  await nav.getByRole("heading", { name: "Customer portal", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Back to drive", exact: true }).count(), 0);
  assert.equal(await nav.getByRole("heading").count(), 1);
  const actions = nav.getByRole("button", { name: "Actions: Customer portal", exact: true });
  await actions.focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("menuitem", { name: "Rename", exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
  const input = dialog.getByRole("textbox", { name: "Name", exact: true });
  assert.equal(await input.inputValue(), "Customer portal");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await actions.evaluate((node) => document.activeElement === node), true);
  await page.getByLabel("Simulate action failures").check();
  await actions.click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await input.fill("Client portal");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await input.inputValue(), "Client portal");
  assert.equal(
    await page.locator('nav[aria-label="Folder navigation"] h2').textContent(),
    "Customer portal",
  );
  // Change the host's failure setting without dismissing the modal or its draft.
  await page.getByLabel("Simulate action failures").evaluate((node) => node.click());
  await input.fill("Client portal");
  await input.press("ControlOrMeta+Enter");
  await dialog.waitFor({ state: "hidden" });
  await nav.getByRole("heading", { name: "Client portal", exact: true }).waitFor();
  await folder(page, "Assets");
  await page.getByRole("link", { name: "Assets", exact: true }).click();
  await folder(page, "Images");
  await page.getByRole("link", { name: "Images", exact: true }).click();
  await nav.getByRole("button", { name: "Actions: Images", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await input.fill("Photos");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await nav.getByRole("heading", { name: "Photos", exact: true }).waitFor();
  await nav.getByRole("link", { name: "Assets", exact: true }).click();
  await page.getByRole("link", { name: "Photos", exact: true }).waitFor();
  await nav.getByRole("link", { name: "Client portal", exact: true }).click();
  await row(page, "Annual report.txt").waitFor();
  await nav.getByRole("link", { name: "Drive", exact: true }).click();
  await page.getByRole("link", { name: "Client portal", exact: true }).waitFor();
  await page.getByRole("link", { name: "Open linked record: Client portal", exact: true }).click();
  await page.getByRole("heading", { name: "Client portal", exact: true }).waitFor();
  await page.getByRole("link", { name: "Drive directory", exact: true }).click();
  await page.getByRole("link", { name: "Team handbook", exact: true }).click();
  await row(page, "Welcome.txt").waitFor();
  assert.equal(await nav.getByRole("button").count(), 0);
});

test("breadcrumb menus and long names fit both themes and viewport sizes", async (t) => {
  for (const colorScheme of ["light", "dark"])
    for (const width of [390, 1440]) {
      const page = await preview(t, "/en/drive/project/portal", {
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
      });
      const nav = page.getByRole("navigation", { name: "Folder navigation" });
      const actions = nav.getByRole("button", { name: "Actions: Customer portal", exact: true });
      await actions.click();
      await page.getByRole("menuitem", { name: "Rename", exact: true }).waitFor();
      await page.getByRole("menu").evaluate(async (node) => {
        await Promise.all(
          node.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      await page.screenshot({
        path: `/tmp/drive-breadcrumb-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
      await dialog
        .getByRole("textbox")
        .fill("Kundenportal für internationale Zusammenarbeit und Dokumentenverwaltung");
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await nav.getByRole("heading", { name: /^Kundenportal/ }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      const box = await nav.getByRole("button").boundingBox();
      assert.ok(box.width >= (width < 768 ? 40 : 32));
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.screenshot({
        path: `/tmp/drive-breadcrumb-long-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.close();
    }
});

import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";
import { openPreviewControls } from "./showroom-helpers.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function checkScroll(page, dialog, requireOverflow = true) {
  const header = dialog.locator("[data-dialog-header]");
  const footer = dialog.locator("[data-dialog-footer]");
  await footer.waitFor();
  const bounds = await dialog.boundingBox();
  const initial = await Promise.all([header.boundingBox(), footer.boundingBox()]);
  for (const box of initial) {
    assert.ok(
      box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height + 1,
      "header and actions must be visible before scrolling",
    );
  }
  assert.ok(initial[0].y + initial[0].height < initial[1].y, "content has room between controls");
  if (requireOverflow)
    assert.ok(
      await dialog.evaluate((node) => node.scrollHeight > node.clientHeight),
      "fixture overflows",
    );
  for (const position of [0.5, 1]) {
    await dialog.evaluate((node, ratio) => {
      node.scrollTop = (node.scrollHeight - node.clientHeight) * ratio;
    }, position);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const current = await Promise.all([header.boundingBox(), footer.boundingBox()]);
    for (let i = 0; i < current.length; i++) {
      assert.ok(Math.abs(current[i].y - initial[i].y) < 2, "header and footer stay in place");
    }
  }
  for (const input of await dialog
    .locator("input:not([disabled]):not([type=hidden]):visible")
    .all()) {
    await input.focus();
    const [field, top, bottom] = await Promise.all([
      input.boundingBox(),
      header.boundingBox(),
      footer.boundingBox(),
    ]);
    assert.ok(
      field.y >= top.y + top.height && field.y + field.height <= bottom.y,
      "focused fields must not be obscured by pinned controls",
    );
  }
  assert.ok(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    "no horizontal overflow",
  );
}

await test("long reservation and employee modals keep titles and actions visible", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 320]) {
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 600 });
      await page.goto(`${baseURL}/fr/admin/reservations`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      await openPreviewControls(page);
      await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("apartment");
      const theme = page.shell.getByRole("button", { name: "Dark mode", exact: true });
      if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
      await page
        .getByText(/Jamie Taylor · Apartment stay/)
        .first()
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Déplacer", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Déplacer", exact: true });
      await checkScroll(page, dialog);
      if (process.env.TEST_CAPTURE_DIR)
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/reservation-${width}-${dark ? "dark" : "light"}.png`,
        });
      await dialog
        .getByRole("button", { name: "Fermer", exact: true })
        .filter({ has: page.locator("svg") })
        .click();
      await dialog.waitFor({ state: "hidden" });

      await page.setViewportSize({ width, height: 480 });
      await page.goto(`${baseURL}/en/employees`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const row = page.getByRole("row").filter({ hasText: "Alex Morgan" });
      await row.getByRole("button", { name: "Edit Alex Morgan", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "Edit employee", exact: true });
      await checkScroll(page, edit);
      if (process.env.TEST_CAPTURE_DIR)
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/employee-${width}-${dark ? "dark" : "light"}.png`,
        });
      await edit.getByRole("button", { name: "Cancel", exact: true }).click();
      await edit.waitFor({ state: "hidden" });
    }
  }
  assert.deepEqual(errors, []);
});

await test("Drive modal actions remain inside short viewports before and after scrolling", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const width of [1440, 320]) {
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 300 } });
      page.setDefaultTimeout(15000);
      t.after(() => page.close());
      await page.goto(`${baseURL}/en/drive/project/portal`);
      const theme = page.shell.getByRole("button", { name: "Dark mode", exact: true });
      if ((await theme.getAttribute("aria-pressed")) !== String(dark)) await theme.click();
      const row = page.getByRole("row").filter({ hasText: "Design brief.txt" });
      await row.getByRole("button", { name: "Delete", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "Move files and folders to trash",
        exact: true,
      });
      await dialog.getByText(/including 1 file\(s\) and 0 folder\(s\)/).waitFor();
      await checkScroll(page, dialog, false);
      if (width === 1440)
        assert.equal(
          await dialog.evaluate((node) => node.scrollHeight > node.clientHeight),
          false,
          "the compact confirmation fits without unnecessary scrolling",
        );
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });

      await page.setViewportSize({ width, height: 900 });
      const longName = `${"A detailed project document name ".repeat(7)}Design brief.txt`;
      await row.getByRole("button", { name: "Rename", exact: true }).click();
      const rename = page.getByRole("dialog", { name: "Rename", exact: true });
      await rename.getByRole("textbox", { name: "Name", exact: true }).fill(longName);
      await rename.getByRole("button", { name: "Save", exact: true }).click();
      await rename.waitFor({ state: "hidden" });
      await page
        .getByRole("row")
        .filter({ hasText: longName })
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await dialog.getByText(/including 1 file\(s\) and 0 folder\(s\)/).waitFor();
      await page.setViewportSize({ width, height: 300 });
      await checkScroll(page, dialog);
      if (process.env.TEST_CAPTURE_DIR)
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/drive-footer-${width}-${dark ? "dark" : "light"}.png`,
        });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
    }
  }
});

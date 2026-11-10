import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
  "base64",
);
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

await test("support workflow preserves drafts, renders safe Markdown and keeps closed replies closed", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote = [];
  page.on("request", (request) => {
    if (request.url().includes("support-tracker.invalid")) remote.push(request.url());
  });
  await page.goto(`${base}/en/intranet/supports`);
  await page.getByRole("table").waitFor();
  await page.getByRole("button", { name: "Support ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New support ticket" });
  await dialog.waitFor();
  await page.waitForFunction(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  await page.keyboard.press("Shift+Tab");
  await page.waitForFunction(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Screenshot support test");
  await dialog.getByRole("combobox", { name: "Type", exact: true }).selectOption("bug");
  const markdown =
    '**Visible description**\n\n```html\n<img onerror="alert(1)">\n```\n\n![External](https://support-tracker.invalid/pixel.png)\n\n[Unsafe](javascript:alert(1))\n\n<script>window.supportScriptRan=true</script>';
  await dialog.getByRole("textbox", { name: "Description", exact: true }).fill(markdown);
  await dialog.getByLabel("Images", { exact: true }).setInputFiles([
    { name: "screen.png", mimeType: "image/png", buffer: png },
    { name: "follow-up.gif", mimeType: "image/gif", buffer: gif },
  ]);
  assert.equal(await dialog.getByRole("button", { name: "Preview", exact: true }).count(), 0);
  await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  await page.getByRole("heading", { name: "Screenshot support test", exact: true }).waitFor();
  await actionToast(page, "Ticket created.");
  assert.equal(await page.locator("article figure").count(), 2);
  assert.equal(await page.locator('article a[href^="javascript:"]').count(), 0);
  assert.equal(await page.locator('article img[src*="support-tracker.invalid"]').count(), 0);
  assert.equal(await page.getByRole("button", { name: "Preview", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.supportScriptRan), undefined);
  assert.deepEqual(remote, []);
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("textbox", { name: "Reply", exact: true }).fill("**Keep my draft**");
  await page.getByLabel("Images", { exact: true }).setInputFiles([
    { name: "reply.png", mimeType: "image/png", buffer: png },
    { name: "reply.gif", mimeType: "image/gif", buffer: gif },
  ]);
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Reply", exact: true }).inputValue(),
    "**Keep my draft**",
  );
  assert.equal(await page.getByRole("button", { name: /^Remove image: reply\./ }).count(), 2);
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await actionToast(page, "Reply posted.");
  assert.equal(await page.locator("article figure").count(), 4);
  await page.getByRole("button", { name: "Close ticket", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Close this ticket?", exact: true })
    .getByRole("button", { name: "Close ticket", exact: true })
    .click();
  await page.getByRole("button", { name: "Reopen ticket", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Reply", exact: true }).fill("Thank you");
  await page.getByRole("textbox", { name: "Reply", exact: true }).press("Control+Enter");
  await page.getByText("Thank you", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Reopen ticket", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Reopen ticket", exact: true }).click();
  await page.getByRole("button", { name: "Close ticket", exact: true }).waitFor();
  if (process.env.TEST_CAPTURE_DIR) {
    await mkdir(process.env.TEST_CAPTURE_DIR, { recursive: true });
    for (const [width, theme] of [
      [1440, "light"],
      [390, "dark"],
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark"))
        await toggle.click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        animations: "disabled",
        path: `${process.env.TEST_CAPTURE_DIR}/supports-${width}.png`,
        fullPage: true,
      });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
  }
  await page.getByRole("link", { name: "Back to support", exact: true }).click();
  await page.getByRole("link", { name: "Screenshot support test", exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

await test("support navigation, URL history, validation and pending dialog guards", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/en/intranet`);
  await page
    .getByRole("navigation", { name: "Support navigation" })
    .getByRole("link", { name: "Support", exact: true })
    .click();
  await page.getByRole("table").waitFor();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.waitForURL((url) => Number(JSON.parse(url.searchParams.get("page") ?? "1")) === 2);
  await page.reload();
  assert.equal(await page.getByRole("table").locator("tbody tr").count(), 3);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await page.goBack();
  await page.waitForURL((url) => Number(JSON.parse(url.searchParams.get("page") ?? "1")) === 2);
  await page.getByRole("button", { name: "Search tickets", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search tickets", exact: true }).fill("Contact form");
  await page
    .getByRole("link", { name: "Contact form confirmation is missing", exact: true })
    .waitFor();
  assert(!new URL(page.url()).searchParams.has("page"));
  await page.reload();
  assert.equal(
    await page.getByRole("searchbox", { name: "Search tickets", exact: true }).inputValue(),
    "Contact form",
  );
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("button", { name: "Support ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New support ticket" });
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Retained creation");
  await dialog
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Steps to reproduce");
  await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  assert.equal(await dialog.count(), 1);
  await dialog.getByRole("combobox", { name: "Type", exact: true }).selectOption("support");
  await dialog.getByLabel("Images", { exact: true }).setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
  assert.equal(
    await dialog.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Retained creation",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert(
    await page
      .getByRole("button", { name: "Support ticket", exact: true })
      .evaluate((element) => element === document.activeElement),
  );
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.getByLabel("Delay actions", { exact: true }).check();
  await page.getByRole("button", { name: "Support ticket", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Delayed creation");
  await dialog.getByRole("textbox", { name: "Description", exact: true }).fill("Details");
  await dialog.getByRole("combobox", { name: "Type", exact: true }).selectOption("feature");
  await dialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  await dialog.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await dialog.count(), 1);
  await page.getByRole("heading", { name: "Delayed creation", exact: true }).waitFor();
});

await test("support row actions view requests and cancel with rollback and retry", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/en/intranet/supports`);
  await page.addStyleTag({ content: "* { transition: none !important; }" });
  const title = "Contact form confirmation is missing";
  const row = page.getByRole("row").filter({ hasText: title });
  const cancel = row.getByRole("button", { name: `Cancel request: ${title}`, exact: true });
  const view = row.getByRole("link", { name: `View request: ${title}`, exact: true });
  const closed = page.getByRole("row").filter({ hasText: "Update the team photo" });
  const canceled = page.getByRole("row").filter({ hasText: "Change the contact page layout" });
  await cancel.waitFor();
  await canceled.getByText("Canceled", { exact: true }).waitFor();
  assert.equal(await canceled.getByRole("button", { name: /^Cancel request:/ }).isDisabled(), true);
  assert.equal(await closed.getByRole("button", { name: /^Cancel request:/ }).isDisabled(), true);
  await view.focus();
  await page.getByRole("tooltip", { name: "View request", exact: true }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await page.getByText("I can reproduce this on mobile too.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to support", exact: true }).click();
  await cancel.waitFor();

  await page.getByLabel("Delay actions", { exact: true }).check();
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await cancel.click();
  await row.getByText("Canceled", { exact: true }).waitFor();
  assert.equal(await cancel.isDisabled(), true);
  assert.equal(
    await page
      .getByRole("button", { name: /^Cancel request:/ })
      .filter({ visible: true })
      .count(),
    20,
  );
  assert.equal(
    await page
      .getByRole("button", { name: /^Cancel request:/ })
      .evaluateAll((buttons) => buttons.every((button) => button.disabled)),
    true,
  );
  await page.getByRole("alert").filter({ hasText: "Could not cancel this request" }).waitFor();
  assert.equal(await row.getByText("Open", { exact: true }).count(), 1);
  assert.equal(await cancel.isEnabled(), true);

  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await cancel.click();
  await actionToast(page, "Ticket status updated.");
  assert.equal(await row.getByText("Canceled", { exact: true }).count(), 1);
  assert.equal(await cancel.isDisabled(), true);
  assert.equal(await page.getByRole("alert").count(), 0);
  await view.click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  assert.equal(await page.getByText("canceled this request", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Reopen ticket", exact: true }).click();
  await actionToast(page, "Ticket status updated.");
  await page.getByRole("link", { name: "Back to support", exact: true }).click();
  await row.getByText("Open", { exact: true }).waitFor();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark"))
        await toggle.click();
      const colors = await canceled.getByText("Canceled", { exact: true }).evaluate((badge) => {
        const context = document.createElement("canvas").getContext("2d");
        const style = getComputedStyle(badge);
        return [style.color, style.backgroundColor].map((color) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data);
        });
      });
      for (const [red, green, blue, alpha] of colors) {
        assert.equal(red, green, "Canceled uses neutral gray colors");
        assert.equal(green, blue);
        assert(alpha > 0);
      }
      const actions = row.locator("td").last();
      const before = await actions.boundingBox();
      const closedActions = await closed.locator("td").last().boundingBox();
      assert(Math.abs(before.x - closedActions.x) < 1);
      await page.getByRole("table").evaluate((table) => {
        table.parentElement.scrollLeft = table.scrollWidth;
      });
      const after = await actions.boundingBox();
      assert(Math.abs(before.x - after.x) < 1, "Actions stay visible while the table scrolls");
      assert(after.x >= 0 && after.x + after.width <= width);
      const disabledColor = await closed
        .getByRole("button", { name: /^Cancel request:/ })
        .evaluate((button) => getComputedStyle(button).color);
      const paginationColor = await page
        .getByRole("button", { name: "Previous page", exact: true })
        .evaluate((button) => getComputedStyle(button).color);
      assert.equal(disabledColor, paginationColor);
      if (process.env.TEST_CAPTURE_DIR) {
        await mkdir(process.env.TEST_CAPTURE_DIR, { recursive: true });
        await page.screenshot({
          animations: "disabled",
          path: `${process.env.TEST_CAPTURE_DIR}/support-actions-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.getByRole("table").evaluate((table) => {
        table.parentElement.scrollLeft = 0;
      });
    }
  }
  assert.deepEqual(errors, []);
});

await test("ticket actions stay visible on overflow and closing requires recoverable confirmation", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/en/intranet/supports`);
  await page
    .getByRole("link", { name: "Contact form confirmation is missing", exact: true })
    .click();
  const article = page.locator("article");
  const close = article.getByRole("button", { name: "Close ticket", exact: true });
  const post = article.getByRole("button", { name: "Post reply", exact: true });
  const reply = page.getByRole("textbox", { name: "Reply", exact: true, includeHidden: true });
  const confirmation = page.getByRole("dialog", { name: "Close this ticket?", exact: true });
  await reply.fill("Keep this reply while closing");

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 720 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark"))
        await toggle.click();
      for (const fraction of [0, 0.5, 1]) {
        await page.evaluate((fraction) => {
          window.scrollTo(0, fraction * (document.documentElement.scrollHeight - innerHeight));
        }, fraction);
        const closeBox = await close.boundingBox();
        const postBox = await post.boundingBox();
        assert(closeBox.y >= 0 && closeBox.y + closeBox.height <= 720);
        assert(postBox.y >= 0 && postBox.y + postBox.height <= 720);
        assert(Math.abs(closeBox.y - postBox.y) < 1, "Both actions share the bottom bar");
        assert(closeBox.x >= 0 && postBox.x + postBox.width <= width);
      }
      await close.click();
      await confirmation.waitFor();
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Cancel");
      assert.equal(await article.getByText("Open", { exact: true }).count(), 1);
      assert.equal(await article.getByText("closed this ticket", { exact: true }).count(), 0);
      const confirm = confirmation.getByRole("button", { name: "Close ticket", exact: true });
      assert(
        await confirm.evaluate((button) => {
          const context = document.createElement("canvas").getContext("2d");
          context.fillStyle = getComputedStyle(button).color;
          context.fillRect(0, 0, 1, 1);
          const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
          return red > green && red > blue;
        }),
        "Confirmation uses danger color in both themes",
      );
      if (process.env.TEST_CAPTURE_DIR) {
        await mkdir(process.env.TEST_CAPTURE_DIR, { recursive: true });
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/support-close-${width}-${theme}.png`,
        });
      }
      await page.keyboard.press("Escape");
      await confirmation.waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => document.activeElement?.textContent?.trim() === "Close ticket",
      );
      assert.equal(await reply.inputValue(), "Keep this reply while closing");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.TEST_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.TEST_CAPTURE_DIR}/support-sticky-${width}-${theme}.png`,
        });
      }
    }
  }

  await close.click();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await confirmation.waitFor({ state: "hidden" });
  await close.click();
  await confirmation.getByRole("button", { name: "Close", exact: true }).click();
  await confirmation.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.getByLabel("Delay actions", { exact: true }).check();
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await close.click();
  await confirmation.getByRole("button", { name: "Close ticket", exact: true }).click();
  await confirmation.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  assert(await confirmation.getByRole("button", { name: "Saving…", exact: true }).isDisabled());
  assert(await confirmation.getByRole("button", { name: "Cancel", exact: true }).isDisabled());
  assert(await confirmation.getByRole("button", { name: "Close", exact: true }).isDisabled());
  await page.keyboard.press("Escape");
  assert.equal(await confirmation.count(), 1);
  await confirmation.getByRole("alert").waitFor();
  assert.equal(await article.getByText("Open", { exact: true }).count(), 1);
  assert.equal(await reply.inputValue(), "Keep this reply while closing");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await close.click();
  await confirmation.getByRole("button", { name: "Close ticket", exact: true }).click();
  await confirmation.waitFor({ state: "hidden" });
  await actionToast(page, "Ticket status updated.");
  assert.equal(await article.getByText("closed this ticket", { exact: true }).count(), 1);
  assert.equal(await reply.inputValue(), "Keep this reply while closing");
  await post.click();
  await actionToast(page, "Reply posted.");
  assert.equal(await article.getByText("Closed", { exact: true }).count(), 1);
  assert.equal(await reply.inputValue(), "");
  assert.deepEqual(errors, []);
});

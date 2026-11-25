import assert from "node:assert/strict";
import test from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
await test("Supports–GitHub export, delayed delivery, both directions and guarded recovery", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/connectors/supports-github`);
  const card = page.getByRole("region", { name: "GitHub", exact: true });
  const remote = page.getByRole("region", { name: "Mock GitHub discussion" });
  await card.getByText("Not connected", { exact: true }).waitFor();
  await card.getByRole("button", { name: "Send to GitHub", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send this discussion to GitHub?" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await remote.getByText("No delivery yet.").count(), 1);
  await page.getByLabel("Simulate GitHub failure").check();
  await card.getByRole("button", { name: "Send to GitHub", exact: true }).click();
  await dialog.getByRole("button", { name: "Send to GitHub", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await actionToast(page, "The action failed.");
  assert.equal(await card.getByRole("alert").count(), 0);
  await page.getByLabel("Simulate GitHub failure").uncheck();
  await card.getByRole("button", { name: "Send to GitHub", exact: true }).click();
  await dialog.getByRole("button", { name: "Send to GitHub", exact: true }).click();
  await card.getByText("Synchronized", { exact: true }).waitFor();
  await remote.getByText(/Jordan Lee: I can reproduce/).waitFor();
  await page.getByRole("textbox", { name: "Reply", exact: true }).fill("@maintainer A local reply");
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await card.getByText("Delivery pending", { exact: true }).waitFor();
  await page.getByLabel("Simulate GitHub failure").check();
  await page.getByRole("button", { name: "Run delivery worker", exact: true }).click();
  await card.getByText("Delivery failed", { exact: true }).waitFor();
  await page.getByLabel("Read-only connection").check();
  assert(await card.getByRole("button", { name: "Retry delivery" }).isDisabled());
  await page.getByLabel("Read-only connection").uncheck();
  await page.getByLabel("Simulate GitHub failure").uncheck();
  await card.getByRole("button", { name: "Retry delivery" }).click();
  await page.getByRole("button", { name: "Run delivery worker", exact: true }).click();
  await remote.getByText("Alex Morgan: @maintainer A local reply", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Receive GitHub reply with image" }).click();
  await page.getByRole("link", { name: "screenshot.png — image not copied" }).waitFor();
  await page.getByRole("button", { name: "Close on GitHub", exact: true }).click();
  await page.getByRole("button", { name: "Reopen ticket", exact: true }).waitFor();
  await page.getByRole("button", { name: "Simulate uncertain write" }).click();
  await card.getByText("Awaiting GitHub confirmation", { exact: true }).waitFor();
  assert.equal(await card.getByRole("button", { name: "Retry delivery" }).count(), 0);
  await page.getByRole("button", { name: "Simulate operator recovery" }).click();
  await card.getByText("Synchronized", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Create new sample ticket" }).click();
  await page.getByRole("heading", { name: "New website request" }).waitFor();
  await card.getByText("Delivery pending", { exact: true }).waitFor();
  assert.equal(await card.getByRole("button", { name: "Send to GitHub" }).count(), 0);
  const worker = page.getByRole("button", { name: "Run delivery worker", exact: true });
  const send = card.getByRole("button", { name: "Send to GitHub", exact: true });
  await page.getByLabel("Simulate GitHub failure").check();
  const badge = page.getByRole("button", { name: /^Pending/ });
  await badge.focus();
  await page.keyboard.press("Enter");
  await actionToast(page, "GitHub could not be reached");
  assert.equal(await card.getByRole("alert").count(), 0);
  assert.match(await badge.getAttribute("aria-label"), /Delivery failed/);
  assert.equal(await badge.locator("svg.lucide-unplug").count(), 1);
  const note = "Viewing these images from GitHub requires access to this discussion.";
  assert.equal(await page.getByText(note, { exact: true }).count(), 0);
  await page.getByLabel("Simulate GitHub failure").uncheck();
  await page.getByRole("textbox", { name: "Reply", exact: true }).fill("Still saved locally");
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await worker.click();
  await remote.getByText("No delivery yet.").waitFor();
  await page.getByLabel("Read-only connection").check();
  assert(await send.isDisabled());
  await page.getByLabel("Read-only connection").uncheck();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(value);
      }, theme);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({
        path: `/private/tmp/supports-github-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await badge.focus();
  await page.keyboard.press("Enter");
  await card.getByText("Synchronized", { exact: true }).waitFor();
  await remote.getByText("Alex Morgan: Still saved locally", { exact: true }).waitFor();
  await badge.waitFor({ state: "hidden" });
  await page.getByLabel("Images", { exact: true }).setInputFiles({
    name: "proof.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
  });
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page
    .locator("li")
    .filter({ has: page.getByRole("img", { name: "proof.gif" }) })
    .getByText(note, { exact: true })
    .waitFor();
  assert.equal(await card.getByText(note, { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
});

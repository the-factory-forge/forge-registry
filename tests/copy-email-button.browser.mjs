import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3101";

void test("email copy supports keyboard, narrow layouts and clipboard failure recovery", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (sessionStorage.getItem("clipboard-denied")) throw new Error("Clipboard denied");
          sessionStorage.setItem("copied-email", text);
        },
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/copy-email-button`);
  const copy = page.getByRole("button", { name: "Copy email address", exact: true });
  await copy.focus();
  await page.getByRole("tooltip", { name: "Copy email address", exact: true }).waitFor();
  await copy.press("Escape");
  await page.getByRole("tooltip").waitFor({ state: "hidden" });
  await page.keyboard.press("Enter");
  await page.getByText("Email address copied", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("copied-email")),
    "alex.morgan@example.test",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByText("Email address copied", { exact: true }).waitFor({ state: "hidden" });

  await page.evaluate(() => sessionStorage.setItem("clipboard-denied", "true"));
  await copy.click();
  const failure = page.getByText("Could not copy the email address. Select and copy it manually.", {
    exact: true,
  });
  await failure.waitFor();
  assert.equal(await page.getByText("Email address copied", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await failure.waitFor({ state: "hidden" });
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
  await copy.click();
  await failure.waitFor();

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const dark of [false, true]) {
      const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
      if ((await toggle.getAttribute("aria-pressed")) !== String(dark)) await toggle.click();
      const box = await copy.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.ok(box.height >= (width < 768 ? 40 : 32));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({
        path: `/private/tmp/copy-email-${width}-${dark ? "dark" : "light"}.png`,
        animations: "disabled",
      });
    }
  }
  assert.deepEqual(errors, []);
});

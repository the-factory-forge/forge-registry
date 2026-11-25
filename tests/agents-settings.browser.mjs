import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

let server, browser, base;
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
async function fixture(t, mode, width = 1440, tabs = false) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  t.after(() => page.close());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(
    `${base}tests/fixtures/agents-settings.html?mode=${mode}${tabs ? "&tabs=1" : ""}`,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page;
}
const setupError =
  "AI model setup is incomplete on the server. Contact the person who manages this website’s hosting.";

void test("settings distinguish missing server configuration from other failures", async (t) => {
  for (const mode of ["unconfigured", "load-error", "models-error"]) {
    const page = await fixture(t, mode);
    if (mode === "models-error") {
      await page.getByLabel("API key", { exact: true }).fill("fixture-only");
      await page.getByRole("button", { name: "Load models", exact: true }).click();
    }
    const alert = page.getByRole("alert");
    await alert.waitFor();
    assert.equal(
      await alert.textContent(),
      mode === "load-error"
        ? "Settings could not be loaded. Close and reopen Settings to retry."
        : setupError,
    );
    await page
      .getByRole("heading", { name: "Model settings", exact: true })
      .locator("..")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Model settings", exact: true })
      .waitFor({ state: "hidden" });
  }
});
void test("pending model reads allow Close and Escape and discard departed results", async (t) => {
  for (const width of [1440, 390]) {
    for (const dismissal of ["Close", "Escape"]) {
      const page = await fixture(t, "models", width);
      await page.getByLabel("Provider", { exact: true }).selectOption("deepseek");
      await page.getByLabel("API key", { exact: true }).fill("fixture-only");
      await page.getByRole("button", { name: "Load models", exact: true }).click();
      await page.waitForFunction(() => window.settingsRequests.length === 1);
      const close = page
        .getByRole("heading", { name: "Model settings", exact: true })
        .locator("..")
        .getByRole("button", { name: "Close", exact: true });
      assert.equal(await close.isEnabled(), true);
      if (dismissal === "Close") await close.click();
      else await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Model settings", exact: true })
        .waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByLabel("API key", { exact: true }).waitFor();
      await page.evaluate(() => window.settingsRequests[0].reject());
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.getByLabel("API key", { exact: true }).inputValue(), "");
    }
  }
});
void test("pending Save and Disconnect retain the mutation dismissal guard", async (t) => {
  for (const mode of ["save", "remove"]) {
    const page = await fixture(t, mode);
    if (mode === "save") {
      await page.getByLabel("API key", { exact: true }).fill("fixture-only");
      await page.getByRole("button", { name: "Load models", exact: true }).click();
      await page.getByLabel("Model", { exact: true }).selectOption("sample-model");
      await page.getByRole("button", { name: "Save", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Disconnect", exact: true }).click();
      await page.getByRole("button", { name: "Confirm disconnect", exact: true }).click();
    }
    await page.waitForFunction(() => window.settingsRequests.length === 1);
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .isEnabled(),
      false,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("dialog", { name: "Model settings", exact: true }).isVisible(),
      true,
    );
    await page.evaluate(() => window.settingsRequests[0].resolve());
    await page
      .getByRole("heading", { name: "Model settings", exact: true })
      .locator("..")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Model settings", exact: true })
      .waitFor({ state: "hidden" });
  }
});

void test("saved model settings close through a hovered X after switching tabs", async (t) => {
  for (const width of [1440, 390]) {
    const page = await fixture(t, "remove", width, true);
    const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
    await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('select[id$="-model"]')?.value === "sample-model",
    );
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await close.hover();
    await page.getByRole("tooltip").filter({ hasText: "Close" }).waitFor();
    const icon = await close.locator("svg").boundingBox();
    await page.mouse.click(icon.x + icon.width / 2, icon.y + icon.height / 2);
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: "Settings", exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
    );
  }
});

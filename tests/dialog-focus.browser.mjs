import assert from "node:assert/strict";
import test from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";

await test("single-input dialogs focus the name on every opening and restore trigger focus", async (t) => {
  const server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  t.after(() => server.close());
  await server.listen();
  const baseURL = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: touch ? 390 : 1440, height: 844 },
      hasTouch: touch,
      isMobile: touch,
      colorScheme: touch ? "dark" : "light",
    });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}tests/fixtures/dialog-focus.html`);
    for (const mode of ["create", "rename", "duplicate", "delete"]) {
      const trigger = page.locator("button").filter({ hasText: new RegExp(`^${mode}$`) });
      for (let opening = 0; opening < 2; opening++) {
        if (touch) await trigger.tap();
        else if (opening) {
          await trigger.focus();
          await page.keyboard.press("Enter");
        } else await trigger.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        if (mode !== "delete") {
          const input = dialog.getByRole("textbox", { name: "Name", exact: true });
          await page.waitForFunction(
            () => document.querySelector('[role="dialog"] input') === document.activeElement,
          );
          await page.keyboard.type("Typed immediately");
          assert.ok((await input.inputValue()).includes("Typed immediately"));
          if (mode === "create") {
            await dialog.getByRole("button", { name: "Create", exact: true }).click();
            await dialog.getByRole("alert").waitFor();
            assert.equal(await input.inputValue(), "Typed immediately");
          }
          if (!opening && mode === "rename")
            await page.screenshot({
              path: `/tmp/dialog-focus-${touch ? "mobile-dark" : "desktop-light"}.png`,
            });
        } else {
          assert.equal(await dialog.getByRole("textbox").count(), 0);
          await page.waitForFunction((touch) => {
            const popup = document.querySelector('[role="dialog"]');
            return (
              document.activeElement ===
              (touch ? popup : popup?.querySelector("button:not(:disabled)"))
            );
          }, touch);
        }
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        await page.waitForFunction((mode) => document.activeElement?.textContent === mode, mode);
      }
    }
    assert.deepEqual(errors, []);
  }
});

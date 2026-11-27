import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => browser?.close());

const editors = [
  {
    route: "/en/admin/menus/30000000-0000-4000-8000-000000000001",
    back: "Items",
    field: "Name *",
    heading: "Edit item",
    message: "Loading…",
  },
  {
    route: "/en/customers/acme",
    back: "Customers",
    field: "Full name *",
    heading: "Acme Studio",
    message: "Loading customers…",
  },
  {
    route: "/en/projects/website",
    back: "Projects",
    field: "Name *",
    heading: "Studio website",
    message: "Loading projects…",
  },
  {
    route: "/en/intranet/supports/sample-1",
    back: "Support",
    field: "Reply",
    heading: "Contact form confirmation is missing",
    message: "Loading tickets…",
    setting: "List state",
    ready: "normal",
  },
];

for (const {
  route,
  back,
  field,
  heading,
  message,
  setting = "Directory state",
  ready = "ready",
} of editors) {
  for (const width of [1440, 390]) {
    void test(`${heading} shows a safe loading shell at ${width}px`, async (t) => {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      t.after(() => page.close());
      await page.goto(base + route);
      if (width === 390) {
        await page.getByRole("button", { name: "Dark mode", exact: true }).click();
        await page.getByRole("button", { name: "Settings", exact: true }).click();
      }
      const stage = page.locator("#factory-showroom-preview");
      const title = stage.getByRole("heading", { name: heading, exact: true });
      const status = stage.getByRole("status").filter({ hasText: message });
      const backLink = stage.getByRole("link", { name: back, exact: true }).last();
      const input = stage.getByRole("textbox", { name: field, exact: true });

      await title.waitFor();
      const beforeLoad = await input.evaluate(
        (element) => element.getBoundingClientRect().top + window.scrollY,
      );
      await page.getByLabel(setting).selectOption("loading");
      await status.waitFor();
      assert.equal(await input.isDisabled(), true);
      assert.equal(await input.inputValue(), "");
      assert.equal(await backLink.isEnabled(), true);
      assert.equal(await title.count(), 0);
      assert.equal(await stage.getByRole("button", { name: "Save", exact: true }).count(), 0);
      await page
        .locator('[data-slot="loading-indicator"][data-state="loading"]')
        .waitFor({ state: "attached" });
      if (width === 390)
        assert.equal(
          await status
            .locator("svg")
            .evaluate((element) => getComputedStyle(element).animationName),
          "none",
        );
      if (setting === "Directory state") {
        const duringLoad = await input.evaluate(
          (element) => element.getBoundingClientRect().top + window.scrollY,
        );
        assert.ok(
          Math.abs(duringLoad - beforeLoad) <= 4,
          `${heading}: ${beforeLoad} → ${duringLoad}`,
        );
      }
      await page.getByLabel(setting).selectOption(ready);
      await title.waitFor();
      await status.waitFor({ state: "hidden" });
      assert.equal(await input.isEnabled(), true);
      await page
        .locator('[data-slot="loading-indicator"][data-state="idle"]')
        .waitFor({ state: "attached" });
    });
  }
}

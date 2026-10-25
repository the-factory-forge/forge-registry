import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const directory = "/en/admin/blogs";
const editor = `${directory}/b1000000-0000-4000-8000-000000000001`;
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

for (const width of [1280, 390]) {
  for (const action of ["clean", "Discard changes", "Save draft", "categories"]) {
    void test(`blog navigation keeps one navbar without a preview iframe: ${action}, ${width}px`, async (t) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      t.after(() => context.close());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + editor);
      if (action !== "clean") {
        await page.getByRole("textbox", { name: "Title", exact: true }).fill("Navbar regression");
      }
      const destination = action === "categories" ? `${directory}/categories` : directory;
      const response = page.waitForResponse(
        (value) =>
          value.request().resourceType() === "document" &&
          new URL(value.url()).pathname === destination,
      );
      await page
        .getByRole("link", {
          name: action === "categories" ? "Manage categories" : "← Back to posts",
          exact: true,
        })
        .click();
      if (action !== "clean") {
        await page
          .getByRole("dialog", { name: "Keep your changes?", exact: true })
          .getByRole("button", {
            name: action === "categories" ? "Discard changes" : action,
            exact: true,
          })
          .click();
      }
      // Inspect the server document: a post-hydration count misses the duplicate-navbar flash.
      const document = await response;
      assert.equal(document.status(), 200);
      assert.equal((await document.text()).match(/aria-label="Showroom navigation"/g)?.length, 1);
      await page.locator('[data-preview-ready="true"]').waitFor();
      if (action === "categories") {
        await page.getByRole("link", { name: "← Back to posts", exact: true }).click();
      }
      await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor();
      await page.shell.waitForURL(base + directory);
      assert.equal(
        await page.shell.getByRole("navigation", { name: "Showroom navigation" }).count(),
        1,
      );
      assert.equal(await page.frames().length, 1);
      assert.equal(await page.locator("#factory-device-preview").count(), 0);
      assert.deepEqual(errors, []);
    });
  }
}

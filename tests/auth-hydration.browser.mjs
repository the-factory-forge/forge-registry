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

for (const view of ["login", "forgot-password", "reset-password"]) {
  void test(`${view} waits for hydration before accepting credentials or submission`, async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { promise: scriptsReady, resolve: releaseScripts } = Promise.withResolvers();
    t.after(releaseScripts);
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    await page.goto(`${baseURL}/en/${view}`, { waitUntil: "commit" });
    const form = page.locator("#factory-auth-main-content form");
    await form.waitFor();
    const controls = form.locator("input, button");
    assert.ok(await controls.count());
    assert.deepEqual(
      await controls.evaluateAll((nodes) =>
        nodes.filter((node) => !node.matches(":disabled")).map((node) => node.name || node.type),
      ),
      [],
      "SSR controls must not accept input or submit before their handlers are attached",
    );
    assert.equal(await form.getAttribute("method"), "post");
    if (view === "login")
      assert.equal(
        await page.getByRole("button", { name: "Continue with Google" }).isDisabled(),
        true,
      );
    const navigations = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) navigations.push(request.method());
    });
    await form.locator('button[type="submit"]').evaluate((button) => button.click());
    assert.deepEqual(navigations, []);

    releaseScripts();
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.getByLabel("Simulate action failures").check();
    if (view !== "reset-password")
      await form.locator('input[type="email"]').fill("hydration@example.test");
    if (view !== "forgot-password")
      await form.locator('input[type="password"]').fill("Hydration-test-password");
    await form.locator('button[type="submit"]').click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByTestId("callback-count").textContent(), "1");
    assert.deepEqual(navigations, [], "Hydrated submissions must use the host callback");
    if (view !== "forgot-password")
      assert.equal(
        await form.locator('input[type="password"]').inputValue(),
        "Hydration-test-password",
      );
    assert.deepEqual(errors, []);
  });
}

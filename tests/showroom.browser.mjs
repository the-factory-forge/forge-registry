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

test("Start serves deep links, SSR documents, locale redirects, and registry endpoints", async () => {
  for (const [path, heading] of [
    ["/", "Components Showcase"],
    ["/en/projects/new?customerId=acme", "New Project"],
    ["/en/projects/website/drive", "Studio website"],
    ["/en/customers/acme/projects", "Acme Studio"],
    ["/en/admin/blogs", "Blog posts"],
    ["/en/blogs/make-room-for-better-ideas", "Make room for better ideas"],
  ]) {
    const response = await fetch(baseURL + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, new RegExp(heading));
    assert.match(html, /Showroom navigation/);
    assert.doesNotMatch(html, /\/_next\//);
  }
  const redirect = await fetch(`${baseURL}/projects/new?customerId=acme`, {
    redirect: "manual",
    headers: { "accept-language": "en" },
  });
  assert.equal(redirect.status, 307);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/en/projects/new");
  const endpoint = await fetch(`${baseURL}/r/projects.json`);
  assert.match(endpoint.headers.get("content-type"), /application\/json/);
  assert.equal((await endpoint.json()).name, "projects");
  assert.equal((await fetch(`${baseURL}/xx/customers`)).status, 404);
  assert.equal((await fetch(`${baseURL}/missing-page`)).status, 404);
});

test("every directory entry navigates and returns through a stable shared header", async (t) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Components Showcase" }).waitFor();
  const destinations = await page
    .locator("main a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.equal(destinations.length, 12);
  const header = page.getByRole("navigation", { name: "Showroom navigation" });
  const original = await header.boundingBox();
  for (const href of destinations) {
    await page.locator(`main a[href="${href}"]`).click();
    await page.waitForURL(baseURL + href);
    assert.deepEqual(await header.boundingBox(), original, href);
    await header.getByRole("link", { name: "All components" }).click();
    await page.getByRole("heading", { name: "Components Showcase" }).waitFor();
  }
  assert.deepEqual(errors, []);
});

test("keyboard entry skips the showroom controls without changing the preview hash", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  for (const path of ["/en/projects", "/en/login", "/en/intranet#team"]) {
    await page.goto(baseURL + path);
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Skip to preview",
    );
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "showroom-preview");
    assert.equal(page.url(), baseURL + path);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => Boolean(document.activeElement.closest("#showroom-preview"))),
      true,
    );
  }
});

test("expanded settings stay beside desktop previews and stack on mobile", async (t) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  for (const path of ["/en/intranet", "/en/login", "/en/projects/new", "/en/admin/blogs"]) {
    await page.goto(baseURL + path);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const controls = page.getByRole("complementary", { name: "Preview controls" });
    assert.equal(await controls.locator("details, summary").count(), 0);
    const rail = await controls.boundingBox();
    const preview = await page.locator("#showroom-preview").boundingBox();
    assert.equal(rail.y, 56, path);
    assert.equal(
      rail.x + rail.width,
      await page.locator(".showroom-frame").evaluate((el) => el.getBoundingClientRect().right),
      path,
    );
    assert.ok(preview.x + preview.width <= rail.x, path);
    if (path === "/en/intranet") {
      await page.getByLabel("Use a custom topbar").check();
      assert.equal((await page.locator('[data-slot="sidebar"]').boundingBox()).y, 56);
    }
    if (path === "/en/login") {
      assert.equal(
        await page
          .locator(".showroom-fill")
          .evaluate((el) => parseFloat(getComputedStyle(el).minHeight)),
        844,
      );
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    assert.ok(Math.abs((await controls.boundingBox()).y - 56) < 1, path);
  }
  // Settings remain reachable when the desktop viewport is short.
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.goto(`${baseURL}/en/projects`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await page.getByLabel("Directory state").selectOption("error");
  await page.getByRole("alert").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/en/login", "/en/projects", "/en/blogs", "/en/intranet-sidebar"]) {
      await page.goto(baseURL + path);
      await page.locator('[data-preview-ready="true"]').waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        path,
      );
      const rail = await page
        .getByRole("complementary", { name: "Preview controls" })
        .boundingBox();
      const preview = await page.locator("#showroom-preview").boundingBox();
      assert.ok(rail.y + rail.height <= preview.y, path);
      const header = await page
        .getByRole("navigation", { name: "Showroom navigation" })
        .locator("..")
        .boundingBox();
      assert.equal(header.height, 56);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseURL);
  assert.equal(await page.locator(".showroom-controls").count(), 0);
  assert.equal((await page.locator("#showroom-preview").boundingBox()).width, 1280);
});

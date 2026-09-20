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
  assert.equal(destinations.length, 10);
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

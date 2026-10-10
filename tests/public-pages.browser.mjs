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

test("newsletter demo retains input after failure and supports retry and disabled states", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${baseURL}/newsletter`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const email = page.getByRole("textbox", { name: "Email address", exact: true });
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "valid email" }).waitFor();
  await email.fill("reader@example.test");
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not subscribe." }).waitFor();
  assert.equal(await email.inputValue(), "reader@example.test");
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Subscription received." }).waitFor();
  await page.getByLabel("Disable form", { exact: true }).check();
  assert.equal(await email.isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: "Subscribe", exact: true }).isDisabled(),
    true,
  );
});

test("shared page header is discoverable and supports optional copy and breadcrumb navigation", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(baseURL);
  await page.locator('[data-preview-ready="true"]').waitFor();
  for (const category of ["All", "Component"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    assert.equal(await page.locator('main a[href="/page-hero"]').count(), 1);
  }
  await page.locator('main a[href="/page-hero"]').click();
  await page.getByRole("heading", { level: 1, name: "Page header", exact: true }).waitFor();
  const preview = page.locator("#factory-showroom-preview");
  await preview.getByText("Help", { exact: true }).waitFor();
  await page.getByLabel("Eyebrow", { exact: true }).uncheck();
  assert.equal(await preview.getByText("Help", { exact: true }).count(), 0);
  await page.getByLabel("Subtitle", { exact: true }).uncheck();
  assert.equal(await preview.locator("p").count(), 0);
  await page.getByLabel("Eyebrow", { exact: true }).check();
  await page.getByLabel("Subtitle", { exact: true }).check();
  await preview.getByText("Help", { exact: true }).waitFor();
  await preview.getByText("The shared header for FAQ, Contact, and other inner pages.").waitFor();
  const home = preview.getByRole("link", { name: "All components", exact: true });
  await home.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Components Showcase" }).waitFor();
});

test("FAQ categories close answers and preserve keyboard navigation", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseURL}/en/faq`);
  assert.match(await response.text(), /Tell us about your project/);
  await page.locator('[data-preview-ready="true"]').waitFor();
  const first = page.getByRole("button", { name: "How do we start?", exact: true });
  await first.focus();
  await page.keyboard.press("Enter");
  await page
    .getByText("Tell us about your project and we will arrange an initial conversation.")
    .waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Can we meet remotely?",
  );
  await page.keyboard.press("Space");
  await page.getByText("Yes. Meetings can take place online or at our studio.").waitFor();
  assert.equal(await first.getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "Working together", exact: true }).click();
  const other = page.getByRole("button", { name: "Can I request changes?", exact: true });
  assert.equal(await other.getAttribute("aria-expanded"), "false");
  assert.equal(await first.count(), 0);
  await other.click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  assert.equal(await other.getAttribute("aria-expanded"), "false");
  await page.getByLabel("Category filters", { exact: true }).uncheck();
  assert.equal(await page.getByRole("group", { name: "Filter questions" }).count(), 0);
  await page.getByLabel("Empty list").check();
  await page.getByText("No questions yet.").waitFor();
  assert.deepEqual(errors, []);
});

test("public pages are discoverable, responsive, and retain contact links and optional map", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route("https://www.google.com/maps/embed?*", (route) =>
    route.fulfill({ contentType: "text/html", body: "Map embed test fixture" }),
  );
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.locator('[data-preview-ready="true"]').waitFor();
  for (const category of ["All", "Page"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    assert.equal(await page.locator('main a[href="/en/faq"]').count(), 1);
    assert.equal(await page.locator('main a[href="/en/contact"]').count(), 1);
    assert.equal(await page.locator('main a[href="/en/legal/cgv"]').count(), 1);
  }
  const search = page.getByRole("searchbox", { name: "Search examples" });
  await search.fill("analytics");
  await page.getByRole("status").filter({ hasText: "No examples found." }).waitFor();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator('main a[href="/cookie-banner"]').waitFor();
  for (const keyword of ["login", "forgotten", "reset", "change password"]) {
    await search.fill(keyword);
    await page.locator('main a[href="/en/auth"]').waitFor();
    await page.locator('main a[href="/cookie-banner"]').waitFor({ state: "hidden" });
  }
  await search.fill("privacy policy");
  await page.locator('main a[href="/en/legal/cgv"]').waitFor();
  await page.locator('main a[href="/en/auth"]').waitFor({ state: "hidden" });
  await search.fill("loading retries");
  await page.getByRole("status").filter({ hasText: "No examples found." }).waitFor();
  await search.fill("  CONTACT  ");
  await page.locator('main a[href="/en/contact"]').waitFor();
  await page.locator('main a[href="/en/faq"]').waitFor({ state: "hidden" });
  assert.equal(await page.locator('main a[href="/en/faq"]').count(), 0);
  await page.locator('main a[href="/en/contact"]').click();
  await page.getByRole("heading", { name: "Contact us", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "support@the-corner.io" }).getAttribute("href"),
    "mailto:support@the-corner.io",
  );
  assert.equal(
    await page.getByRole("link", { name: "+41 79 963 47 74" }).getAttribute("href"),
    "tel:+41799634774",
  );
  assert.equal(
    await page.getByRole("link", { name: "Rue de Saint-Guérin 6, 1950 Sion" }).getAttribute("href"),
    "https://www.google.com/maps/place/The+Corner+Factory+SA/data=!4m2!3m1!1s0x0:0xce2ae13c0797074c",
  );
  await page.getByRole("heading", { name: "The Corner Factory SA", exact: true }).waitFor();
  assert.deepEqual(await page.locator("main dd").allTextContents(), ["09:00–16:00", "Closed"]);
  const map = page.locator('iframe[title="The Corner Factory SA location"]');
  assert.match(await map.getAttribute("src"), /^https:\/\/www\.google\.com\/maps\/embed\?/);
  assert.match(await map.getAttribute("src"), /0xce2ae13c0797074c/);
  await map.scrollIntoViewIfNeeded();
  await page
    .frameLocator('iframe[title="The Corner Factory SA location"]')
    .getByText("Map embed test fixture")
    .waitFor();
  await page.getByLabel("Map embed", { exact: true }).uncheck();
  assert.equal(await map.count(), 0);
  await page.getByText("Enable Map embed to view The Corner Factory SA in Sion.").waitFor();
  await page.getByLabel("Map embed", { exact: true }).check();
  await map.waitFor();
  await page.getByLabel("Contact details", { exact: true }).uncheck();
  assert.equal(await page.locator('main a[href^="mailto:"]').count(), 0);
  for (const theme of ["Light", "Dark"]) {
    const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
      await toggle.click();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/page-hero",
        "/en/faq",
        "/en/contact",
        "/en/legal/cgv",
        "/en/legal/privacy",
        "/en/legal/mentions",
      ]) {
        await page.goto(baseURL + path);
        await page.locator('[data-preview-ready="true"]').waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${path} ${width} ${theme}`,
        );
      }
    }
  }
});

test("legal pages render on the server and preserve document navigation and optional copy", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseURL}/en/legal/cgv`);
  assert.match(
    await response.text(),
    /Use this section to present the terms approved for your website/,
  );
  await page.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(await page.locator("main h1").textContent(), "Terms and conditions");
  await page.getByLabel("Last updated date", { exact: true }).uncheck();
  assert.equal(
    await page
      .getByText("Last updated", { exact: false })
      .filter({ hasNot: page.locator("input") })
      .count(),
    0,
  );
  await page.getByLabel("Introduction", { exact: true }).uncheck();
  assert.equal(
    await page.locator("article").getByText("Example content", { exact: false }).count(),
    0,
  );
  for (const title of ["Privacy policy", "Legal notice", "Terms and conditions"]) {
    const link = page.getByRole("link", { name: title, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
    assert.equal(await link.getAttribute("aria-current"), "page");
  }
  assert.equal(
    await page
      .locator("article section p")
      .first()
      .evaluate((element) => getComputedStyle(element).whiteSpace),
    "pre-line",
  );
  assert.deepEqual(errors, []);
});

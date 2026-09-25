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
    await page.getByRole("link", { name: "hello@example.com" }).getAttribute("href"),
    "mailto:hello@example.com",
  );
  assert.equal(
    await page.getByRole("link", { name: "+41 22 555 01 23" }).getAttribute("href"),
    "tel:+41225550123",
  );
  await page.getByLabel("Map embed", { exact: true }).check();
  await page.locator('iframe[title="Studio location"]').scrollIntoViewIfNeeded();
  await page
    .frameLocator('iframe[title="Studio location"]')
    .getByText("Local map placeholder")
    .waitFor();
  await page.getByLabel("Contact details", { exact: true }).uncheck();
  assert.equal(await page.locator('main a[href^="mailto:"]').count(), 0);
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
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

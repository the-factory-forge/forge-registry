import assert from "node:assert/strict";
import { after, before, suite, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const consentKey = "forge-registry-cookie-consent";
const measurementId = "G-BW401E4QH9";

async function stubGoogle(context) {
  // Exercise the real loader without sending test traffic to the Registry's GA4 property.
  await context.route("https://www.googletagmanager.com/gtag/js?*", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
}

async function waitForTag(page) {
  await page.waitForFunction(
    (id) => window.dataLayer?.some((entry) => entry[0] === "config" && entry[1] === id),
    measurementId,
  );
}

await suite("Showroom site consent", async () => {
  let browser;
  before(async () => {
    browser = await chromium.launch();
  });
  after(async () => browser?.close());

  await test("visitors can save, restore and revise their showroom cookie preferences", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    await stubGoogle(context);
    const page = await context.newPage();
    const tracking = [];
    page.on("request", (request) => {
      if (/google-analytics\.com|googletagmanager\.com/.test(request.url()))
        tracking.push(request.url());
    });
    await page.goto(baseURL);
    const dialog = page.getByRole("dialog", { name: "Registry cookies", exact: true });
    await dialog.waitFor();
    assert.equal(await page.locator("#factory-cookie-banner").count(), 1);
    assert.deepEqual(await dialog.getByRole("button").allTextContents(), [
      "Custom selection",
      "Accept all",
    ]);
    await dialog.getByRole("button", { name: "Custom selection", exact: true }).click();
    assert.equal(await dialog.getByRole("checkbox", { name: /^Necessary/ }).isDisabled(), true);
    assert.equal(await dialog.getByRole("checkbox", { name: /^Statistics/ }).isChecked(), false);
    assert.equal(await dialog.getByRole("checkbox", { name: /^Marketing/ }).count(), 0);
    await dialog.getByRole("button", { name: "Confirm selection", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), consentKey),
      { necessary: true, analytics: false, marketing: false },
    );
    await page.goto(`${baseURL}/en/faq?search=private-demo#demo`);
    await page.waitForFunction(() => window.__forgeGoogleConsent?.analytics === false);
    assert.deepEqual(tracking, []);
    assert.equal(await dialog.isVisible(), false);
    await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
    await dialog.getByRole("button", { name: "Accept all", exact: true }).click();
    await waitForTag(page);
    await page.waitForFunction(() =>
      window.dataLayer?.some((entry) => entry[0] === "event" && entry[1] === "page_view"),
    );
    assert.deepEqual(
      await page.evaluate(() =>
        window.dataLayer
          .filter((entry) => entry[0] === "event" && entry[1] === "page_view")
          .map((entry) => entry[2].page_location),
      ),
      [`${baseURL}/en/faq`],
    );
    assert.deepEqual(tracking, [`https://www.googletagmanager.com/gtag/js?id=${measurementId}`]);
    assert.equal(await page.evaluate((id) => window[`ga-disable-${id}`], measurementId), false);
    const otherTab = await context.newPage();
    await otherTab.goto(`${baseURL}/en/faq`);
    await waitForTag(otherTab);
    await page
      .getByRole("navigation", { name: "Showroom navigation" })
      .getByRole("link", { name: "All components", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.dataLayer?.some(
        (entry) =>
          entry[0] === "event" && entry[1] === "page_view" && entry[2].page_location.endsWith("/"),
      ),
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view")
            .length,
      ),
      2,
    );
    await page.reload();
    await page.waitForFunction(() => window.__forgeGoogleConsent?.analytics === true);
    await waitForTag(page);
    assert.equal(await dialog.isVisible(), false);
    await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
    await dialog.getByRole("button", { name: "Custom selection", exact: true }).click();
    assert.equal(await dialog.getByRole("checkbox", { name: /^Statistics/ }).isChecked(), true);
    await dialog.getByRole("checkbox", { name: /^Statistics/ }).uncheck();
    await dialog.getByRole("button", { name: "Confirm selection", exact: true }).click();
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), consentKey),
      { necessary: true, analytics: false, marketing: false },
    );
    await otherTab.waitForFunction((id) => window[`ga-disable-${id}`] === true, measurementId);
    assert.equal(await page.evaluate((id) => window[`ga-disable-${id}`], measurementId), true);
    assert.equal(tracking.length, 2);
    await page.reload();
    await page.waitForFunction((id) => window[`ga-disable-${id}`] === true, measurementId);
    assert.equal(await page.locator("script[data-forge-analytics]").count(), 0);
    assert.equal(tracking.length, 2);
  });

  await test("navigation records the rendered page, including Back and Forward", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    await stubGoogle(context);
    const page = await context.newPage();
    await page.goto(`${baseURL}/en/faq?search=private-demo#demo`);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await waitForTag(page);
    const faqTitle = await page.title();
    await page
      .getByRole("navigation", { name: "Showroom navigation" })
      .getByRole("link", { name: "All components", exact: true })
      .click();
    await page.waitForFunction((previous) => document.title !== previous, faqTitle);
    const homeTitle = await page.title();
    await page.goBack();
    await page.waitForFunction((title) => document.title === title, faqTitle);
    await page.goForward();
    await page.waitForFunction((title) => document.title === title, homeTitle);
    await page.waitForFunction(
      () => window.dataLayer.filter((entry) => entry[0] === "event").length === 4,
    );
    assert.deepEqual(
      await page.evaluate(() =>
        window.dataLayer
          .filter((entry) => entry[0] === "event" && entry[1] === "page_view")
          .map((entry) => [entry[2].page_location, entry[2].page_title, entry[2].page_referrer]),
      ),
      [
        [`${baseURL}/en/faq`, faqTitle, ""],
        [`${baseURL}/`, homeTitle, `${baseURL}/en/faq`],
        [`${baseURL}/en/faq`, faqTitle, `${baseURL}/`],
        [`${baseURL}/`, homeTitle, `${baseURL}/en/faq`],
      ],
    );
  });

  await test("the cookie component demo cannot grant site consent or render a second banner", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    await stubGoogle(context);
    const page = await context.newPage();
    const scriptRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("googletagmanager.com/gtag/js"))
        scriptRequests.push(request.url());
    });
    await page.goto(`${baseURL}/cookie-banner`);
    const preview = page.getByRole("dialog", { name: "Cookies", exact: true });
    await preview.waitFor();
    assert.equal(await page.locator("#factory-cookie-banner").count(), 1);
    assert.equal(await page.getByRole("dialog", { name: "Registry cookies" }).count(), 0);
    await preview.getByRole("button", { name: "Accept all", exact: true }).click();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), consentKey), null);
    await page.goto(baseURL);
    await page.getByRole("dialog", { name: "Registry cookies", exact: true }).waitFor();
    assert.equal(await page.locator("#factory-cookie-banner").count(), 1);
    assert.equal(await page.locator("script[data-forge-analytics]").count(), 0);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await waitForTag(page);
    const homeTitle = await page.title();
    await page.locator('a[href="/cookie-banner"]').first().click();
    await page.waitForFunction((id) => window[`ga-disable-${id}`] === true, measurementId);
    await page.getByRole("button", { name: "Open cookie banner", exact: true }).click();
    await preview.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.waitForFunction(() =>
      window.dataLayer.some((entry) => entry[0] === "config" && entry[1] === "G-SHOWROOM"),
    );
    assert.equal(await page.locator("script[data-forge-analytics]").count(), 0);
    assert.equal(await page.evaluate((id) => window[`ga-disable-${id}`], measurementId), true);
    await page
      .getByRole("navigation", { name: "Showroom navigation" })
      .getByRole("link", { name: "All components", exact: true })
      .click();
    await page.waitForFunction((id) => window[`ga-disable-${id}`] === false, measurementId);
    await waitForTag(page);
    await page.waitForFunction(() =>
      window.dataLayer.some((entry) => entry[0] === "event" && entry[1] === "page_view"),
    );
    await page.waitForFunction((title) => document.title === title, homeTitle);
    assert.equal(
      await page.evaluate(
        () => window.dataLayer.filter((entry) => entry[0] === "event").at(-1)[2].page_title,
      ),
      homeTitle,
    );
    assert.equal(await page.locator("script[data-forge-analytics]").count(), 1);
    assert.equal(scriptRequests.length, 2);
    assert.equal(
      await page.evaluate(() =>
        window.dataLayer.some(
          (entry) => entry[0] === "config" && ["G-SHOWROOM", "AW-123456789"].includes(entry[1]),
        ),
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        (id) => window.dataLayer.filter((entry) => entry[0] === "config" && entry[1] === id).length,
        measurementId,
      ),
      1,
    );
  });

  await test("a blocked Google tag leaves the site usable and can be retried", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    let attempts = 0;
    await context.route("https://www.googletagmanager.com/gtag/js?*", (route) => {
      attempts++;
      return attempts === 1
        ? route.abort()
        : route.fulfill({ contentType: "application/javascript", body: "" });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("script[data-forge-analytics]"));
    await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await waitForTag(page);
    assert.equal(attempts, 2);
    assert.deepEqual(errors, []);
  });
});

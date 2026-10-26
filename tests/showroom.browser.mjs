import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { chromium } from "./showroom-browser.mjs";

await suite("Showroom browser", async () => {
  const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
  let browser;
  before(async () => {
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
  });

  await test("intranet Drive badge describes its sample count and preserves navigation", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseURL}/en/intranet`);
      if (width < 768) await page.getByRole("button", { name: "Toggle side navigation" }).click();
      const navigation = page.getByRole("navigation", { name: "Side navigation", exact: true });
      const drive = navigation
        .getByRole("region", { name: "Plugins", exact: true })
        .getByRole("link", { name: "Drive 3 unreviewed changes" });
      await drive.waitFor({ state: "visible" });
      assert.equal(await navigation.getByText("My account", { exact: true }).count(), 0);
      assert.equal(await navigation.getByRole("link", { name: "Profile settings" }).count(), 0);
      assert.equal(await drive.getAttribute("href"), "#drive");
      await drive.press("Enter");
      await page.waitForURL("**/en/intranet#drive");
      await page.getByText("Current destination: #drive").waitFor();
      if (width < 768) await page.getByRole("button", { name: "Toggle side navigation" }).click();
      assert.equal(await drive.getAttribute("aria-current"), "page");
      assert.equal(await page.getByRole("link", { name: "Team", exact: true }).count(), 1);
    }
  });

  await test("mailing samples have direct links and restore their previews through navigation", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const samples = [
      ["verify-email", "Verify your email"],
      ["reset-password", "Reset your password"],
      ["reservation-confirmation", "Your stay is confirmed"],
    ];
    const navigation = page.getByRole("navigation", { name: "Preview navigation" });
    const preview = page.frameLocator('iframe[title="Email preview"]');
    for (const [slug, heading] of [["", "Verify your email"], ...samples]) {
      const response = await page.goto(`${baseURL}/mailing${slug ? `/${slug}` : ""}`);
      assert.equal(response.status(), 200);
      await page.locator('[data-preview-ready="true"]').waitFor();
      await preview.getByRole("heading", { name: heading, exact: true }).waitFor();
      assert.equal(await navigation.getByRole("link").count(), 3);
      assert.equal(await page.getByRole("combobox").count(), 0);
      assert.equal(
        await navigation.getByRole("link", { name: heading }).getAttribute("aria-current"),
        "page",
      );
      for (const [linkSlug, linkHeading] of samples) {
        assert.equal(
          await navigation.getByRole("link", { name: linkHeading }).getAttribute("href"),
          `/mailing/${linkSlug}`,
        );
      }
      await page.getByLabel("Plain-text version").check();
      assert.match(await page.locator("pre").textContent(), new RegExp(heading, "i"));
      await page.getByLabel("Plain-text version").uncheck();
      await page.reload();
      await preview.getByRole("heading", { name: heading, exact: true }).waitFor();
    }
    await navigation.getByRole("link", { name: "Reset your password" }).press("Enter");
    await page.waitForURL(`${baseURL}/mailing/reset-password`);
    await preview.getByRole("heading", { name: "Reset your password", exact: true }).waitFor();
    await navigation.getByRole("link", { name: "Verify your email" }).click();
    await page.waitForURL(`${baseURL}/mailing/verify-email`);
    await preview.getByRole("heading", { name: "Verify your email", exact: true }).waitFor();
    await page.goBack();
    await page.waitForURL(`${baseURL}/mailing/reset-password`);
    await preview.getByRole("heading", { name: "Reset your password", exact: true }).waitFor();
    await page.goForward();
    await page.waitForURL(`${baseURL}/mailing/verify-email`);
    await preview.getByRole("heading", { name: "Verify your email", exact: true }).waitFor();
    for (const path of ["/mailing/missing", "/mailing/verify-email/extra"]) {
      assert.equal((await fetch(baseURL + path)).status, 404);
    }
    assert.deepEqual(errors, []);
  });

  await test("Start serves deep links, SSR documents, locale redirects, and registry endpoints", async () => {
    for (const [path, heading] of [
      ["/", "Components Showcase"],
      ["/en/projects/new?customerId=acme", "New project"],
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

  await test("auth navigation points to localized login", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    for (const locale of ["fr", "en", "de", "it"]) {
      await page.goto(`${baseURL}/${locale}/login`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const signIn = page
        .getByRole("navigation", { name: "Authentication examples" })
        .getByRole("link", { name: "Sign in", exact: true });
      assert.equal(await signIn.getAttribute("href"), `/${locale}/login`);
      assert.equal(await signIn.getAttribute("aria-current"), "page");
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        `https://registry.the-corner.io/${locale}/login`,
      );
    }
    assert.equal((await fetch(`${baseURL}/en/change-password`)).status, 404);
    assert.equal(await page.locator('a[href$="/change-password"]').count(), 0);
    for (const path of ["forgot-password", "reset-password", "access-denied", "account"]) {
      await page.goto(`${baseURL}/en/${path}`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const loginLink = page.locator('a[href="/en/login"]').first();
      await loginLink.click();
      await page.waitForURL(`${baseURL}/en/login`);
    }
  });

  await test("directory filters persist in the URL across reloads and browser navigation", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const search = page.getByRole("searchbox", { name: "Search examples" });
    const cards = page.getByRole("region", { name: "Examples", exact: true }).getByRole("link");
    const allCount = await cards.count();
    const historyLength = await page.evaluate(() => history.length);

    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("category") === "Page");
    await search.pressSequentially("faq");
    await page.waitForURL((url) => url.searchParams.get("search") === "faq");
    assert.equal(new URL(page.url()).searchParams.get("category"), "Page");
    assert.equal(await page.evaluate(() => history.length), historyLength);
    assert.equal(await search.evaluate((input) => document.activeElement === input), true);
    assert.equal(await cards.count(), 1);
    const filteredURL = page.url();

    const html = await (await fetch(filteredURL)).text();
    const serverState = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return {
        category: doc.querySelector(
          '#factory-showroom-preview fieldset button[aria-pressed="true"]',
        )?.textContent,
        search: doc.querySelector('input[type="search"]')?.value,
        titles: [...doc.querySelectorAll('section[aria-label="Examples"] h2')].map(
          (heading) => heading.textContent,
        ),
      };
    }, html);
    assert.match(serverState.category, /^Page/);
    assert.equal(serverState.search, "faq");
    assert.deepEqual(serverState.titles, ["FAQ"]);

    await page.reload();
    await page.locator('[data-preview-ready="true"]').waitFor();
    assert.equal(await search.inputValue(), "faq");
    assert.equal(
      await page.getByRole("button", { name: "Page", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await cards.first().click();
    await page.waitForURL(`${baseURL}/en/faq`);
    await page.goBack();
    await page.waitForURL(filteredURL);
    assert.equal(await search.inputValue(), "faq");
    assert.equal(await cards.count(), 1);
    await page.goForward();
    await page.waitForURL(`${baseURL}/en/faq`);
    await page.goBack();
    await page.waitForURL(filteredURL);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("category"));
    assert.equal(await search.inputValue(), "faq");
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page.getByRole("button", { name: "Clear search examples", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("search"));
    assert.equal(new URL(page.url()).searchParams.get("category"), "Page");

    const specialSearch = "  café & tea? #1  ";
    await search.fill(specialSearch);
    await page.waitForURL((url) => url.searchParams.get("search") === specialSearch);
    await page.reload();
    await page.locator('[data-preview-ready="true"]').waitFor();
    assert.equal(await search.inputValue(), specialSearch);
    assert.equal(await cards.count(), 0);
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await page.waitForURL((url) => !url.search);
    assert.equal(await search.inputValue(), "");
    assert.equal(await cards.count(), allCount);
    assert.equal(
      await page
        .getByRole("button", { name: "All", exact: true })
        .evaluate((button) => document.activeElement === button),
      true,
    );

    await page.goto(`${baseURL}/?category=unknown&search=faq`);
    assert.equal(
      await page.getByRole("button", { name: "All", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await search.inputValue(), "faq");
    assert.equal(await page.getByRole("heading", { name: "FAQ", exact: true }).count(), 1);
  });

  await test("every directory entry navigates and returns through a stable shared header", async (t) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL);
    await page.getByRole("heading", { name: "Components Showcase" }).waitFor();
    await page.locator('[data-preview-ready="true"]').waitFor();
    await page.getByRole("button", { name: "Plugin", exact: true }).click();
    assert.equal(await page.locator('main a[href="/en/login"]').count(), 1);
    const pluginIcons = new Map(
      await page
        .locator("main a h2")
        .evaluateAll((headings) =>
          headings.map((heading) => [
            heading.textContent.trim(),
            heading.querySelector('svg[aria-hidden="true"]')?.innerHTML,
          ]),
        ),
    );
    assert.ok([...pluginIcons.values()].every(Boolean), "each plugin title has a decorative icon");
    assert.equal(new Set(pluginIcons.values()).size, pluginIcons.size, "plugin icons are distinct");
    await page.getByRole("button", { name: "All", exact: true }).click();
    const destinations = await page
      .locator("main a[href]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.equal(new Set(destinations).size, destinations.length);
    assert.ok(destinations.includes("/table-pagination"));
    assert.equal(destinations.includes("/table-search"), false);
    assert.equal(destinations.filter((href) => href === "/en/menus").length, 1);
    assert.equal(destinations.includes("/en/admin/menus"), false);
    assert.equal(destinations.filter((href) => href === "/en/login").length, 1);
    const header = page.shell.getByRole("navigation", { name: "Showroom navigation" });
    const original = await header.boundingBox();
    const titles = new Set();
    const descriptions = new Set();
    for (const href of destinations) {
      await page.locator(`main a[href="${href}"]`).click();
      await page.waitForURL(baseURL + href);
      await page
        .locator(`link[rel="canonical"][href="https://registry.the-corner.io${href}"]`)
        .waitFor({ state: "attached", timeout: 5000 });
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      assert.match(title, /\S.* \| Forge Registry$/, href);
      assert.ok(description.trim().length > 0, href);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), title);
      assert.equal(
        await page.locator('meta[property="og:description"]').getAttribute("content"),
        description,
      );
      assert.equal(titles.has(title), false, href);
      assert.equal(descriptions.has(description), false, href);
      titles.add(title);
      descriptions.add(description);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        `https://registry.the-corner.io${href}`,
        href,
      );
      if (href === "/en/intranet-sidebar") {
        for (const name of ["Customers", "Projects", "Employees"]) {
          assert.equal(
            await page.getByRole("link", { name, exact: true }).locator("svg").innerHTML(),
            pluginIcons.get(name),
            `${name} uses the same icon in its title and sidenav`,
          );
        }
      }
      assert.deepEqual(await header.boundingBox(), original, href);
      await header.getByRole("link", { name: "All components" }).click();
      await page.getByRole("heading", { name: "Components Showcase" }).waitFor();
    }
    assert.deepEqual(errors, []);
  });

  await test("SEO metadata is server rendered for demos, aliases, locales, and missing pages", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const samplePages = [
      "/en/projects/website/drive",
      "/en/customers/acme/projects",
      "/en/blogs/make-room-for-better-ideas",
      "/en/admin/blogs/categories",
      "/en/admin/reservations/settings",
    ];
    for (const path of [
      "/",
      "/table-search",
      "/cookie-banner",
      "/newsletter",
      "/en/legal/privacy",
      "/en/legal/mentions",
      "/en/forgot-password",
      "/en/reset-password",
      "/en/access-denied",
      ...samplePages,
      ...["fr", "en", "de", "it"].flatMap((locale) => [
        `/${locale}/contact`,
        `/${locale}/login`,
        `/${locale}/projects/new`,
        `/${locale}/admin/menus`,
      ]),
      "/missing-page",
      "/en/legal/missing",
      "/xx/customers",
    ]) {
      const response = await fetch(baseURL + path);
      const html = await response.text();
      const head = await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return {
          title: doc.title,
          description: doc.querySelector('meta[name="description"]')?.getAttribute("content"),
          ogDescription: doc
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content"),
          twitterDescription: doc
            .querySelector('meta[name="twitter:description"]')
            ?.getAttribute("content"),
          canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
          robots: doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
          titles: doc.querySelectorAll("title").length,
          descriptions: doc.querySelectorAll('meta[name="description"]').length,
        };
      }, html);
      assert.equal(head.titles, 1, path);
      assert.equal(head.descriptions, 1, path);
      assert.match(head.title, /\| Forge Registry$/);
      assert.ok(head.description.includes("React"), path);
      assert.equal(head.ogDescription, head.description, path);
      assert.equal(head.twitterDescription, head.description, path);
      if (response.status === 404 || path.endsWith("/new") || samplePages.includes(path)) {
        assert.equal(head.robots, "noindex, follow", path);
        assert.equal(head.canonical, undefined, path);
      } else {
        assert.equal(response.status, 200, path);
        assert.equal(head.canonical, `https://registry.the-corner.io${path}`, path);
      }
    }
  });

  await test("keyboard entry skips the showroom controls without changing the preview hash", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    for (const path of ["/en/projects", "/en/login", "/en/intranet#team"]) {
      await page.goto(baseURL + path);
      await page.locator('[data-preview-ready="true"]').waitFor();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.shell.evaluate(() => document.activeElement.textContent.trim()),
        "Skip to preview",
      );
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "factory-showroom-preview",
      );
      assert.equal(page.url(), baseURL + path);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() =>
          Boolean(document.activeElement.closest("#factory-showroom-preview")),
        ),
        true,
      );
    }
  });

  await test("header language switching retains URL context and respects unsaved editor guards", async (t) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const destination = "/admin/menus/30000000-0000-4000-8000-000000000001?search=keep#details";
    await page.goto(`${baseURL}/en${destination}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const name = page.getByRole("textbox", { name: "Name *", exact: true });
    await name.fill("Unsaved menu translation");
    const header = page.shell.getByRole("navigation", { name: "Showroom navigation" });
    await header.getByRole("button", { name: "Dark mode", exact: true }).click();
    for (const [locale, language] of [
      ["fr", "Français"],
      ["de", "Deutsch"],
      ["it", "Italiano"],
      ["en", "English"],
    ]) {
      await page.setViewportSize({ width: 320, height: 800 });
      await header.getByRole("button", { name: "Language", exact: true }).press("Enter");
      await page.shell.getByRole("menuitem", { name: language, exact: true }).click();
      if (locale === "fr") {
        const confirmation = page.getByRole("dialog", { name: "Keep your changes?", exact: true });
        await confirmation
          .getByRole("button", { name: "Cancel", exact: true })
          .filter({ hasText: "Cancel" })
          .click();
        await confirmation.waitFor({ state: "hidden" });
        assert.equal(page.url(), `${baseURL}/en${destination}`);
        assert.equal(await name.inputValue(), "Unsaved menu translation");
        await header.getByRole("button", { name: "Language", exact: true }).click();
        await page.getByRole("menuitem", { name: language, exact: true }).click();
        await confirmation.getByRole("button", { name: "Save", exact: true }).click();
      }
      await page.waitForURL(`${baseURL}/${locale}${destination}`);
      assert.equal(await name.inputValue(), "Unsaved menu translation");
      assert.equal(
        (await header.getByRole("button", { name: "Language", exact: true }).textContent()).trim(),
        locale.toUpperCase(),
      );
      assert.equal(
        (await context.cookies()).find((cookie) => cookie.name === "FORGE_LOCALE")?.value,
        locale,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.equal((await header.locator("..").boundingBox()).height, 56);
    }
    for (const path of ["/", "/newsletter", "/table-search"]) {
      await page.goto(baseURL + path);
      assert.equal(await header.getByRole("button", { name: "Language", exact: true }).count(), 0);
    }
    assert.deepEqual(errors, []);
  });

  await test("settings default to closed on phones and open on larger screens", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 639, 640, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseURL}/en/admin/blogs`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const toggle = page.getByRole("button", { name: "Settings", exact: true });
      const panel = page.locator("#factory-showroom-controls");
      const defaultOpen = width >= 640;
      assert.equal(await panel.isVisible(), defaultOpen);
      assert.equal(await toggle.getAttribute("aria-expanded"), String(defaultOpen));
      await toggle.click();
      assert.equal(await panel.isVisible(), !defaultOpen);
      await page.setViewportSize({ width: defaultOpen ? 320 : 1440, height: 900 });
      assert.equal(await panel.isVisible(), !defaultOpen);
      await page.setViewportSize({ width, height: 900 });
      await page.reload();
      await page.locator('[data-preview-ready="true"]').waitFor();
      assert.equal(await panel.isVisible(), defaultOpen);
    }
    assert.deepEqual(errors, []);
  });

  await test("settings toggle preserves controls and releases preview space", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.goto(`${baseURL}/en/admin/blogs`);
        await page.locator('[data-preview-ready="true"]').waitFor();
        const themeButton = page.getByRole("button", {
          name: `${theme === "dark" ? "Dark" : "Light"} mode`,
          exact: true,
        });
        if (await themeButton.count()) await themeButton.click();
        const toggle = page.getByRole("button", { name: "Settings", exact: true });
        if (width < 640) await toggle.click();
        const panel = page.locator("#factory-showroom-controls");
        const heading = page.getByRole("heading", { name: "Preview controls", exact: true });
        assert.equal(await toggle.textContent(), "");
        assert.equal(await page.locator(".showroom-settings").count(), 0);
        const buttonBox = await toggle.boundingBox();
        const headingBox = await heading.boundingBox();
        assert.ok(buttonBox.x > headingBox.x + headingBox.width);
        assert.equal(buttonBox.y + buttonBox.height / 2, headingBox.y + headingBox.height / 2);
        const tooltip = page.getByRole("tooltip", { name: "Settings", exact: true });
        await page.mouse.move(0, 0);
        await toggle.hover();
        await tooltip.waitFor();
        await toggle.press("Escape");
        await tooltip.waitFor({ state: "hidden" });
        await page.mouse.move(0, 0);
        await toggle.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await tooltip.waitFor();
        await toggle.press("Escape");
        await tooltip.waitFor({ state: "hidden" });
        const readOnly = panel.getByLabel("Read-only", { exact: true });
        await readOnly.check();
        const preview = page.locator("#factory-showroom-preview");
        const expanded = await preview.boundingBox();
        const activeBackground = await toggle.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        );
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        await toggle.press("Enter");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await panel.isVisible(), false);
        assert.equal(await heading.isVisible(), false);
        assert.equal(await toggle.isVisible(), true);
        assert.equal(await page.getByRole("navigation", { name: "Preview navigation" }).count(), 0);
        assert.notEqual(
          await toggle.evaluate((el) => getComputedStyle(el).backgroundColor),
          activeBackground,
        );
        const collapsed = await preview.boundingBox();
        if (width >= 1024) assert.ok(collapsed.width > expanded.width);
        else assert.ok(collapsed.y < expanded.y);
        if (width >= 640) assert.deepEqual(await toggle.boundingBox(), buttonBox);
        else assert.equal((await toggle.boundingBox()).y, collapsed.y + 16);
        assert.equal(await toggle.evaluate((el) => document.activeElement === el), true);
        await toggle.press("Tab");
        assert.equal(await panel.evaluate((el) => el.contains(document.activeElement)), false);
        await toggle.press("Space");
        assert.equal(await panel.isVisible(), true);
        assert.equal(await readOnly.isChecked(), true);
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.deepEqual(await preview.boundingBox(), expanded);
        await toggle.click();
        assert.equal(await panel.isVisible(), false);
        await toggle.click();
        assert.equal(await panel.isVisible(), true);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
      }
    }
    await page.goto(baseURL);
    assert.equal(await page.getByRole("button", { name: "Settings", exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  });

  await test("collapsed smartphone settings share the blog editor back row", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(`${baseURL}/en/admin/blogs`);
      await page.locator('[data-preview-ready="true"]').waitFor();
      await page.getByRole("link", { name: "Make room for better ideas", exact: true }).click();
      const toggle = page.getByRole("button", { name: "Settings", exact: true });
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      const back = page.getByRole("link", { name: "← Back to posts", exact: true });
      const backBox = await back.boundingBox();
      const toggleBox = await toggle.boundingBox();
      assert.equal(toggleBox.y, backBox.y);
      assert.ok(backBox.x + backBox.width < toggleBox.x);
      assert.equal((await page.locator("#factory-showroom-preview").boundingBox()).y, 56);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await toggle.click();
      assert.equal(await page.locator("#factory-showroom-controls").isVisible(), true);
      await toggle.click();
      await back.click();
      await page.waitForURL(`${baseURL}/en/admin/blogs`);
    }
    await page.goto(`${baseURL}/en/login`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const toggle = page.getByRole("button", { name: "Settings", exact: true });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    const preview = await page.locator("#factory-showroom-preview").boundingBox();
    const gear = await toggle.boundingBox();
    assert.ok(preview.y >= gear.y + gear.height);
    assert.equal((await page.locator(".showroom-fill").boundingBox()).width, preview.width);
  });

  await test("bounded previews center in the window without overlapping desktop settings", async (t) => {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    for (const path of ["/en/reservations", "/newsletter"]) {
      for (const width of [2048, 1600, 1440, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(baseURL + path);
        const toggle = page.getByRole("button", { name: "Settings", exact: true });
        for (const open of [true, false]) {
          assert.equal(await toggle.getAttribute("aria-expanded"), String(open));
          const preview = await page.locator("#factory-showroom-preview").boundingBox();
          const rail = await page.locator(".showroom-controls").boundingBox();
          const expectedLeft = Math.max(
            0,
            Math.min((width - preview.width) / 2, rail.x - preview.width),
          );
          assert.ok(Math.abs(preview.x - expectedLeft) < 1, `${path}: ${width}, open=${open}`);
          assert.ok(preview.x + preview.width <= rail.x + 1);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
          );
          if (open) await toggle.click();
        }
      }
    }
  });

  await test("expanded settings stay beside desktop previews and stack on mobile", async (t) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    t.after(() => context.close());
    const page = await context.newPage();
    for (const path of ["/en/intranet", "/en/login", "/en/projects/new", "/en/admin/blogs"]) {
      await page.goto(baseURL + path);
      await page.locator('[data-preview-ready="true"]').waitFor();
      const controls = page.getByRole("complementary", { name: "Preview controls" });
      assert.equal(await controls.locator("details, summary").count(), 0);
      const rail = await controls.boundingBox();
      const preview = await page.locator("#factory-showroom-preview").boundingBox();
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
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/en/login", "/en/projects", "/en/blogs", "/en/intranet-sidebar"]) {
        await page.goto(baseURL + path);
        await page.locator('[data-preview-ready="true"]').waitFor();
        await page.getByRole("button", { name: "Settings", exact: true }).click();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          path,
        );
        const rail = await page
          .getByRole("complementary", { name: "Preview controls" })
          .boundingBox();
        const preview = await page.locator("#factory-showroom-preview").boundingBox();
        assert.ok(rail.y + rail.height <= preview.y, path);
        const header = await page.shell
          .getByRole("navigation", { name: "Showroom navigation" })
          .locator("..")
          .boundingBox();
        assert.equal(header.height, 56);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(baseURL);
    assert.equal(await page.locator(".showroom-controls").count(), 0);
    assert.equal((await page.locator("#factory-showroom-preview").boundingBox()).width, 1280);
  });
});

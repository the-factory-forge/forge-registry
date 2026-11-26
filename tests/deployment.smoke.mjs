import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";

await test("production Agents settings exposes both tabs and simulates one-hour tokens without MCP requests", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const errors = [];
  const connections = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/demo\/(?:state|key)|\/api\/mcp|:3222\//.test(request.url()))
      connections.push(request.url());
  });
  await page.goto(`${baseURL}/en/agents`);
  const settings = page
    .getByRole("region", { name: "Agents", exact: true })
    .getByRole("button", { name: "Settings", exact: true });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  assert.equal(await dialog.getByRole("tab").count(), 2);
  await dialog.getByRole("region", { name: "External assistant demo" }).waitFor();
  await dialog.getByText(/cannot connect to a real MCP server/).waitFor();
  assert.equal(
    await dialog.getByLabel("MCP URL", { exact: true }).inputValue(),
    "https://intranet.example/api/mcp",
  );
  await page.clock.install();
  const before = await page.evaluate(() => Date.now());
  await dialog.getByRole("button", { name: "Create temporary key", exact: true }).click();
  const key = dialog.getByLabel("Temporary key", { exact: true });
  const first = await key.inputValue();
  assert.match(first, /^demo_/);
  const expiry = await dialog.locator("time").getAttribute("datetime");
  assert.ok(Math.abs(Date.parse(expiry) - before - 3_600_000) < 10_000);
  assert.equal(await key.getAttribute("type"), "password");
  await dialog.getByRole("button", { name: "Show temporary key", exact: true }).click();
  assert.equal(await key.getAttribute("type"), "text");
  await dialog.getByRole("button", { name: "Copy temporary key", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), first);
  await dialog.getByRole("button", { name: "Replace key", exact: true }).click();
  const replacement = await key.inputValue();
  assert.notEqual(replacement, first);
  assert.equal(await key.getAttribute("type"), "password");
  assert.equal(
    await page.evaluate(
      (token) =>
        JSON.stringify(sessionStorage).includes(token) ||
        JSON.stringify(localStorage).includes(token),
      replacement,
    ),
    false,
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await settings.click();
  assert.equal(await key.count(), 0);
  assert.equal(await dialog.getByRole("button", { name: "Replace key", exact: true }).count(), 1);
  await dialog.getByRole("button", { name: "Revoke key", exact: true }).click();
  assert.equal(await dialog.locator("time").count(), 0);
  await dialog.getByRole("button", { name: "Create temporary key", exact: true }).click();
  await page.clock.fastForward(3_600_001);
  await dialog.getByText("Key expired. Create another to continue.", { exact: true }).waitFor();
  assert.equal(await key.count(), 0);
  await dialog.getByRole("button", { name: "Create temporary key", exact: true }).click();
  await page.reload();
  await settings.click();
  assert.equal(await key.count(), 0);
  assert.equal(await dialog.getByRole("button", { name: "Revoke key", exact: true }).count(), 1);
  await dialog.getByRole("button", { name: "Revoke key", exact: true }).click();
  await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
  await dialog.getByText(/One shared AI connection serves all employees/).waitFor();
  await dialog.getByLabel("API key", { exact: true }).fill("demo");
  await dialog.getByRole("button", { name: "Load models", exact: true }).click();
  await dialog.getByLabel("Model", { exact: true }).selectOption("demo-openai");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByText("Demo settings saved. The next sample response will show the selected model.", {
      exact: true,
    })
    .waitFor();
  await dialog.getByRole("tab", { name: "External assistant", exact: true }).click();
  for (const [width, theme] of [
    [1440, "light"],
    [390, "dark"],
  ]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }, theme);
    await dialog.getByRole("button", { name: "Create temporary key", exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const directory = process.env.AGENTS_SCREENSHOT_DIR;
    if (directory) {
      await mkdir(directory, { recursive: true });
      await page.screenshot({
        path: `${directory}/public-settings-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await dialog.getByRole("button", { name: "Revoke key", exact: true }).click();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await settings.click();
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(connections, [], "the public preview must not call localhost or an MCP server");
  assert.deepEqual(errors, []);
});

await test("the sitemap lists canonical public demos and robots advertises it", async () => {
  const origin = "https://registry.the-corner.swiss";
  const response = await fetch(`${baseURL}/sitemap.xml`, { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  const xml = await response.text();
  assert.match(xml, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate locations");
  assert.ok(urls.includes(`${origin}/`));
  for (const locale of ["fr", "en"]) {
    assert.ok(urls.includes(`${origin}/${locale}/projects`));
    assert.ok(urls.includes(`${origin}/${locale}/contact`));
  }
  assert.ok(urls.includes(`${origin}/connectors/projects-drive`));
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.origin, origin);
    assert.equal(url.search + url.hash, "", value);
    assert.doesNotMatch(url.pathname, /\/(?:admin|api|auth|login)(?:\/|$)/, value);
    assert.doesNotMatch(url.pathname, /\/(?:new|acme|website)(?:\/|$)/, value);
    const page = await fetch(baseURL + url.pathname, { redirect: "manual" });
    assert.equal(page.status, 200, value);
    const html = await page.text();
    assert.ok(html.includes(`rel="canonical" href="${value}"`), value);
    assert.doesNotMatch(html, /name="robots" content="noindex/, value);
  }
  const robots = await fetch(`${baseURL}/robots.txt`, { redirect: "manual" });
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type"), /text\/plain/);
  assert.ok((await robots.text()).includes(`Sitemap: ${origin}/sitemap.xml`));
});

await test("the deployed showroom serves public demos, assets and registry JSON without auth", async () => {
  for (const [path, heading] of [
    ["/", "Showcase"],
    ["/en/login", "Example workspace"],
    ["/en/employees", "Employees"],
    ["/en/projects/new?customerId=acme", "New project"],
    ["/en/customers/acme/projects", "Acme Studio"],
    ["/en/blogs/make-room-for-better-ideas", "Make room for better ideas"],
  ]) {
    const response = await fetch(baseURL + path, { redirect: "manual" });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(heading), path);

    if (path === "/") {
      const assets = [...html.matchAll(/(?:href|src)="(\/assets\/[^"?#]+)[^"]*"/g)];
      assert.ok(
        assets.some(([, asset]) => asset.endsWith(".css")),
        "SSR stylesheet",
      );
      assert.ok(
        assets.some(([, asset]) => asset.endsWith(".js")),
        "client bundle",
      );
      for (const asset of new Set([...assets.map(([, asset]) => asset), "/favicon.ico"])) {
        const result = await fetch(baseURL + asset);
        assert.equal(result.status, 200, asset);
        assert.doesNotMatch(result.headers.get("content-type") ?? "", /text\/html/, asset);
        assert.ok((await result.arrayBuffer()).byteLength > 0, asset);
      }
    }
  }

  const catalog = await fetch(`${baseURL}/r/registry.json`);
  assert.equal(catalog.status, 200);
  assert.match(catalog.headers.get("content-type"), /application\/json/);
  const { items } = await catalog.json();
  assert.ok(items.length > 0);
  for (const { name } of items) {
    const response = await fetch(`${baseURL}/r/${name}.json`);
    assert.equal(response.status, 200, name);
    assert.match(response.headers.get("content-type"), /application\/json/, name);
    assert.equal((await response.json()).name, name);
  }

  const auth = await fetch(`${baseURL}/api/auth/get-session`, { redirect: "manual" });
  assert.equal(auth.status, 404, "no live authentication API");
  assert.equal(auth.headers.get("set-cookie"), null, "no authentication session");
});

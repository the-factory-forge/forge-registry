import assert from "node:assert/strict";
import test from "node:test";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";

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

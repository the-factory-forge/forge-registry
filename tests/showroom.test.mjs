import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { localeRedirect } from "../src/lib/locale-redirect.ts";

test("locale redirects retain queries, saved choices and language negotiation", () => {
  for (const { headers, locale } of [
    { headers: {}, locale: "fr" },
    { headers: { "accept-language": "es, de-CH;q=0.9, en;q=0.8" }, locale: "de" },
    { headers: { cookie: "FORGE_LOCALE=it", "accept-language": "de" }, locale: "it" },
    { headers: { cookie: "NEXT_LOCALE=en" }, locale: "en" },
    { headers: { cookie: "FORGE_LOCALE=invalid", "accept-language": "en-US" }, locale: "en" },
  ]) {
    const response = localeRedirect(
      new Request("https://example.com/projects/new?customerId=acme", { headers }),
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      `https://example.com/${locale}/projects/new?customerId=acme`,
    );
    assert.match(response.headers.get("set-cookie"), new RegExp(`FORGE_LOCALE=${locale};`));
  }
});

test("locale middleware leaves static registry delivery and existing routes alone", () => {
  for (const path of [
    "/",
    "/newsletter",
    "/cookie-banner",
    "/en/projects",
    "/fr/blogs",
    "/r/projects.json",
    "/assets/index.js",
    "/@vite/client",
    "/favicon.ico",
    "/unknown",
  ]) {
    assert.equal(localeRedirect(new Request(`https://example.com${path}`)), undefined);
  }
});

test("registry items never depend on the showroom framework or consuming templates", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  for (const item of items) {
    for (const dependency of [...(item.dependencies ?? []), ...(item.registryDependencies ?? [])]) {
      assert.doesNotMatch(
        dependency,
        /^(?:next(?:@|$)|@tanstack\/react-(?:router|start)|forge-template|cove|(?:file|link|workspace):)/,
        item.name,
      );
    }
    for (const file of item.files) {
      const source = await readFile(file.path, "utf8");
      assert.doesNotMatch(
        source,
        /from ["'](?:next(?:\/|["'])|@tanstack\/react-(?:router|start)|@\/showroom\/|@\/routes\/)/,
        file.path,
      );
    }
  }
});

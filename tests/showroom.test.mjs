import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { localeRedirect } from "../src/lib/locale-redirect.ts";
import { showroomHead, notFoundHead } from "../src/showroom/seo.ts";

test("showroom route metadata keeps canonical and social URLs consistent and honors noindex", () => {
  const meta = (head, key) =>
    head.meta.find((tag) => tag.name === key || tag.property === key)?.content;
  const contact = showroomHead({
    title: "Contact page demo",
    description: "React contact page with sample contact details.",
    path: "/en/contact/?preview=map#details",
  });
  assert.match(meta(contact, "description"), /React contact page.*sample contact details/);
  assert.equal(meta(contact, "og:description"), meta(contact, "description"));
  assert.equal(meta(contact, "twitter:description"), meta(contact, "description"));
  assert.equal(contact.links[0].href, "https://registry.the-corner.io/en/contact");
  for (const locale of ["fr", "en", "de", "it"]) {
    assert.equal(
      showroomHead({
        title: "Authentication demo",
        description: "React authentication components.",
        path: `/${locale}/login`,
        canonicalPath: `/${locale}/auth`,
      }).links[0].href,
      `https://registry.the-corner.io/${locale}/auth`,
    );
  }
  const head = showroomHead({
    title: "Sample record demo",
    description: "React demo with sample data.",
    path: "/en/projects/website/drive",
    noIndex: true,
  });
  assert.equal(meta(head, "robots"), "noindex, follow");
  assert.deepEqual(head.links, []);
  assert.equal(meta(notFoundHead(), "robots"), "noindex, follow");
  assert.match(notFoundHead().meta[0].title, /Page not found/);
});

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
      assert.doesNotMatch(source, /registry\.the-corner\.io|showroomHead/, file.path);
      assert.doesNotMatch(
        source,
        /from ["'](?:next(?:\/|["'])|@tanstack\/react-(?:router|start)|@\/showroom\/|@\/routes\/)/,
        file.path,
      );
    }
  }
});

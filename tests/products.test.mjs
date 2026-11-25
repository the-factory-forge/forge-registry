import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const { editableProductPrice, parseProductPrice, productPriceFormat, productInputSchema } =
  await import("../registry/components/plugins/products/model.ts");

await test("product prices round-trip exactly for site currencies with different minor units", () => {
  for (const [currency, entry, minor] of [
    ["CHF", "12,30", 1230],
    ["JPY", "123", 123],
    ["KWD", "0.001", 1],
  ]) {
    const format = productPriceFormat(currency, "en");
    assert.equal(parseProductPrice(entry, format), minor);
    assert.equal(parseProductPrice(editableProductPrice(minor, format), format), minor);
    assert.equal(parseProductPrice("", format), null);
    assert.equal(parseProductPrice("0", format), 0);
    assert.equal(parseProductPrice("-1", format), undefined);
    assert.equal(parseProductPrice("0.00001", format), undefined);
    assert.equal(parseProductPrice("2147483648", format), undefined);
  }
});
await test("name-only product and complete ordered pairs", () => {
  assert.deepEqual(productInputSchema.parse({ name: "  Notebook  ", published: true }), {
    name: "Notebook",
    description: "",
    priceMinor: null,
    characteristics: [],
  });
  for (const invalid of [
    { name: " " },
    ...[
      "",
      "//example.com/a",
      "/\\example.com/a",
      "data:image/png;base64,abc",
      "blob:local",
      "https://a:b@example.com/a",
    ].map((src) => ({ name: "A", media: { thumbnail: { src } } })),
    { name: "A", media: { gallery: Array(25).fill({ src: "/image.jpg" }) } },
    { name: "A", priceMinor: -1 },
    { name: "A", priceMinor: 0.1 },
    { name: "A", characteristics: [{ label: "Size", value: " " }] },
  ]) {
    assert.equal(productInputSchema.safeParse(invalid).success, false);
  }
});

await test("Products status badges expose a toggle only when the host supplies publication access", async (t) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
  });
  t.after(() => server.close());
  const { ProductDirectory } = await server.ssrLoadModule(
    "/registry/components/plugins/products/lists.tsx",
  );
  const product = {
    ...productInputSchema.parse({ name: "Notebook" }),
    id: "notebook",
    version: 1,
    published: false,
  };
  function render(onSetPublished) {
    return renderToStaticMarkup(
      createElement(ProductDirectory, {
        products: [product],
        currency: "CHF",
        onSortChange: () => {},
        onSetPublished,
      }),
    );
  }
  assert.match(
    render(async () => product),
    /<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Private<\/button>/,
  );
  const readOnly = render();
  assert.match(readOnly, />Private<\/span>/);
  assert.doesNotMatch(readOnly, /aria-pressed=|aria-label="Publish"/);
});

await test("An empty gallery takes no space and one photo needs no controls", async (t) => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
  });
  t.after(() => server.close());
  const { ProductDetail } = await server.ssrLoadModule(
    "/registry/components/plugins/products/lists.tsx",
  );
  function detail(media) {
    return renderToStaticMarkup(
      createElement(ProductDetail, {
        currency: "CHF",
        backHref: "/products",
        product: {
          ...productInputSchema.parse({ name: "Cup", media }),
          id: "cup",
        },
      }),
    );
  }
  assert.doesNotMatch(detail({ thumbnail: { src: "/thumbnail.jpg" } }), /<img|Product photos/);
  const one = detail({ gallery: [{ src: "/side.jpg", alt: "Side view" }] });
  assert.match(one, /src="\/side.jpg"/);
  assert.match(one, /alt="Side view"/);
  assert.doesNotMatch(one, /Previous photo|Next photo/);
});

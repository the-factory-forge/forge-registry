import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const tooltipSource = await readFile("registry/components/icon-tooltip.tsx", "utf8");
const { code: tooltipCode } = await transformWithOxc(tooltipSource, "icon-tooltip.tsx", {
  jsx: { runtime: "automatic" },
});
const tooltipUrl = `data:text/javascript;base64,${Buffer.from(
  tooltipCode.replace(/"(@base-ui\/react\/tooltip|react\/jsx-runtime)"/g, (_, name) =>
    JSON.stringify(import.meta.resolve(name)),
  ),
).toString("base64")}`;
const source = await readFile("registry/components/table-pagination.tsx", "utf8");
const { code } = await transformWithOxc(source, "table-pagination.tsx", {
  jsx: { runtime: "automatic" },
});
const resolved = code.replace(
  /"(lucide-react|@\/components\/icon-tooltip|@\/components\/utils\/cn|@\/components\/utils\/table-styles|react\/jsx-runtime)"/g,
  (_, name) =>
    JSON.stringify(
      name === "@/components/icon-tooltip"
        ? tooltipUrl
        : import.meta.resolve(
            name === "@/components/utils/cn"
              ? "cnfast"
              : name === "@/components/utils/table-styles"
                ? "../registry/components/utils/table-styles.ts"
                : name,
          ),
    ),
);
const { TablePagination } = await import(
  `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`
);
const render = (props = {}) =>
  renderToStaticMarkup(createElement(TablePagination, { onPrevious() {}, onNext() {}, ...props }));

void test("numbered footers retain translated names, totals and boundary states", () => {
  const html = render({
    summary: "0 articles",
    page: 1,
    pageCount: 1,
    label: "Pages des articles",
    previousLabel: "Page précédente",
    nextLabel: "Page suivante",
    previousDisabled: true,
    nextDisabled: true,
  });
  assert.match(html, /0 articles/);
  assert.match(html, /1\/1/);
  assert.match(html, /aria-label="Pages des articles"/);
  assert.match(html, /aria-label="Page précédente"/);
  assert.match(html, /aria-label="Page suivante"/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.equal((html.match(/type="button"/g) ?? []).length, 2);
});

void test("cursor footers omit unknown totals and keep recovery independent of forward navigation", () => {
  const html = render({ previousLabel: "First page", nextDisabled: true });
  assert.doesNotMatch(html, /aria-live|<span/);
  assert.match(html, /aria-label="First page"/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 1);
  assert.equal((render({ disabled: true }).match(/disabled=""/g) ?? []).length, 2);
});

void test("cursor paging shows the current page without inventing a total", () => {
  const html = render({ page: 3 });
  assert.match(html, /aria-live="polite"[^>]*>3<\/span>/);
  assert.doesNotMatch(html, /3\//);
});

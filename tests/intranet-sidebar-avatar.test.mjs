import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { tsconfigPaths: true },
  server: { middlewareMode: true, ws: false, watch: null },
  appType: "custom",
});
after(() => server.close());
const { IntranetShell } = await server.ssrLoadModule(
  "/registry/components/layouts/intranet-shell.tsx",
);

for (const [label, name, initials] of [
  ["normal", "Alex Morgan", "AM"],
  ["missing", undefined, "A"],
  ["null", null, "A"],
  ["empty", "", "A"],
  ["whitespace", "   ", "A"],
]) {
  void test(`intranet content stays visible with ${label} display name`, () => {
    const html = renderToStaticMarkup(
      createElement(
        IntranetShell,
        {
          brand: { name: "Workspace", href: "/" },
          user: { name, email: "alex@example.test" },
          groups: [],
          pathname: "/pricing",
          profileHref: "/account",
          onSignOut: async () => {},
        },
        createElement("h1", null, "Pricing"),
      ),
    );
    assert.ok(html.includes(`>${initials}</span>`));
    assert.ok(html.includes("<h1>Pricing</h1>"));
  });
}

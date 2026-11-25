import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { startMcpDemo } from "../scripts/demo-mcp.mjs";
import { mcpClient } from "./agents/mcp-client.mjs";
import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3218";
const browser = await chromium.launch();
await test("Agents settings creates a temporary MCP key for reviewed CRUD and revokes it", async (t) => {
  const demo = await startMcpDemo({
    port: Number(process.env.TEST_MCP_PORT ?? 3222),
    showroomOrigin: new URL(base).origin,
  });
  t.after(() => demo.close());
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base + "/en/agents");
  await page
    .getByRole("region", { name: "Agents", exact: true })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("button", { name: "Create temporary key", exact: true }).click();
  const field = dialog.getByLabel("Temporary key", { exact: true });
  await field.waitFor();
  assert.equal(await field.getAttribute("type"), "password");
  const token = await field.inputValue();
  await dialog.getByRole("button", { name: "Copy temporary key", exact: true }).click();
  assert.ok(
    await page.evaluate(async (token) => (await navigator.clipboard.readText()) === token, token),
  );
  assert.equal(await dialog.locator("details").count(), 0);
  const { call } = await mcpClient(demo.resource, token);
  const initial = await call("blogs_list", { locale: "en", pageSize: 100 });
  const title = "MCP browser check " + crypto.randomUUID();
  async function approved(name, input) {
    const proposal = await call(name, { input, requestId: crypto.randomUUID() });
    assert.equal(proposal.status, "pending");
    assert.equal(
      (await call("agents_execute", { proposalId: proposal.proposalId, review: proposal.preview }))
        .status,
      "succeeded",
    );
  }
  await approved("blogs_create", { title, locale: "en" });
  const created = (await call("blogs_list", { locale: "en", search: title })).items[0];
  const article = await call("blogs_get", { id: created.id });
  const updated = title + " updated";
  await approved("blogs_save", {
    id: created.id,
    version: article.version,
    locale: "en",
    content: {
      ...article.translations.en.draft,
      title: updated,
      markdown: "Verified through the MCP endpoint.",
    },
    shared: article.shared,
  });
  const saved = await call("blogs_get", { id: created.id });
  assert.equal(saved.translations.en.draft.title, updated);
  assert.equal(saved.translations.en.draft.markdown, "Verified through the MCP endpoint.");
  await mkdir(".cache", { recursive: true });
  for (const [width, theme] of [
    [1440, "light"],
    [390, "dark"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
      document.documentElement.style.colorScheme = theme;
    }, theme);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: `.cache/mcp-settings-${width}.png`, fullPage: true });
  }
  await approved("blogs_delete", { id: created.id, version: saved.version });
  assert.deepEqual(
    (await call("blogs_list", { locale: "en", pageSize: 100 })).items.map((a) => a.id),
    initial.items.map((a) => a.id),
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  assert.ok(
    await page.evaluate(
      (token) =>
        !JSON.stringify(sessionStorage).includes(token) &&
        !JSON.stringify(localStorage).includes(token),
      token,
    ),
  );
  await page
    .getByRole("region", { name: "Agents", exact: true })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Revoke key", exact: true }).click();
  await dialog.getByText("Key revoked.", { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel("Temporary key", { exact: true }).count(), 0);
  assert.equal(
    (await fetch(demo.resource, { headers: { Authorization: `Bearer ${token}` } })).status,
    401,
  );
});
await test("retired WebMCP showroom page is unavailable", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  const response = await page.goto(base + "/connectors/agents-webmcp");
  assert.equal(response.status(), 404);
});
await browser.close();

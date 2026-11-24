import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
await mkdir(".cache", { recursive: true });
const browser = await chromium.launch({ args: ["--enable-experimental-web-platform-features"] });
async function invoke(page, name, input = {}) {
  await page.waitForFunction(
    async (name) => (await document.modelContext.getTools()).some((t) => t.name === name),
    name,
  );
  return page.evaluate(
    async ({ name, input }) => {
      const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
      if (!tool) throw new Error(`Missing tool ${name}`);
      return JSON.parse(await document.modelContext.executeTool(tool, input));
    },
    { name, input },
  );
}
async function write(page, name, input, approve = true, review = async () => {}) {
  await page.evaluate(
    ({ name, input }) => {
      window.pendingWrite = (async () => {
        const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
        return JSON.parse(
          await document.modelContext.executeTool(tool, { input, requestId: crypto.randomUUID() }),
        );
      })();
    },
    { name, input },
  );
  const dialog = page.getByRole("dialog", { name: "Request from your assistant" });
  await dialog.waitFor();
  await review(dialog);
  await dialog.getByRole("button", { name: approve ? "Approve" : "Reject", exact: true }).click();
  const result = await page.evaluate(() => window.pendingWrite);
  assert.equal(result.status, approve ? "succeeded" : "rejected", JSON.stringify(result));
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  return result;
}
const cases = [
  {
    plugin: "blogs",
    path: "/en/admin/blogs",
    read: "blogs_list",
    args: { locale: "en" },
    write: "blogs_create",
    input: { title: "WebMCP browser article", locale: "en" },
    visible: "WebMCP browser article",
  },
  {
    plugin: "customers",
    path: "/en/customers",
    read: "customers_list",
    write: "customers_update",
    input: {
      id: "acme",
      values: {
        name: "WebMCP customer",
        email: "alex@example.com",
        companyName: "Acme Studio",
        phoneNumber: "",
        street: "",
        city: "",
        addressComplement: "",
      },
    },
    visible: "WebMCP customer",
  },
  {
    plugin: "employees",
    path: "/en/employees",
    read: "employees_list",
    write: "employees_update",
    input: { id: "user", name: "WebMCP employee", email: "sam@example.test", role: "user" },
    visible: "WebMCP employee",
  },
  {
    plugin: "projects",
    path: "/en/projects",
    read: "projects_list",
    args: { ownerId: "acme", query: {} },
    write: "projects_update",
    input: {
      id: "website",
      values: {
        name: "WebMCP project",
        status: "requested",
        description: "Updated in native WebMCP",
      },
    },
    visible: "WebMCP project",
  },
  {
    plugin: "drive",
    path: "/en/drive/project/website",
    read: "drive_list_entries",
    args: { scope: { type: "project", id: "website" }, parentId: null },
    write: "drive_create_folder",
    input: { scope: { type: "project", id: "website" }, parentId: null, name: "WebMCP folder" },
    visible: "WebMCP folder",
  },
  {
    plugin: "menus",
    path: "/en/admin/menus/items",
    read: "menus_labels",
    write: "menus_save_label",
    input: {
      kind: "dietary",
      position: 0,
      translations: { en: "WebMCP label", fr: "WebMCP label" },
    },
  },
  { plugin: "reservations", path: "/en/admin/reservations", read: "reservations_configuration" },
  {
    plugin: "supports",
    path: "/en/intranet/supports",
    read: "supports_list",
    write: "supports_create",
    input: {
      title: "WebMCP ticket",
      description: "Manual protocol check",
      type: "support",
      attachmentIds: [],
    },
    visible: "WebMCP ticket",
  },
  {
    plugin: "agents",
    path: "/en/agents",
    read: "conversations_operations",
    write: "conversations_create",
    input: { operationId: "blogs" },
  },
];
for (const example of cases)
  await test(
    `${example.plugin}: native discovery, read and reviewed business change`,
    { timeout: 45000 },
    async (t) => {
      const context = await browser.newContext();
      t.after(() => context.close());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + example.path);
      await page.waitForFunction(
        async (name) => (await document.modelContext.getTools()).some((t) => t.name === name),
        example.read,
      );
      assert.equal((await invoke(page, "website_context")).plugin, example.plugin);
      const before = await invoke(page, example.read, example.args);
      if (example.write) {
        await write(page, example.write, example.input, false);
        assert.deepEqual(await invoke(page, example.read, example.args), before);
        await write(page, example.write, example.input);
        const after = await invoke(page, example.read, example.args);
        if (example.plugin !== "agents") assert.notDeepEqual(after, before);
        if (example.visible)
          await page.getByText(example.visible, { exact: false }).first().waitFor();
      } else {
        const resource = before.resources[0];
        await write(page, "reservations_save_resource", { ...resource, name: "WebMCP room" });
        assert.ok(JSON.stringify(await invoke(page, example.read)).includes("WebMCP room"));
      }
      if (example.plugin === "drive") {
        await page.screenshot({ path: ".cache/plugins-webmcp-desktop.png", fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({ path: ".cache/plugins-webmcp-mobile.png", fullPage: true });
      }
      assert.deepEqual(errors, []);
    },
  );
await test("Drive staging uploads reviewed bytes and context follows folder selection", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base + "/en/drive/project/website");
  const selected = await invoke(page, "website_context");
  assert.deepEqual(selected.drive.scope, { type: "project", id: "website" });
  const staged = await invoke(page, "webmcp_stage_file", {
    operationId: "drive",
    requestId: "file",
    name: "native-check.txt",
    contentType: "text/plain",
    base64: "aGVsbG8=",
  });
  await write(
    page,
    "drive_upload",
    {
      scope: { type: "project", id: "website" },
      parentId: null,
      attachmentId: staged.id,
    },
    true,
    async (dialog) => {
      const files = dialog.getByRole("list", { name: "Attachments", exact: true });
      assert.equal(await files.getByText("native-check.txt", { exact: true }).count(), 1);
      assert.match(await files.innerText(), /5 byte/);
      assert.match(await files.innerText(), /text\/plain/);
      assert.match(await dialog.innerText(), /project\/website: \//);
    },
  );
  await page.getByText("native-check.txt", { exact: true }).first().waitFor();
  const listing = await invoke(page, "drive_list_entries", {
    scope: { type: "project", id: "website" },
    parentId: null,
  });
  assert.match(JSON.stringify(listing), /native-check.txt/);
});
await test("public routes and unsupported browsers keep the ordinary interface", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  for (const path of ["/en/blogs", "/en/menus", "/en/reservations"]) {
    await page.goto(base + path);
    assert.deepEqual(
      await page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name)),
      [],
    );
  }
  await context.addInitScript(() =>
    Object.defineProperty(document, "modelContext", { value: undefined }),
  );
  await page.goto(base + "/en/customers");
  await page.getByText("Alex Morgan", { exact: true }).first().waitFor();
});
await test("Agents refresh after an external write preserves the unsent message", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base + "/en/agents?operation=blogs");
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("Keep this unsent draft");
  await invoke(page, "conversations_operations");
  await write(page, "conversations_create", { operationId: "blogs" });
  assert.equal(await message.inputValue(), "Keep this unsent draft");
});
await browser.close();

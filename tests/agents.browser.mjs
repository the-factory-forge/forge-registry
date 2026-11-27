import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
await test("Agents: operation selection, individual approvals, saved history and navigation", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/en/agents`);
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).isDisabled(),
    true,
  );
  const blogs = page.getByRole("button", { name: "Blogs", exact: true });
  await blogs.waitFor();
  assert.equal(await blogs.textContent(), "BlogsWork with blogs.");
  assert.equal(
    await page.getByRole("button", { name: "Example workflow", exact: true }).textContent(),
    "Example workflowA host-defined operation can combine selected plugin tools.",
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "Example workflow", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "review");
  await page.goBack();
  await blogs.waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await blogs.click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "blogs");
  assert.equal(new URL(page.url()).searchParams.get("operation"), "blogs");
  assert.equal(await blogs.getAttribute("aria-pressed"), "true");
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await blogs.waitFor();
  assert.equal(
    await page
      .getByRole("region", { name: "Agents", exact: true })
      .getByRole("button", { name: "Settings", exact: true })
      .isEnabled(),
    true,
  );
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Updated article");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Operation", exact: true }).count(), 0);
  assert.equal(await page.getByText("Updated article", { exact: true }).count(), 3);
  assert.equal(await page.getByRole("link", { name: "Open record", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Completed", { exact: true }).waitFor();
  const history = page.getByRole("navigation", { name: "Conversations", exact: true });
  assert.equal(
    await history.locator('button[aria-current="page"] svg.lucide-newspaper').count(),
    1,
  );
  const savedURL = page.url();
  await page.getByRole("link", { name: "Open record", exact: true }).click();
  const record = page.getByRole("region", { name: "Sample record", exact: true });
  await record.getByText("Updated article", { exact: true }).waitFor();
  await page.reload();
  await record.getByText("Updated article", { exact: true }).waitFor();
  await record.getByRole("button", { name: "Back to chat", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Unsent draft");
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  await history.getByRole("button", { name: "Updated article", exact: true }).waitFor();
  await page.goBack();
  await page.goBack();
  await page.getByText("Completed", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    "Unsent draft",
  );
  assert.equal(page.url(), savedURL);
  await page.reload();
  await page.getByText("Completed", { exact: true }).waitFor();
  await page.goForward();
  await page.goForward();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "employees");
  await page.goto(`${baseURL}/en/agents?operation=blogs&conversation=malformed`);
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.deepEqual(errors, []);
});
await test("Agents: rejection, failure retry and Stop preserve durable messages", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=projects`);
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("A project");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByText("Rejected", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Open record", exact: true }).count(), 0);
  await page.getByLabel("Simulate failure", { exact: true }).check();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Saved after failure");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText("The request failed. Your message is saved; retry when ready.", { exact: true })
    .waitFor();
  await page.getByLabel("Simulate failure", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .getByText("The previous decision is saved. What would you like to do next?", { exact: true })
    .waitFor();
  assert.equal(await page.getByText("Saved after failure", { exact: true }).count(), 1);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Stop this response");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Approve", exact: true }).count(), 0);
  await page.reload();
  await page.getByText("Stop this response", { exact: true }).waitFor();
});
await test("Agents: file cropping, approved previews, mobile themes and deletion", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=blogs`);
  await page.getByRole("button", { name: "Blogs", exact: true, pressed: true }).waitFor();
  const firstMessage =
    "Article with its reviewed cover image and a title that wraps comfortably on a narrow screen";
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(firstMessage);
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 150;
    const context = canvas.getContext("2d");
    context.fillStyle = "#668877";
    context.fillRect(0, 0, 200, 150);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
  await page.getByRole("dialog", { name: "Crop image", exact: true }).waitFor();
  await page.getByRole("button", { name: "Use image", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("list", { name: "Attachments", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    firstMessage,
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).waitFor();
  const region = page.getByRole("region", { name: "Update sample record", exact: true });
  await region.getByRole("img").waitFor();
  const directory = process.env.AGENTS_SCREENSHOT_DIR;
  if (directory) await mkdir(directory, { recursive: true });
  for (const width of [2560, 1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.classList.toggle("light", theme === "light");
        document.documentElement.style.colorScheme = theme;
      }, theme);
      await region.scrollIntoViewIfNeeded();
      const log = await page.getByRole("log", { name: "Message", exact: true }).boundingBox();
      assert.ok(log.width <= 1024, "the reading column stays bounded on wide displays");
      const composer = await page
        .locator("form")
        .filter({ has: page.getByRole("textbox", { name: "Message", exact: true }) })
        .boundingBox();
      assert.ok(
        composer.y >= log.y + log.height - 1,
        "the composer must not cover the conversation or approvals",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
      );
      if (directory)
        await page.screenshot({ path: `${directory}/${width}-${theme}.png`, fullPage: true });
    }
  }
  await region.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Completed", { exact: true }).waitFor();
  await page.reload();
  await page
    .getByRole("region", { name: "Update sample record", exact: true })
    .getByRole("img")
    .waitFor();
  await page.getByRole("button", { name: "Conversations", exact: true }).click();
  await page.getByRole("button", { name: /^Delete conversation:/ }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this conversation?", exact: true });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
});
await test("Agents: deletion errors stay inside the confirmation dialog", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=projects`);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The sample record is/).waitFor();
  await page.getByLabel("Simulate failure", { exact: true }).check();
  await page.getByRole("button", { name: /^Delete conversation:/ }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this conversation?", exact: true });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog
    .getByRole("alert")
    .getByText("File storage is unavailable. Retry when it is available.", { exact: true })
    .waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Delete", exact: true }).isEnabled(), true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate failure", { exact: true }).uncheck();
  await page.getByRole("button", { name: /^Delete conversation:/ }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
});
await test("Agents: domain cards preserve drafts and the first message starts the chat", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=blogs`);
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start a conversation", exact: true }).count(),
    0,
  );
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(
          JSON.parse(sessionStorage.getItem("forge-agents-preview-v1") ?? '{"chats":{}}').chats,
        ).length,
    ),
    0,
  );
  const emptyURL = page.url();
  await page.reload();
  const operation = page.getByRole("button", { name: "Blogs", exact: true });
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await operation.waitFor();
  assert.equal(await operation.getAttribute("aria-pressed"), "true");
  await operation.click();
  assert.equal(page.url(), emptyURL, "selecting the current operation preserves the empty chat");
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("My blog draft");
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "employees");
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  await page.goBack();
  await operation.waitFor();
  assert.equal(page.url(), emptyURL);
  assert.equal(await message.inputValue(), "My blog draft");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("My first task");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Operation", exact: true }).count(), 0);
  assert.equal(await page.getByRole("list", { name: "Operation", exact: true }).count(), 0);
  const newConversation = page.getByRole("button", { name: "New conversation", exact: true });
  assert.equal(await newConversation.innerText(), "New conversation");
  await newConversation.click();
  await operation.waitFor();
  assert.equal(await operation.getAttribute("aria-pressed"), "true");
  assert.equal(await newConversation.isDisabled(), true);
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  assert.equal(await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(), "");
  assert.equal(
    await page.evaluate(
      () => Object.keys(JSON.parse(sessionStorage.getItem("forge-agents-preview-v1")).chats).length,
    ),
    1,
  );
});
await test("Agents: first-message creation failure preserves the draft and retry sends once", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=employees`);
  await page.getByRole("button", { name: "Employees", exact: true, pressed: true }).waitFor();
  await page.getByLabel("Simulate failure", { exact: true }).check();
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("An employee task");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByRole("alert")
    .getByText("The request failed. Your message is saved; retry when ready.", { exact: true })
    .waitFor();
  assert.equal(await message.inputValue(), "An employee task");
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  await page.getByLabel("Simulate failure", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Send", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "employees");
  assert.ok(new URL(page.url()).searchParams.get("conversation"));
  const saved = await page.evaluate(() =>
    Object.values(JSON.parse(sessionStorage.getItem("forge-agents-preview-v1")).chats),
  );
  assert.equal(saved.length, 1);
  assert.equal(saved[0].operationId, "employees");
  assert.equal(saved[0].messages.filter((entry) => entry.role === "user").length, 1);
  await page.reload();
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
});
await test("Agents: history always lists all plugins and opens each chat in its operation", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=blogs`);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list blog records");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The sample record is/).waitFor();
  const blogsURL = page.url();
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list employee records");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The sample record is/).waitFor();
  const employeesURL = page.url();
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  const history = page.getByRole("navigation", { name: "Conversations", exact: true });
  await history.getByRole("button", { name: "list blog records", exact: true }).waitFor();
  assert.deepEqual(
    await history
      .getByRole("list")
      .locator('button:not([aria-label^="Delete conversation:"])')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
    ["list employee records", "list blog records"],
  );
  assert.equal(await history.locator("svg.lucide-users").count(), 1);
  assert.equal(await history.locator("svg.lucide-newspaper").count(), 1);
  await page.reload();
  await history.getByRole("button", { name: "list blog records", exact: true }).waitFor();
  await history.getByRole("button", { name: "list blog records", exact: true }).click();
  await history
    .locator('button[aria-current="page"]')
    .filter({ hasText: "list blog records" })
    .waitFor();
  assert.equal(page.url(), blogsURL);
  assert.equal(
    await history.getByRole("button", { name: "list employee records", exact: true }).count(),
    1,
  );
  await page.goBack();
  await history.getByRole("button", { name: "list employee records", exact: true }).waitFor();
  await history.getByRole("button", { name: "list employee records", exact: true }).click();
  await history
    .locator('button[aria-current="page"]')
    .filter({ hasText: "list employee records" })
    .waitFor();
  assert.equal(page.url(), employeesURL);
  assert.equal(new URL(page.url()).searchParams.get("operation"), "employees");
});
await test("Agents: Enter sends once, Shift+Enter and composition preserve the draft, mobile history toggles", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=employees`);
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("");
  await message.press("Enter");
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  await message.fill("list");
  await message.press("Shift+Enter");
  assert.equal(await message.inputValue(), "list\n");
  await message.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await message.dispatchEvent("keydown", { key: "Enter", keyCode: 229 });
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  await message.press("Enter");
  await page.getByText(/The sample record is/).waitFor();
  await page.getByRole("button", { name: "Stop", exact: true }).waitFor({ state: "hidden" });
  const chats = await page.evaluate(() =>
    Object.values(JSON.parse(sessionStorage.getItem("forge-agents-preview-v1")).chats),
  );
  assert.equal(chats.length, 1);
  assert.equal(chats[0].messages.filter((entry) => entry.role === "user").length, 1);
  const user = await page.locator('article[data-role="user"] > div').boundingBox();
  const agent = await page.locator('article[data-role="assistant"] > div').last().boundingBox();
  assert.ok(user.x + user.width / 2 > agent.x + agent.width / 2);
  assert.equal(await page.getByRole("button", { name: "All operations", exact: true }).count(), 0);
  const history = page.getByRole("navigation", { name: "Conversations", exact: true });
  const directory = process.env.AGENTS_SCREENSHOT_DIR;
  if (directory) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page
          .getByRole("region", { name: "Agents", exact: true })
          .getByRole("button", { name: "Settings", exact: true })
          .innerText(),
        "Settings",
      );
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => {
          document.documentElement.classList.toggle("dark", theme === "dark");
          document.documentElement.classList.toggle("light", theme === "light");
          document.documentElement.style.colorScheme = theme;
        }, theme);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page
          .getByRole("region", { name: "Agents", exact: true })
          .screenshot({ path: `${directory}/chat-${width}-${theme}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const toggle = page.getByRole("button", { name: "Conversations", exact: true });
  assert.equal(await history.isVisible(), false);
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await history.getByRole("button", { name: "list", exact: true }).click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await history.isVisible(), false);
});
await test("Agents: administrator model settings save, reload and drive the demo chat", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  // Keep this settings test independent of the separately started MCP demo.
  await context.route("**/demo/state", (route) =>
    route.fulfill({
      headers: { "access-control-allow-origin": new URL(baseURL).origin },
      json: { resource: new URL("/mcp", route.request().url()).href, expiresAt: null },
    }),
  );
  const page = await context.newPage();
  const providerRequests = [];
  page.on("request", (request) => {
    if (/api\.(openai|anthropic|deepseek)\.com/.test(request.url()))
      providerRequests.push(request.url());
  });
  await page.goto(`${baseURL}/en/agents`);
  const settings = page
    .getByRole("region", { name: "Agents", exact: true })
    .getByRole("button", { name: "Settings", exact: true });
  await settings.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
  const key = dialog.getByLabel("API key", { exact: true });
  await key.fill("demo");
  assert.equal(await key.getAttribute("type"), "password");
  await dialog.getByRole("button", { name: "Show API key", exact: true }).click();
  assert.equal(await key.getAttribute("type"), "text");
  await dialog.getByRole("button", { name: "Load models", exact: true }).click();
  await dialog.getByLabel("Model", { exact: true }).selectOption("demo-openai");
  await key.focus();
  await page.keyboard.press("Control+Enter");
  await page
    .getByText("Demo settings saved. The next sample response will show the selected model.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await key.inputValue(), "");
  assert.equal(await key.getAttribute("type"), "password");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.reload();
  await settings.click();
  await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
  assert.equal(await dialog.getByLabel("Model", { exact: true }).inputValue(), "demo-openai");
  await dialog.getByLabel("Provider", { exact: true }).selectOption("anthropic");
  await key.fill("not-a-real-key");
  await dialog.getByRole("button", { name: "Load models", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await key.inputValue(), "not-a-real-key");
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("forge-agents-preview-v1").includes("not-a-real-key"),
    ),
    false,
  );
  assert.equal(
    await dialog.getByRole("alert").textContent(),
    "Demo request failed. Use the sample key “demo” and turn off “Simulate failure”, then retry. Saved settings are unchanged.",
  );
  await page.setViewportSize({ width: 390, height: 650 });
  const closeAfterError = dialog.getByRole("button", { name: "Close", exact: true });
  await closeAfterError.hover();
  await page.getByRole("tooltip", { name: "Close", exact: true }).waitFor();
  await closeAfterError.click();
  await dialog.waitFor({ state: "hidden" });
  await settings.click();
  await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
  assert.equal(await dialog.getByLabel("Model", { exact: true }).inputValue(), "demo-openai");
  await dialog.getByLabel("Provider", { exact: true }).selectOption("anthropic");
  await key.fill("demo");
  await dialog.getByRole("button", { name: "Load models", exact: true }).click();
  await dialog.getByLabel("Model", { exact: true }).selectOption("demo-anthropic");
  const directory = process.env.AGENTS_SCREENSHOT_DIR;
  if (directory) await mkdir(directory, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.classList.toggle("light", theme === "light");
        document.documentElement.style.colorScheme = theme;
      }, theme);
      const beforeFeedback = await dialog.getByLabel("Provider", { exact: true }).boundingBox();
      await key.fill("invalid-example-key");
      await dialog.getByRole("button", { name: "Load models", exact: true }).click();
      await dialog.getByRole("alert").waitFor();
      const afterFeedback = await dialog.getByLabel("Provider", { exact: true }).boundingBox();
      assert.equal(
        afterFeedback.y,
        beforeFeedback.y,
        "error feedback must not move the provider field",
      );
      await key.fill("demo");
      await dialog.getByRole("button", { name: "Load models", exact: true }).click();
      await dialog.getByLabel("Model", { exact: true }).selectOption("demo-anthropic");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      if (directory)
        await page.screenshot({
          path: `${directory}/settings-${width}-${theme}.png`,
          fullPage: true,
        });
    }
  }
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByText("Demo settings saved. The next sample response will show the selected model.", {
      exact: true,
    })
    .waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Blogs", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/Demo model: demo-anthropic\. The sample record/).waitFor();
  await settings.click();
  await dialog.getByRole("tab", { name: "Model settings", exact: true }).click();
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm disconnect", exact: true }).click();
  await page
    .getByText("Model disconnected. Saved conversations are unchanged.", { exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Read-only tools", { exact: true }).check();
  assert.equal(await settings.count(), 1);
  await settings.click();
  assert.equal(
    await dialog
      .getByRole("tab", { name: "External assistant", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await dialog.getByRole("tab", { name: "Model settings", exact: true }).isDisabled(),
    true,
  );
  await dialog
    .getByText(
      "Only administrators can configure the shared AI model. Ask an administrator to change it.",
      { exact: true },
    )
    .waitFor();
  const unavailableModel = dialog.getByRole("tab", { name: "Model settings", exact: true });
  const bounds = await unavailableModel.boundingBox();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page
    .getByRole("region", { name: "Notifications", exact: true })
    .getByText(
      "Only administrators can configure the shared AI model. Ask an administrator to change it.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await unavailableModel.getAttribute("aria-selected"), "false");
  assert.equal(await dialog.getByLabel("API key", { exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(providerRequests, []);
});
await test("Agents: wheel scrolling at either edge stays in the conversation", async (t) => {
  const context = await browser.newContext({ viewport: { width: 2100, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents`);
  await page.getByRole("button", { name: "Blogs", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("list\n" + "Sample line\n".repeat(80));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/No records were changed\./).waitFor();
  const region = page.getByRole("region", { name: "Agents", exact: true });
  const transcript = region.getByRole("log");
  const area = await region.boundingBox();
  for (const edge of ["left", "right"]) {
    await transcript.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const before = await transcript.evaluate((el) => el.scrollTop);
    assert.ok(before > 0, "the long conversation must overflow");
    const box = await transcript.boundingBox();
    const pageTop = await page.evaluate(() => window.scrollY);
    await page.mouse.move(
      edge === "left" ? box.x + 20 : area.x + area.width - 64,
      box.y + box.height / 2,
    );
    await page.mouse.wheel(0, -400);
    await page.waitForFunction(
      (before) => (document.querySelector('[role="log"]')?.scrollTop ?? before) < before,
      before,
    );
    assert.equal(await page.evaluate(() => window.scrollY), pageTop);
  }
});
await browser.close();

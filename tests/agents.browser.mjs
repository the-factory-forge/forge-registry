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
  const operationCard = page.getByRole("button", { name: "Blogs", exact: true });
  await operationCard.waitFor();
  assert.equal(await operationCard.textContent(), "BlogsWork with blogs.");
  assert.equal(
    await page.getByRole("button", { name: "Example workflow", exact: true }).textContent(),
    "Example workflowA host-defined operation can combine selected plugin tools.",
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "Example workflow", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "review");
  await page.goBack();
  await operationCard.waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await operationCard.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "blogs");
  assert.equal(new URL(page.url()).searchParams.get("operation"), "blogs");
  assert.equal(await operationCard.getAttribute("aria-pressed"), "true");
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await operationCard.waitFor();
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
  assert.equal(await operationCard.count(), 0);
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
  await page.getByRole("button", { name: "All operations", exact: true }).click();
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  await page.getByText("No conversations yet.", { exact: true }).waitFor();
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
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.classList.toggle("light", theme === "light");
        document.documentElement.style.colorScheme = theme;
      }, theme);
      await region.scrollIntoViewIfNeeded();
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
  await page.getByRole("button", { name: "Delete conversation", exact: true }).click();
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
  await page.getByRole("button", { name: "Delete conversation", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this conversation?", exact: true });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog
    .getByRole("alert")
    .getByText("File storage is unavailable. Retry when it is available.", { exact: true })
    .waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Delete", exact: true }).isEnabled(), true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate failure", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Delete conversation", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
});
await test("Agents: operation cards remain visible in drafts and the first message starts the chat", async (t) => {
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
  const blogs = page.getByRole("button", { name: "Blogs", exact: true });
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(await blogs.count(), 1, "new empty chats must show the operation cards");
  assert.equal(await blogs.getAttribute("aria-pressed"), "true");
  await blogs.click();
  assert.equal(page.url(), emptyURL, "selecting the current operation preserves the empty chat");
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("operation"), "employees");
  assert.equal(new URL(page.url()).searchParams.has("conversation"), false);
  await page.getByRole("button", { name: "All operations", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.has("operation"), false);
  await page.goBack();
  await page.goBack();
  await blogs.waitFor();
  assert.equal(page.url(), emptyURL);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("My first task");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
  assert.equal(await blogs.count(), 0);
  assert.equal(await page.getByRole("combobox", { name: "Operation", exact: true }).count(), 0);
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await blogs.waitFor();
  assert.equal(await blogs.getAttribute("aria-pressed"), "true");
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
await test("Agents: unfiltered history lists all plugins and opens each chat in its operation", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/en/agents?operation=blogs`);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list blog records");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The sample record is/).waitFor();
  const blogsURL = page.url();
  await page.getByRole("button", { name: "All operations", exact: true }).click();
  await page.getByRole("button", { name: "Employees", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("list employee records");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The sample record is/).waitFor();
  const employeesURL = page.url();
  await page.getByRole("button", { name: "All operations", exact: true }).click();
  const history = page.getByRole("navigation", { name: "Conversations", exact: true });
  await history.getByRole("button", { name: "list blog records", exact: true }).waitFor();
  assert.deepEqual(await history.getByRole("list").getByRole("button").allTextContents(), [
    "list employee records",
    "list blog records",
  ]);
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
    0,
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
await test("Agents: administrator model settings save, reload and drive the demo chat", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
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
  const dialog = page.getByRole("dialog", { name: "Model settings", exact: true });
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
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm disconnect", exact: true }).click();
  await page
    .getByText("Model disconnected. Saved conversations are unchanged.", { exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Read-only tools", { exact: true }).check();
  assert.equal(await settings.count(), 0);
  assert.deepEqual(providerRequests, []);
});
await browser.close();

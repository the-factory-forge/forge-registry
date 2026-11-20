import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ args: ["--enable-experimental-web-platform-features"] });

await test("native WebMCP discovers context, reviews a change, cancels and refreshes selection", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/connectors/agents-webmcp`);
  await page.getByText("Native WebMCP is available.", { exact: true }).waitFor();
  await page.waitForFunction(async () =>
    (await document.modelContext.getTools()).some((tool) => tool.name === "sample_rename"),
  );
  await page.getByRole("button", { name: "Read page context", exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "blogs" }).waitFor();
  await page.getByLabel("Proposed name", { exact: true }).fill("Approved browser sample");
  await page.getByRole("button", { name: "Propose sample change", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Request from your assistant" });
  await dialog.getByRole("button", { name: "Approve", exact: true }).waitFor();
  assert.equal(await page.getByTestId("saved-name").textContent(), "Sample record");
  await mkdir(".cache", { recursive: true });
  await page.screenshot({ path: ".cache/webmcp-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  });
  await page.screenshot({ path: ".cache/webmcp-mobile-dark.png", fullPage: true });
  await dialog.getByRole("button", { name: "Approve", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("saved-name").filter({ hasText: "Approved browser sample" }).waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Proposed name", { exact: true }).fill("Rejected browser sample");
  await page.getByRole("button", { name: "Propose sample change", exact: true }).click();
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await page.getByTestId("saved-name").textContent(), "Approved browser sample");
  await page.getByRole("button", { name: "Propose sample change", exact: true }).click();
  await dialog.getByRole("button", { name: "Approve", exact: true }).waitFor();
  await page.locator("#factory-webmcp-record").selectOption("customers", { force: true });
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Read page context", exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "customers" }).waitFor();
  assert.equal(await page.getByTestId("saved-name").textContent(), "Sample record");
  await page.goto(`${baseURL}/`);
  assert.deepEqual(
    await page.evaluate(async () =>
      (await document.modelContext.getTools()).map((tool) => tool.name),
    ),
    [],
  );
  assert.deepEqual(errors, []);
});
await test("WebMCP absence leaves the ordinary preview usable", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(() =>
    Object.defineProperty(document, "modelContext", { value: undefined }),
  );
  const page = await context.newPage();
  await page.goto(`${baseURL}/connectors/agents-webmcp`);
  await page
    .getByText("WebMCP is unavailable in this browser. The normal page remains usable.")
    .waitFor();
  assert.equal(await page.getByRole("button", { name: "Read page context" }).isDisabled(), true);
  await page.getByLabel("Selected record", { exact: true }).selectOption("customers");
  assert.equal(await page.getByTestId("saved-name").textContent(), "Sample record");
});

await browser.close();

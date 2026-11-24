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
  assert.equal(
    await page.getByRole("button", { name: "Read last decision", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Read sample record", exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "Sample record" }).waitFor();
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
  assert.equal(
    await page.getByRole("button", { name: "Propose sample change", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Read last decision", exact: true }).click();
  await page.getByText("webmcp_proposal: response received", { exact: true }).waitFor();
  await page.getByText("Response data", { exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "succeeded" }).waitFor();
  await page.getByLabel("Proposed name", { exact: true }).fill("Rejected browser sample");
  await page.getByRole("button", { name: "Propose sample change", exact: true }).click();
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await page.getByTestId("saved-name").textContent(), "Approved browser sample");
  await page.getByRole("button", { name: "Read last decision", exact: true }).click();
  await page.getByText("webmcp_proposal: response received", { exact: true }).waitFor();
  await page.getByText("Response data", { exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "rejected" }).waitFor();
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
await test("external native calls leave a readable decision and fresh context", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${baseURL}/connectors/agents-webmcp`);
  await page.getByLabel("Selected record", { exact: true }).selectOption("customers");
  await page.waitForFunction(async () =>
    (await document.modelContext.getTools()).some((tool) => tool.name === "sample_rename"),
  );
  await page.evaluate(() => {
    const invoke = async (name, input = {}) => {
      const tool = (await document.modelContext.getTools()).find((tool) => tool.name === name);
      return JSON.parse(await document.modelContext.executeTool(tool, input));
    };
    window.externalReview = invoke("sample_rename", {
      name: "Assistant test",
      requestId: "external-test",
    }).then(async (proposal) => ({
      proposal,
      context: await invoke("website_context"),
      record: await invoke("sample_read"),
    }));
  });
  const dialog = page.getByRole("dialog", { name: "Request from your assistant" });
  await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  const result = await page.evaluate(() => window.externalReview);
  assert.equal(result.proposal.status, "succeeded");
  assert.equal(result.context.savedName, "Assistant test");
  assert.equal(result.record.name, result.context.savedName);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Read last decision", exact: true }).click();
  await page.getByText("webmcp_proposal: response received", { exact: true }).waitFor();
  await page.getByText("Response data", { exact: true }).click();
  await page.getByTestId("webmcp-result").filter({ hasText: "succeeded" }).waitFor();
  assert.equal(
    JSON.parse(await page.getByTestId("webmcp-result").textContent()).proposalId,
    result.proposal.proposalId,
  );
  await page.getByLabel("Selected record", { exact: true }).selectOption("blogs");
  assert.equal(
    await page.getByRole("button", { name: "Read last decision", exact: true }).isDisabled(),
    true,
  );
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
  assert.equal(await page.getByRole("button", { name: "Read sample record" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Read last decision" }).isDisabled(), true);
  await page.getByLabel("Selected record", { exact: true }).selectOption("customers");
  assert.equal(await page.getByTestId("saved-name").textContent(), "Sample record");
});

for (const replacement of ["context", "client"]) {
  for (const approve of [false, true]) {
    for (const fails of [false, true]) {
      await test(`late ${approve ? "approval" : "rejection"} ${fails ? "error" : "success"} preserves the new ${replacement} review`, async (t) => {
        const page = await browser.newPage();
        t.after(() => page.close());
        await page.goto(baseURL + "/");
        await page.evaluate(
          async ({ replacement, fails }) => {
            const { mountReviewFixture } = await import("/tests/fixtures/webmcp-review.tsx");
            window.fixture = mountReviewFixture(replacement, fails);
            window.invokeReview = async () => {
              const tool = (await document.modelContext.getTools()).find(
                (tool) => tool.name === "test_write",
              );
              return JSON.parse(await document.modelContext.executeTool(tool, {}));
            };
          },
          { replacement, fails },
        );
        await page.waitForFunction(async () =>
          (await document.modelContext.getTools()).some((tool) => tool.name === "test_write"),
        );
        await page.evaluate(() => {
          window.firstReview = window.invokeReview().catch(() => null);
        });
        const dialog = page.getByRole("dialog", { name: "Request from your assistant" });
        await dialog
          .getByRole("button", { name: approve ? "Approve" : "Reject", exact: true })
          .click();
        await page.evaluate(() => window.fixture.replace());
        await dialog.waitFor({ state: "hidden", timeout: 3000 });
        await page.waitForFunction(async () => {
          const tool = (await document.modelContext.getTools()).find(
            (tool) => tool.name === "website_context",
          );
          return (
            tool && JSON.parse(await document.modelContext.executeTool(tool, {})).version === 1
          );
        });
        await page.evaluate(() => {
          window.secondReview = window.invokeReview();
        });
        await dialog.getByRole("heading", { name: "Change 2", exact: true }).waitFor();
        await page.evaluate(async () => {
          window.fixture.release();
          await window.firstReview;
          await new Promise(requestAnimationFrame);
        });
        assert.equal(
          await dialog.getByRole("heading", { name: "Change 2", exact: true }).count(),
          1,
        );
        assert.equal(await dialog.getByRole("alert").count(), 0);
        assert.equal(
          await dialog.getByRole("button", { name: "Approve", exact: true }).isEnabled(),
          true,
        );
        await dialog.getByRole("button", { name: "Approve", exact: true }).click();
        assert.equal((await page.evaluate(() => window.secondReview)).status, "succeeded");
        const state = await page.evaluate(() => ({
          outcomes: window.fixture.outcomes,
          refreshes: window.fixture.refreshes,
        }));
        assert.ok(state.outcomes.includes("2:succeeded"));
        if (approve && !fails) assert.ok(state.outcomes.includes("1:succeeded"));
        assert.deepEqual(state.refreshes, [1]);
      });
    }
  }
}

await browser.close();

import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ args: ["--enable-experimental-web-platform-features"] });

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

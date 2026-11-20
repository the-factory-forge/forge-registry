import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";

await test("Drive context supports host state, selection, external refresh and unmount", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000"}/`);
  await page.evaluate(async () =>
    (await import("/tests/drive-context.fixture.tsx")).mountDriveContextFixture(),
  );
  const host = page.getByTestId("drive-context-fixture");
  const file = host.getByRole("row").filter({ hasText: "Annual report.txt" });
  await file.waitFor({ timeout: 5000 });
  await file.getByRole("checkbox").check();
  await host.getByTestId("observed-view").filter({ hasText: "Annual report.txt" }).waitFor();
  await host.getByRole("button", { name: "External folder", exact: true }).click();
  await host.getByRole("row").filter({ hasText: "External folder" }).waitFor();
  await host.getByRole("button", { name: "Unmount Drive", exact: true }).click();
  assert.equal(await host.getByTestId("observed-view").textContent(), "null");
});

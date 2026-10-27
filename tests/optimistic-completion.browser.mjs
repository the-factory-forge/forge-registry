import assert from "node:assert/strict";
import { before, after, test } from "node:test";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";
let server, browser, base;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: { tsconfigPaths: true },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
async function fixture(t, mode = "") {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await page.goto(`${base}tests/fixtures/optimistic-completion.html?mode=${mode}`);
  await page.waitForFunction(() => !!window.completionTest);
  return page;
}
const settle = (page, index, success) =>
  page.evaluate(
    ([index, success]) => window.completionTest.calls[index][success ? "resolve" : "reject"](),
    [index, success],
  );
const flush = (page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
const calls = (page, n) => page.waitForFunction((n) => window.completionTest.calls.length === n, n);

void test("optimistic rollback preserves fresh host data and retry accepts canonical values", async (t) => {
  const page = await fixture(t);
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Name"]').textContent === "Preview",
  );
  await page.evaluate(() => window.completionTest.updateHost());
  await settle(page, 0, false);
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Name", { exact: true }).textContent(), "Original");
  assert.equal(await page.getByLabel("Note", { exact: true }).textContent(), "Fresh host data");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await settle(page, 1, true);
  await page.waitForFunction(() => window.completionTest.accepted.length === 1);
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Name"]').textContent === "Canonical",
  );
});
for (const success of [true, false])
  for (const change of ["replace", "unmount"]) {
    void test(`obsolete command ${success ? "success" : "failure"} after ${change} has no feedback or acceptance`, async (t) => {
      const page = await fixture(t);
      await page.getByRole("button", { name: "Save command" }).click();
      await calls(page, 1);
      await page.evaluate((change) => window.completionTest[change](), change);
      await settle(page, 0, success);
      await flush(page);
      assert.deepEqual(await page.evaluate(() => window.completionTest.accepted), []);
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.getByRole("dialog").count(), 0);
    });
  }
void test("an obsolete optimistic attempt cannot accept or unlock the replacement attempt", async (t) => {
  const page = await fixture(t);
  const rename = page.getByRole("button", { name: "Rename", exact: true });
  await rename.click();
  await page.evaluate(() => window.completionTest.replace());
  await rename.click();
  await calls(page, 2);
  await settle(page, 0, true);
  await flush(page);
  assert.equal(await rename.isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.completionTest.accepted), []);
  await settle(page, 1, true);
  await page.waitForFunction(() => window.completionTest.accepted.length === 1);
});
for (const success of [true, false])
  void test(`employee completion after permission replacement stays silent (${success})`, async (t) => {
    const page = await fixture(t, "employee");
    await page.getByRole("button", { name: "Invite employee", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Invite employee", exact: true });
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("New employee");
    await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("employee@example.test");
    await dialog.getByRole("button", { name: "Send invitation", exact: true }).click();
    await calls(page, 1);
    await page.evaluate(() => window.completionTest.replace());
    await settle(page, 0, success);
    await flush(page);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByRole("alert").count(), 0);
  });
async function approve(page) {
  await page.getByRole("button", { name: /Guest 02/ }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await calls(page, 1);
}
for (const success of [true, false])
  void test(`reservation refresh restarts completion ownership (${success})`, async (t) => {
    const page = await fixture(t, "reservations");
    await approve(page);
    // The explicit refresh can also be invoked by a host while its modal is pending.
    await page
      .locator('button[aria-label="Refresh"]')
      .first()
      .evaluate((button) => button.click());
    await page.getByRole("button", { name: /Guest 03/ }).click();
    const dialog = page.getByRole("dialog", { name: "Guest 03", exact: true });
    await dialog.waitFor();
    const before = await page.evaluate(() => window.completionTest.reads());
    await settle(page, 0, success);
    await flush(page);
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await page.evaluate(() => window.completionTest.reads()), before);
    assert.equal(await page.getByRole("alert").count(), 0);
  });
void test("reservation client replacement clears selection and ignores old completion", async (t) => {
  const page = await fixture(t, "reservations");
  await approve(page);
  await page.evaluate(() => window.completionTest.replace());
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /Guest 03/ }).click();
  await settle(page, 0, true);
  await flush(page);
  assert.equal(await page.getByRole("dialog", { name: "Guest 03", exact: true }).isVisible(), true);
});

void test("an older reservation read cannot overwrite a confirmed write", async (t) => {
  const page = await fixture(t, "read");
  await calls(page, 1);
  await settle(page, 0, true);
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Read value"]').textContent === "Read snapshot",
  );
  await page.getByRole("button", { name: "Refresh read", exact: true }).click();
  await calls(page, 2);
  await page.getByRole("button", { name: "Accept write", exact: true }).click();
  await settle(page, 1, true);
  await flush(page);
  assert.equal(await page.getByLabel("Read value").textContent(), "Accepted write");
});
void test("pending rescheduling locks its draft and client replacement dismisses it", async (t) => {
  const page = await fixture(t, "reservations");
  await page.getByRole("button", { name: /Guest 02/ }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reschedule", exact: true });
  const date = dialog.locator('input[type="date"]');
  await date.fill(await page.evaluate(() => window.completionTest.date));
  await dialog.getByRole("button", { name: /^09:00(?: AM)?$/ }).click();
  await dialog.getByRole("button", { name: "Save new time", exact: true }).click();
  await calls(page, 1);
  await page.waitForFunction(() =>
    document.querySelector('input[type="date"]')?.matches(":disabled"),
  );
  assert.equal(await date.isDisabled(), true);
  await page.evaluate(() => window.completionTest.replace());
  await settle(page, 0, true);
  await flush(page);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

async function settingsEditor(t, kind) {
  const page = await fixture(t, `settings-${kind}`);
  await page
    .getByRole("textbox", { name: "Name", exact: true, includeHidden: true })
    .fill(" Draft ");
  if (kind === "service")
    await page.getByRole("spinbutton", { name: "Duration (minutes)", exact: true }).fill("30");
  return page;
}
for (const kind of ["service", "resource"])
  void test(`settings ${kind} uses one write, retains its retry ID and accepts canonical data`, async (t) => {
    const page = await settingsEditor(t, kind);
    const name = page.getByRole("textbox", { name: "Name", exact: true, includeHidden: true });
    await name.evaluate((input) => {
      input.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      input.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await calls(page, 1);
    await flush(page);
    assert.equal(await page.evaluate(() => window.completionTest.calls.length), 1);
    assert.equal(await name.isDisabled(), true);
    const id = await page.evaluate(() => window.completionTest.calls[0].input.id);
    await settle(page, 0, false);
    await page.getByRole("alert").waitFor();
    assert.equal(await name.inputValue(), " Draft ");
    assert.equal(await name.isEnabled(), true);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await calls(page, 2);
    assert.equal(await page.evaluate(() => window.completionTest.calls[1].input.id), id);
    await settle(page, 1, true);
    await page.waitForFunction(() => window.completionTest.accepted.length === 1);
    assert.equal(await name.inputValue(), "Draft");
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Archive", exact: true });
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await calls(page, 3);
    assert.equal(await page.evaluate(() => window.completionTest.calls[2].input.version), 1);
    await settle(page, 2, false);
    await dialog.getByRole("alert").waitFor();
    assert.equal(await name.inputValue(), "Draft");
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await calls(page, 4);
    assert.equal(await page.evaluate(() => window.completionTest.calls[3].input.version), 1);
    await settle(page, 3, true);
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Archived", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.completionTest.accepted.length), 2);
  });

for (const kind of ["service", "resource"])
  void test(`settings list ${kind} archive rolls back and retries within the same confirmation`, async (t) => {
    const page = await fixture(t, "settings-list");
    const label = kind === "service" ? "Haircut / Coupe" : "Alex";
    const trigger = page.getByRole("button", {
      name: `Archive ${label}`,
      exact: true,
      includeHidden: true,
    });
    const row = page.getByRole("listitem", { includeHidden: true }).filter({ has: trigger });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Archive", exact: true });
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await calls(page, 1);
    await row.getByText("Archived", { exact: true }).waitFor();
    assert.equal(
      await dialog.getByRole("button", { name: "Back", exact: true }).isDisabled(),
      true,
    );
    await settle(page, 0, false);
    await dialog.getByRole("alert").waitFor();
    assert.equal(await row.getByText("Archived", { exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await calls(page, 2);
    await settle(page, 1, true);
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Archived", { exact: true }).waitFor();
    assert.equal(await trigger.isDisabled(), true);
  });

for (const kind of ["service", "resource", "list"])
  for (const [change, success] of [
    ["replace", true],
    ["replace", false],
    ["unmount", true],
  ])
    void test(`obsolete settings ${kind} completion stays silent after ${change} (${success})`, async (t) => {
      const page =
        kind === "list" ? await fixture(t, "settings-list") : await settingsEditor(t, kind);
      if (kind === "list") {
        await page.getByRole("button", { name: "Archive Alex", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Archive", exact: true })
          .getByRole("button", { name: "Archive", exact: true })
          .click();
      } else await page.getByRole("button", { name: "Save", exact: true }).click();
      await calls(page, 1);
      await page.evaluate((change) => window.completionTest[change](), change);
      if (change === "replace") {
        if (kind === "list")
          await page
            .getByRole("button", { name: "Archive Sam", exact: true, includeHidden: true })
            .waitFor();
        else {
          await page
            .getByRole("textbox", { name: "Name", exact: true, includeHidden: true })
            .fill("Replacement draft");
          if (kind === "service")
            await page
              .getByRole("spinbutton", { name: "Duration (minutes)", exact: true })
              .fill("30");
          await page.getByRole("button", { name: "Save", exact: true }).click();
          await calls(page, 2);
        }
      }
      await settle(page, 0, success);
      await flush(page);
      assert.deepEqual(await page.evaluate(() => window.completionTest.accepted), []);
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.getByRole("dialog").filter({ hasText: "Saved." }).count(), 0);
      if (change === "replace" && kind !== "list") {
        const name = page.getByRole("textbox", { name: "Name", exact: true, includeHidden: true });
        assert.equal(await name.inputValue(), "Replacement draft");
        assert.equal(await name.isDisabled(), true);
      }
    });

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function preview(t, path = "/en/projects", options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}${path}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}
async function pick(page, entity, name) {
  await page
    .getByRole("button", {
      name: entity === "owner" ? "Select an owner *" : "Select an assignee",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(name.split(" ")[0]);
  await dialog.getByRole("button", { name: new RegExp(name) }).click();
  await dialog.waitFor({ state: "hidden" });
}

test("project directory search, states, links and optional actions", async (t) => {
  const page = await preview(t);
  const search = page.getByRole("textbox", { name: "Search projects", exact: true });
  await search.fill("STUDIO WEBSITE");
  await page.getByRole("row").filter({ hasText: "Customer portal" }).waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("row").count(), 2);
  await search.fill("missing");
  await page.getByText("No projects found.", { exact: true }).waitFor();
  await search.fill("");
  await page.getByLabel("Directory state").selectOption("loading");
  await page.getByRole("status").filter({ hasText: "Loading projects" }).waitFor();
  await page.getByLabel("Directory state").selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Unable to load projects" }).waitFor();
  await page.getByLabel("Directory state").selectOption("ready");
  await page.getByLabel("Account actions", { exact: true }).uncheck();
  assert.equal(await page.getByRole("button", { name: "Delete Project", exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Create Project", exact: true }).count(), 0);
  const row = page.getByRole("row").filter({ hasText: "Studio website" });
  assert.equal(
    await row.getByRole("link", { name: "Visit Studio website website" }).getAttribute("href"),
    "https://example.com",
  );
  await row.getByRole("link", { name: "Acme Studio", exact: true }).click();
  await page.getByRole("heading", { name: "Acme Studio", exact: true }).waitFor();
});

test("create validates inputs, picker keyboard focus, failures and duplicate submission", async (t) => {
  const page = await preview(t, "/en/projects/new");
  const submit = page.getByRole("button", { name: "Create Project", exact: true });
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Enter a project name" }).waitFor();
  await page.getByLabel("Name *", { exact: true }).fill("   ");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Choose an existing customer" }).waitFor();
  await page.getByLabel("Name *", { exact: true }).fill("Fresh project");
  const owner = page.getByRole("button", { name: "Select an owner *", exact: true });
  await owner.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.getByRole("dialog").getByRole("textbox").fill("no-match");
  await page.getByText("No matches found.", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await owner.evaluate((node) => node === document.activeElement), true);
  await pick(page, "owner", "Sam Rivera");
  await pick(page, "assignee", "Taylor Casey");
  await page.getByLabel("Website URL", { exact: true }).fill("javascript:alert(1)");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Enter an HTTP(S) URL" }).waitFor();
  await page.getByLabel("Website URL", { exact: true }).fill("/portfolio/fresh");
  await page.getByLabel("Description", { exact: true }).fill("a".repeat(5001));
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "5,000" }).waitFor();
  await page.getByLabel("Description", { exact: true }).fill("Draft description");
  await page.getByLabel("Simulate action failures").check();
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
  assert.equal(await page.getByLabel("Name *", { exact: true }).inputValue(), "Fresh project");
  await page.getByLabel("Simulate action failures").uncheck();
  // Submit twice in one event turn, before React can disable the button.
  await page.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.getByRole("heading", { name: "Fresh project", exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to Projects", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Fresh project" }).waitFor();
  assert.equal(await page.getByRole("row").filter({ hasText: "Fresh project" }).count(), 1);
});

test("editing retains drafts, supports reassignment, clearing assignee and project resets", async (t) => {
  const page = await preview(t, "/en/projects/website");
  await page.getByLabel("Name *", { exact: true }).fill("Updated website");
  await page.getByLabel("Status", { exact: true }).selectOption("under-construction");
  await pick(page, "owner", "Sam Rivera");
  await page.getByRole("button", { name: "Select an assignee", exact: true }).click();
  await page.getByRole("button", { name: "Leave unassigned", exact: true }).click();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
  assert.equal(await page.getByLabel("Name *", { exact: true }).inputValue(), "Updated website");
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Project updated successfully" }).waitFor();
  await page.getByRole("heading", { name: "Updated website", exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to Projects", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Updated website" });
  await row.getByText("Sam Rivera", { exact: true }).waitFor();
  await row.getByText("Unassigned", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Customer portal", exact: true }).click();
  assert.equal(await page.getByLabel("Name *", { exact: true }).inputValue(), "Customer portal");
});

test("customer composition scopes projects, locks ownership, and keeps shared navigation state", async (t) => {
  const page = await preview(t, "/en/customers/sam/projects");
  await page.getByLabel("Projects integration", { exact: true }).check();
  await page.getByText("No projects found.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("columnheader", { name: "Owner", exact: true }).count(), 0);
  await page.getByRole("link", { name: "Create Project", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Select an owner *", exact: true }).isDisabled(),
    true,
  );
  await page.getByText("Sam Rivera", { exact: true }).waitFor();
  await page.getByLabel("Name *", { exact: true }).fill("Sam's project");
  await page.getByRole("button", { name: "Create Project", exact: true }).click();
  await page.getByRole("heading", { name: "Sam's project", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Select an owner *", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("link", { name: "Drive", exact: true }).click();
  await page.locator('nav a[aria-current="page"]').filter({ hasText: "Drive" }).waitFor();
  assert.equal(await page.locator("form").count(), 0);
  assert.equal(await page.getByText(/Host Drive content/).count(), 0);
  await page.getByLabel("Host integration example").check();
  await page.getByText(/Host Drive content for Sam's project/).waitFor();
  await page.getByRole("link", { name: "Back to Customer Projects", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Sam's project" }).waitFor();
  await page.getByRole("link", { name: "Project directory", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Studio website" }).waitFor();
  assert.equal(await page.getByRole("row").count(), 4);
  // A mismatched customer context must never silently reassign or lock another owner.
  await page.goto(`${baseURL}/en/projects/website?customerId=sam`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Select an owner *", exact: true }).isEnabled(),
    true,
  );
  await page.getByRole("link", { name: "Back to Projects", exact: true }).waitFor();
});

test("missing owners and directory states block mutation without discarding the draft", async (t) => {
  const page = await preview(t, "/en/projects/website");
  await page.getByLabel("Name *", { exact: true }).fill("Retained draft");
  const state = page.getByLabel("People directories", { exact: true });
  const submit = page.getByRole("button", { name: "Save Changes", exact: true });
  await state.selectOption("loading");
  await page.getByRole("status").filter({ hasText: "Loading customers" }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  assert.equal(
    await page.getByText("Create a customer before creating a project.", { exact: true }).count(),
    0,
  );
  await state.selectOption("error");
  await page.getByRole("alert").filter({ hasText: "Unable to load customers" }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  await state.selectOption("empty");
  await page.getByRole("link", { name: "Create Customer", exact: true }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  await state.selectOption("unavailable");
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Choose an existing customer" }).waitFor();
  assert.equal(await page.getByLabel("Name *", { exact: true }).inputValue(), "Retained draft");
  await state.selectOption("ready");
  await submit.click();
  await page.getByRole("heading", { name: "Retained draft", exact: true }).waitFor();
});

test("delete confirmation handles cancellation, failure, success and customer orphan prevention", async (t) => {
  const page = await preview(t, "/en/customers/acme");
  await page.getByRole("button", { name: "Delete Customer", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  await page
    .getByText("Reassign or delete this customer's projects before deleting the customer.", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Project directory", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Studio website" });
  const trigger = row.getByRole("button", { name: "Delete Project", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Delete Project", exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Cancel" })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await page.getByLabel("Simulate action failures").check();
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Simulate action failures").uncheck();
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await row.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Customer portal", exact: true }).click();
  await page.getByRole("button", { name: "Delete Project", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("No projects found.", { exact: true }).waitFor();
});

test("project pages and picker fit desktop/mobile in both themes", async (t) => {
  for (const theme of ["light", "dark"])
    for (const { name, viewport } of [
      { name: "desktop", viewport: { width: 1440, height: 1000 } },
      { name: "mobile", viewport: { width: 390, height: 844 } },
    ]) {
      const page = await preview(t, "/en/projects/website", { viewport, colorScheme: theme });
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
        theme === "dark" ? "rgb(9, 9, 11)" : "rgb(255, 255, 255)",
      );
      for (const [view, link] of [
        ["detail", null],
        ["list", "Back to Projects"],
        ["new", "Create Project"],
      ]) {
        if (link) await page.getByRole("link", { name: link, exact: true }).click();
        await page
          .getByRole(view === "list" ? "textbox" : "button", {
            name: view === "list" ? "Search projects" : "Select an owner *",
            exact: true,
          })
          .waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `/tmp/forge-projects-${view}-${name}-${theme}.png`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Select an owner *", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      const box = await page.getByRole("dialog").boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= viewport.width);
      await page.screenshot({
        path: `/tmp/forge-projects-picker-${name}-${theme}.png`,
        fullPage: true,
      });
      await page.close();
    }
});

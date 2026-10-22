import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { actionToast } from "./action-toast-helpers.mjs";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const article = "b1000000-0000-4000-8000-000000000001";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t, example = true, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}/en/admin/blogs/${article}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  if (example)
    await page.getByRole("button", { name: "Load history example", exact: true }).click();
  return page;
}
const panel = (page) => page.getByRole("complementary", { name: "History · EN", exact: true });
async function select(page, number) {
  if (!(await panel(page).isVisible()))
    await page.getByRole("button", { name: "History", exact: true }).click();
  await panel(page)
    .getByRole("button", { name: new RegExp(`^v${number}\\b`) })
    .click();
  await page.getByRole("heading", { name: `v${number}`, exact: true }).waitFor();
}
async function save(page) {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
}
async function counts(page, pubs, drafts) {
  await panel(page).locator('ol[aria-busy="false"]').waitFor();
  await panel(page)
    .getByText(`Publications ${pubs} / 5 · Drafts ${drafts} / 8`, { exact: true })
    .waitFor();
}

void test("inspection preserves the working draft; dirty work offers save, discard and cancel", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved title");
  await panel(page)
    .getByRole("button", { name: /^v18\b/ })
    .click();
  const leave = page.getByRole("dialog", { name: "Keep your changes?", exact: true });
  await leave.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Unsaved title",
  );
  await panel(page)
    .getByRole("button", { name: /^v18\b/ })
    .click();
  await leave.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await page.getByRole("heading", { name: "v18", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).isVisible(), false);
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Unsaved title",
  );
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Discard this");
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await leave.getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByRole("tabpanel", { name: "Français", exact: true }).waitFor();
  await page.getByRole("tab", { name: "English", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Unsaved title",
  );
});

void test("all reprise paths stay distinct, selection does not move them and continued saves keep their path", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  const paths = () => panel(page).locator("g[data-reprise-id]");
  assert.equal(await paths().count(), 4);
  const geometry = async () =>
    paths().evaluateAll((groups) =>
      Object.fromEntries(
        groups.map((group) => [group.dataset.repriseId, group.lastElementChild.getAttribute("d")]),
      ),
    );
  const initial = await geometry();
  await select(page, 23);
  assert.deepEqual(await geometry(), initial);
  const active = panel(page).locator('g[data-active="true"]');
  assert.equal(await active.locator("path").last().getAttribute("stroke-width"), "3");
  assert.equal(await active.evaluate((node) => node === node.parentElement.lastElementChild), true);
  await select(page, 22);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("A third independent reprise from the live publication.");
  await save(page);
  await counts(page, 5, 5);
  assert.equal(await paths().count(), 5);
  const continued = await panel(page)
    .locator('g[data-active="true"]')
    .getAttribute("data-reprise-id");
  await select(page, 27);
  await page.getByRole("button", { name: "Edit this draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Continuing the same reprise");
  await save(page);
  await counts(page, 5, 6);
  assert.equal(await paths().count(), 5);
  assert.equal(
    await panel(page).locator('g[data-active="true"]').getAttribute("data-reprise-id"),
    continued,
  );
  for (let index = 0; index < 3; index++) {
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(`Continuing ${index}`);
    await save(page);
  }
  await panel(page)
    .getByRole("button", { name: /^v31\b/ })
    .waitFor();
  await counts(page, 5, 8);
  assert.equal(
    await panel(page)
      .getByRole("button", { name: /^v23\b/ })
      .count(),
    0,
  );
});

void test("unified diff marks changed words, keeps insertions single and renders markup as text", async (t) => {
  const page = await preview(t, false);
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("One clear sentence.");
  await save(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("One precise sentence.");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  assert.equal(await page.locator('mark[data-change="removed"]').textContent(), "clear");
  assert.equal(await page.locator('mark[data-change="added"]').textContent(), "precise");
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("One clear sentence. <script>window.blogHistoryUnsafe=true</script>");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  assert.equal(await page.locator('mark[data-change="removed"]').count(), 0);
  assert.equal(await page.locator('mark[data-change="added"]').count(), 1);
  assert.equal(await page.evaluate(() => window.blogHistoryUnsafe), undefined);
  assert.match(await page.locator('mark[data-change="added"]').textContent(), /<script>/);
});

void test("historical publication lists exact deletions, cancel preserves them and success isolates French", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await select(page, 18);
  await page.getByRole("button", { name: "Publish this version", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review publication", exact: true });
  await dialog.waitFor();
  assert.deepEqual(await dialog.locator("li span:first-child").allTextContents(), [
    "v26",
    "v25",
    "v24",
    "v23",
    "v22",
    "v21",
    "v20",
    "v19",
  ]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await counts(page, 5, 4);
  await page.getByRole("button", { name: "Publish this version", exact: true }).click();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await counts(page, 1, 0);
  await panel(page)
    .getByRole("button", { name: /^v18\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Faire de la place aux idées",
  );
});

void test("missing illustrations require explicit omission, failures remain retryable and public rendering omits them", async (t) => {
  const page = await preview(t, false);
  await page.route("https://assets.the-corner.io/images/**", (route) => route.abort());
  await select(page, 1);
  await page.getByText("Image unavailable", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Text without illustrations");
  await save(page);
  await page.getByLabel("Simulate missing illustrations", { exact: true }).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review publication", exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: "Publish", exact: true }).isDisabled(),
    true,
  );
  await dialog.getByLabel("Publish without the missing illustrations", { exact: true }).check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("link", { name: "Text without illustrations", exact: true }).click();
  assert.equal(await page.locator("article img").count(), 0);
  await page.getByText("Begin with a question", { exact: true }).waitFor();
});

void test("staff inspect history but current author and admin retain management", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await page.getByLabel("Administrator", { exact: true }).uncheck();
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  await select(page, 18);
  assert.equal(await page.getByRole("button", { name: "Resume as draft", exact: true }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Publish this version", exact: true }).count(),
    0,
  );
  assert.equal(
    await panel(page)
      .getByRole("button", { name: /^Delete version/ })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Colleague correction");
  await save(page);
  await counts(page, 5, 5);
  await page.getByLabel("Editor", { exact: true }).selectOption("jordan");
  const live = panel(page).getByRole("button", { name: "Delete version v22", exact: true });
  assert.equal(await live.isDisabled(), true);
  await panel(page).getByRole("button", { name: "Delete version v27", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete version v27", exact: true });
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await counts(page, 5, 4);
});

void test("table badges also confirm a saved historical return", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await select(page, 18);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("A historical correction.");
  await save(page);
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.locator(`a[href="/en/admin/blogs/${article}"]`) });
  const badge = row.getByRole("button", { name: "Publication status: EN", exact: true });
  await badge.click();
  await actionToast(page, "This language is no longer public");
  await badge.click();
  const dialog = page.getByRole("dialog", { name: "Review publication", exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator("li").count(), 8);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await badge.getAttribute("aria-pressed"), "false");
  await badge.click();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  assert.equal(await badge.getAttribute("aria-pressed"), "true");
});

void test("ordinary clients keep editing and comparison names the absence of a live translation", async (t) => {
  const page = await preview(t, false);
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await actionToast(page, "This language is no longer public");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page
    .getByText("Publish this language before comparing it with a live version.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page.getByLabel("History transport", { exact: true }).uncheck();
  assert.equal(await page.getByRole("button", { name: "History", exact: true }).count(), 0);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Custom transport draft");
  await save(page);
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Custom transport draft",
  );
});

void test("a stale removal plan refreshes and requires confirmation again", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await select(page, 18);
  await page.getByRole("button", { name: "Publish this version", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review publication", exact: true });
  await dialog.waitFor();
  // The fixture acts as a second writer while the current user's dialog stays open.
  await page
    .getByRole("button", {
      name: "Simulate concurrent correction",
      exact: true,
      includeHidden: true,
    })
    .dispatchEvent("click");
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "This record changed" }).waitFor();
  assert.equal(await dialog.locator("li").count(), 8);
  await dialog.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await dialog
    .getByText("The confirmation now uses the latest article state. Review it before publishing.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await dialog.locator("li").count(), 9);
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await counts(page, 1, 0);
});

void test("a pruned selection recovers to the actual latest draft without losing unsaved input", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await select(page, 23);
  for (let index = 0; index < 9; index++)
    await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Publish this version", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "This record changed" }).waitFor();
  await page.getByRole("button", { name: "Refresh article", exact: true }).click();
  await page
    .getByText(
      "This version is no longer available. Return to your draft or select another version.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  assert.match(
    await page.getByRole("textbox", { name: "Summary", exact: true }).inputValue(),
    /^Concurrent correction /,
  );
  await counts(page, 5, 8);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Retain this unsaved title");
  await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .locator("form")
    .getByRole("alert")
    .filter({ hasText: "This record changed" })
    .waitFor();
  await page.getByRole("button", { name: "Refresh article", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Retain this unsaved title",
  );
});

void test("history keeps loaded rows during read failure and a new article explains its empty history", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 4);
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await panel(page).getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await panel(page).locator("li[data-history-id]").count(), 9);
  await panel(page).getByRole("button", { name: "Retry", exact: true }).click();
  await panel(page).getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await counts(page, 5, 4);
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("link", { name: "New post", exact: true }).click();
  await page.getByRole("textbox", { name: "Title *", exact: true }).fill("Empty history example");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByText("No saved versions in this language yet.", { exact: true }).waitFor();
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { actionToast } from "./action-toast-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";
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
  if (example) await loadExample(page);
  return page;
}
async function loadExample(page) {
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
  await page.getByRole("button", { name: "Load history example", exact: true }).click();
}
const panel = (page, locale = "EN") =>
  page.getByRole("complementary", { name: `History · ${locale}`, exact: true });
async function actions(page, number, locale = "EN") {
  if (!(await panel(page, locale).isVisible()))
    await page.getByRole("button", { name: "History", exact: true }).click();
  await panel(page, locale)
    .getByRole("button", { name: `Actions: v${number}`, exact: true })
    .click();
  return page.getByRole("menu", { name: `Actions: v${number}`, exact: true });
}
async function select(page, number, locale = "EN") {
  if (!(await panel(page, locale).isVisible()))
    await page.getByRole("button", { name: "History", exact: true }).click();
  await panel(page, locale)
    .getByRole("button", { name: new RegExp(`^v${number}\\b`) })
    .click();
  await page.getByRole("heading", { name: `v${number}`, exact: true }).waitFor();
}
async function save(page) {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
}
async function counts(page, pubs, drafts, locale = "EN") {
  await panel(page, locale).locator('ol[aria-busy="false"]').waitFor();
  await panel(page, locale)
    .getByText(`Publications ${pubs} / 5 · Drafts ${drafts} / 8`, { exact: true })
    .waitFor();
}

void test("history controls and panel stay together below the header while scrolling", async (t) => {
  const page = await preview(t, false);
  const trigger = page.getByRole("button", { name: "History", exact: true });
  const compare = page.getByRole("button", { name: "Compare draft", exact: true });
  const header = page.shell.getByRole("navigation", { name: "Showroom navigation", exact: true });
  const scroll = (top) =>
    page.evaluate(async (top) => {
      window.scrollTo(0, top);
      await new Promise(requestAnimationFrame);
    }, top);
  for (const top of [500, 800]) {
    await scroll(top);
    const headerBounds = await header.boundingBox();
    const controls = await trigger.boundingBox();
    const comparison = await compare.boundingBox();
    const history = await panel(page).boundingBox();
    assert.ok(controls.y >= headerBounds.y + headerBounds.height, "History stays below the header");
    assert.equal(comparison.y, controls.y);
    assert.ok(history.y >= controls.y + controls.height, "History stays below its buttons");
  }
  await loadExample(page);
  await scroll(800);
  const history = await panel(page).locator("..").boundingBox();
  assert.ok(history.y + history.height <= 1000, "Long history fits below its sticky controls");
  await panel(page)
    .getByRole("button", { name: /^Actions: v/ })
    .last()
    .scrollIntoViewIfNeeded();
  assert.ok(
    (await trigger.boundingBox()).y >= 56,
    "Scrolling the timeline keeps its controls visible",
  );
  await panel(page).getByRole("button", { name: "Close history", exact: true }).click();
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  await trigger.click();
  await panel(page).waitFor();
});

void test("history stays readable in small and medium desktop previews without losing edits", async (t) => {
  const page = await preview(t, false);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("Keep this working draft");
  const previewBounds = () => page.locator("#factory-showroom-preview").boundingBox();
  for (const size of ["small", "medium", "big"]) {
    await page.getByRole("button", { name: new RegExp(`switch to ${size}$`) }).click();
    const content = await page.getByRole("heading", { level: 1 }).boundingBox();
    const history = await panel(page).boundingBox();
    const bounds = await previewBounds();
    assert.ok(content.width >= 200, `${size}: the editor title stays readable`);
    assert.ok((await title.boundingBox()).width >= 200, `${size}: title input stays usable`);
    assert.ok(
      (await page.getByRole("textbox", { name: "Markdown", exact: true }).boundingBox()).width >=
        200,
      `${size}: Markdown stays usable`,
    );
    assert.ok(
      (await page.getByRole("region", { name: "Preview", exact: true }).boundingBox()).width >= 200,
      `${size}: the Markdown preview stays readable`,
    );
    assert.ok(history.x >= bounds.x && history.x + history.width <= bounds.x + bounds.width);
    if (size !== "big")
      assert.ok(
        history.y + history.height <= content.y,
        `${size}: History stacks above the editor`,
      );
    assert.equal(await title.inputValue(), "Keep this working draft");
    assert.equal(await page.evaluate(() => innerWidth), 1440);
  }
});

void test("history trigger distinguishes open and closed states in both themes and layouts", async (t) => {
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"]) {
      await t.test(`${width}px ${theme}`, async (t) => {
        const page = await preview(t, true, { width, height: 1000 });
        if (theme === "dark")
          await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
        const trigger = page.getByRole("button", { name: "History", exact: true });
        const appearance = () =>
          trigger.evaluate(async (element) => {
            await Promise.all(element.getAnimations().map((animation) => animation.finished));
            const style = getComputedStyle(element);
            return {
              background: style.backgroundColor,
              color: style.color,
              width: element.offsetWidth,
              height: element.offsetHeight,
            };
          });
        assert.equal(await trigger.getAttribute("aria-expanded"), String(width >= 1024));
        if (width >= 1024) await trigger.click();
        await page.mouse.move(0, 0);
        const closed = await appearance();
        await trigger.focus();
        await page.keyboard.press("Enter");
        await panel(page).waitFor();
        assert.equal(await trigger.getAttribute("aria-expanded"), "true");
        await page.getByRole("textbox", { name: "Title", exact: true }).focus();
        const open = await appearance();
        assert.notEqual(open.background, closed.background);
        assert.notEqual(open.color, closed.color);
        assert.equal(open.width, closed.width);
        assert.equal(open.height, closed.height);
        await trigger.screenshot({ path: `/tmp/forge-history-active-${width}-${theme}.png` });
        await trigger.hover();
        const hovered = await appearance();
        assert.equal(hovered.color, open.color);
        assert.notEqual(hovered.background, closed.background);
        await panel(page).getByRole("button", { name: "Close history", exact: true }).click();
        assert.equal(await trigger.getAttribute("aria-expanded"), "false");
        assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
        await page.mouse.move(0, 0);
        assert.deepEqual(await appearance(), closed);
        await page.keyboard.press("Space");
        await panel(page).waitFor();
        assert.deepEqual(await appearance(), open);
        if (width < 1024) {
          await select(page, 26);
          assert.equal(await trigger.getAttribute("aria-expanded"), "false");
          assert.deepEqual(await appearance(), closed);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
      });
    }
  }
});

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    void test(`history actions compare and confirm deletion at ${width}px in ${theme} mode`, async (t) => {
      const page = await preview(t, true, { width, height: 1000 });
      await page.evaluate((mode) => {
        localStorage.setItem("forge-showroom-theme", mode);
      }, theme);
      await page.reload();
      await page.locator('[data-preview-ready="true"]').waitFor();
      await loadExample(page);
      const initialMenu = await actions(page, 18);
      await initialMenu.getByRole("menuitem", { name: "Compare", exact: true }).press("Escape");
      await initialMenu.waitFor({ state: "hidden" });
      await page.mouse.move(0, 0);
      const trigger = panel(page).getByRole("button", { name: "Actions: v18", exact: true });
      await trigger.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await page.getByRole("tooltip", { name: "Actions: v18", exact: true }).waitFor();
      await page.keyboard.press("ArrowDown");
      const compare = page.getByRole("menuitem", { name: "Compare", exact: true });
      await compare.and(page.locator(":focus")).waitFor();
      assert.equal(await compare.evaluate((node) => node === document.activeElement), true);
      const bounds = await page.getByRole("menu").boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: "v18", exact: true }).waitFor();
      await page.locator('mark[data-change="added"]').waitFor();
      assert.equal(await page.getByRole("button", { name: "Compare", exact: true }).count(), 0);
      if (width < 1024) assert.equal(await panel(page).isVisible(), false);
      await page.getByRole("button", { name: "Read", exact: true }).click();
      assert.equal(await page.locator('mark[data-change="added"]').count(), 0);
      await (
        await actions(page, 18)
      )
        .getByRole("menuitem", { name: "Compare", exact: true })
        .click();
      await page.locator('mark[data-change="added"]').waitFor();
      await (
        await actions(page, 22)
      )
        .getByRole("menuitem", { name: "Compare", exact: true })
        .click();
      await page.getByText("No changes from the live publication.", { exact: true }).waitFor();
      await select(page, 18);
      assert.equal(
        await page.getByRole("button", { name: "Read", exact: true }).getAttribute("aria-pressed"),
        "true",
      );
      await (
        await actions(page, 18)
      )
        .getByRole("menuitem", { name: "Delete version", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Delete version v18", exact: true });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await trigger.and(page.locator(":focus")).waitFor();
      assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
      await counts(page, 5, 4);
      await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
      await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved title");
      const menu = await actions(page, 18);
      assert.equal(
        await menu.getByRole("menuitem", { name: "Delete version", exact: true }).isDisabled(),
        true,
      );
      await menu.getByRole("menuitem", { name: "Compare", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(
        await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
        "Unsaved title",
      );
    });
  }
}

void test("history examples target every open post and give English and French independent content", async (t) => {
  const page = await preview(t, false);
  for (const number of [1, 2, 3, 4]) {
    const id = article.slice(0, -1) + number;
    await page.goto(`${base}/en/admin/blogs/${id}`);
    await page.locator('[data-preview-ready="true"]').waitFor();
    const title = await page.getByRole("textbox", { name: "Title", exact: true }).inputValue();
    await loadExample(page);
    await counts(page, 5, 4);
    assert.equal(
      await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
      title,
    );
    const english = await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue();
    assert.match(english, /Good ideas start/);
    await page.getByRole("tab", { name: "Français", exact: true }).click();
    await counts(page, 5, 4, "FR");
    assert.match(
      await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
      /Les bonnes idées commencent/,
    );
    await select(page, 18, "FR");
    await (
      await actions(page, 18, "FR")
    )
      .getByRole("menuitem", { name: "Compare", exact: true })
      .click();
    assert.match(await page.locator('mark[data-change="removed"]').textContent(), /pratique/);
    assert.match(await page.locator('mark[data-change="added"]').textContent(), /attention/);
    assert.equal(await page.getByRole("button", { name: "Compare draft", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
    await page.getByRole("tab", { name: "English", exact: true }).click();
    await counts(page, 5, 4);
    assert.equal(
      await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
      english,
    );
    await page.getByRole("link", { name: "Manage posts", exact: true }).click();
    assert.equal(
      await page.getByRole("button", { name: "Load history example", exact: true }).isDisabled(),
      true,
    );
    const untouchedTitle =
      number === 1 ? "A quieter kind of productivity" : "Make room for better ideas";
    await page.getByRole("link", { name: `Edit: ${untouchedTitle}`, exact: true }).click();
    await counts(page, 1, 0);
  }
});

void test("concurrent correction targets the open post and preserves its unsaved draft", async (t) => {
  const page = await preview(t, false);
  await page.goto(`${base}/fr/admin/blogs/${article.slice(0, -1)}2`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await loadExample(page);
  const frenchHistory = page.getByRole("complementary", { name: "Historique · FR", exact: true });
  await frenchHistory.getByText("Publications 5 / 5 · Brouillons 4 / 8", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Ma correction à conserver");
  await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .locator("form")
    .getByRole("alert")
    .filter({ hasText: "This record changed" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Ma correction à conserver",
  );
});

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
  await page.getByRole("button", { name: "Compare draft", exact: true }).click();
  assert.equal(await page.locator('mark[data-change="removed"]').textContent(), "clear");
  assert.equal(await page.locator('mark[data-change="added"]').textContent(), "precise");
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("One clear sentence. <script>window.blogHistoryUnsafe=true</script>");
  await page.getByRole("button", { name: "Compare draft", exact: true }).click();
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
  await counts(page, 5, 4, "FR");
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Faire de la place aux idées",
  );
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await loadExample(page);
  await counts(page, 5, 4);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await counts(page, 5, 4, "FR");
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
  const staffMenu = await actions(page, 18);
  assert.equal(
    await staffMenu.getByRole("menuitem", { name: "Delete version", exact: true }).count(),
    0,
  );
  await staffMenu.getByRole("menuitem", { name: "Compare", exact: true }).click();
  await page.locator('mark[data-change="added"]').waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Colleague correction");
  await save(page);
  await counts(page, 5, 5);
  await page.getByLabel("Editor", { exact: true }).selectOption("jordan");
  const live = (await actions(page, 22)).getByRole("menuitem", {
    name: "Delete version",
    exact: true,
  });
  assert.equal(await live.isDisabled(), true);
  await page.keyboard.press("Escape");
  await (
    await actions(page, 27)
  )
    .getByRole("menuitem", { name: "Delete version", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Compare draft", exact: true }).click();
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

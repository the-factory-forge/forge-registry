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
async function preview(
  t,
  example = true,
  viewport = { width: 1440, height: 1000 },
  openHistory = true,
) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${base}/en/admin/blogs/${article}`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  if (openHistory) await page.getByRole("button", { name: "History", exact: true }).click();
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
    .getByRole("button", {
      name: `Actions: ${typeof number === "number" ? `v${number}` : number}`,
      exact: true,
    })
    .click();
  return page.getByRole("menu", {
    name: `Actions: ${typeof number === "number" ? `v${number}` : number}`,
    exact: true,
  });
}
async function select(page, number, locale = "EN") {
  if (!(await panel(page, locale).isVisible()))
    await page.getByRole("button", { name: "History", exact: true }).click();
  await panel(page, locale)
    .getByRole("button", {
      name: typeof number === "number" ? new RegExp(`^v${number}\\b`) : /^Draft\b/,
    })
    .click();
  await page
    .getByRole("heading", { name: typeof number === "number" ? `v${number}` : number, exact: true })
    .waitFor();
}
async function save(page) {
  await page.getByRole("checkbox", { name: "As draft", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await actionToast(page, "Draft saved.");
}
async function counts(page, pubs, drafts, locale = "EN") {
  await panel(page, locale).locator('ol[aria-busy="false"]').waitFor();
  await panel(page, locale)
    .getByText(`Publications ${pubs} / 5 · Drafts ${drafts} / 1`, { exact: true })
    .waitFor();
}

void test("History opens from the URL and both close controls remove its parameter", async (t) => {
  const page = await preview(t, false, undefined, false);
  const trigger = page.getByRole("button", { name: "History", exact: true });
  for (const close of [trigger, page.getByRole("button", { name: "Close history", exact: true })]) {
    await trigger.click();
    await page.waitForURL((url) => url.searchParams.get("history") === "true");
    await page.reload();
    await panel(page).waitFor();
    await close.click();
    await page.waitForURL((url) => !url.search);
    await page.reload();
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  }
});

void test("editor deep links restore the selected version, comparison and language", async (t) => {
  const page = await preview(t, false, undefined, false);
  await page.goto(`${base}/en/admin/blogs/${article}?search=keep#anchor`);
  const params = () => new URL(page.url()).searchParams;
  const workingDraft = page.getByRole("textbox", { name: "Title", exact: true });
  const comparison = page.getByRole("heading", { name: "v2 (live) → v1", exact: true });
  await page.getByRole("button", { name: "History", exact: true }).click();
  await select(page, 1);
  const readURL = page.url();
  const version = params().get("version");
  assert.ok(version);
  assert.equal(params().has("compare"), false);
  await (await actions(page, 1)).getByRole("menuitem", { name: "Compare", exact: true }).click();
  await comparison.waitFor();
  assert.equal(params().get("version"), version);
  assert.equal(params().get("compare"), "true");
  const comparisonURL = page.url();
  const compareToggle = page.getByRole("button", { name: "Compare", exact: true });
  await compareToggle.click();
  await page.getByRole("heading", { name: "v1", exact: true }).waitFor();
  assert.equal(page.url(), readURL);
  await compareToggle.click();
  await comparison.waitFor();
  assert.equal(page.url(), comparisonURL);
  await page.reload();
  await comparison.waitFor();
  await panel(page).waitFor();

  await page.getByRole("button", { name: "Close history", exact: true }).click();
  await panel(page).waitFor({ state: "hidden" });
  assert.equal(params().has("history"), false);
  await page.reload();
  await comparison.waitFor();
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await workingDraft.waitFor();
  assert.equal(params().get("lang"), "fr");
  assert.equal(params().has("version"), false);
  assert.equal(params().has("compare"), false);
  await page.reload();
  assert.equal(await workingDraft.inputValue(), "Faire de la place aux idées");
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await page.waitForURL((url) => !url.searchParams.has("lang"));
  assert.equal(new URL(page.url()).search, "?search=keep");
  assert.equal(new URL(page.url()).hash, "#anchor");

  await page.goto(readURL);
  const versionReader = page.getByRole("heading", { name: "v1", exact: true });
  await versionReader.waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await workingDraft.fill("Unsaved edits before Back");
  await page.shell.evaluate(() => history.back());
  const leave = page.getByRole("dialog", { name: "Keep your changes?", exact: true });
  await leave.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await workingDraft.inputValue(), "Unsaved edits before Back");
  assert.equal(params().has("version"), false);
  await page.shell.evaluate(() => history.back());
  await leave.getByRole("button", { name: "Discard changes", exact: true }).click();
  await versionReader.waitFor();
  assert.equal(page.url(), readURL);
  await page.shell.evaluate(() => history.forward());
  await workingDraft.waitFor();
  assert.equal(params().has("version"), false);
  await page.goto(comparisonURL);
  await comparison.waitFor();
  await page.goto(
    `${base}/en/admin/blogs/${article}?lang=unknown&history=false&version=invalid&compare=false`,
  );
  await workingDraft.waitFor();
  assert.equal(await workingDraft.inputValue(), "Make room for better ideas");
  assert.equal(await panel(page).count(), 0);
});

void test("History remains usable when browser storage is blocked", async (t) => {
  const page = await preview(t, false, undefined, false);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.reload();
  const trigger = page.getByRole("button", { name: "History", exact: true });
  await trigger.click();
  await panel(page).waitFor();
  await trigger.click();
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
});

void test("history panel stays below the header while scrolling", async (t) => {
  const page = await preview(t, false);
  const trigger = page.getByRole("button", { name: "History", exact: true });
  assert.equal(await page.getByRole("button", { name: "Compare draft", exact: true }).count(), 0);
  const header = page.shell.getByRole("navigation", { name: "Showroom navigation", exact: true });
  const scroll = (top) =>
    page.evaluate(async (top) => {
      window.scrollTo(0, top);
      await new Promise(requestAnimationFrame);
    }, top);
  for (const top of [500, 800]) {
    await scroll(top);
    const headerBounds = await header.boundingBox();
    const history = await panel(page).boundingBox();
    assert.ok(history.y >= headerBounds.y + headerBounds.height, "History stays below the header");
  }
  await loadExample(page);
  await scroll(800);
  const history = await panel(page).locator("..").boundingBox();
  assert.ok(history.y + history.height <= 1000, "Long history fits inside the viewport");
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
        const page = await preview(t, true, { width, height: 1000 }, false);
        if (theme === "dark")
          await page.shell.getByRole("button", { name: "Dark mode", exact: true }).click();
        const trigger = page.getByRole("button", { name: "History", exact: true });
        const status = page.getByRole("button", { name: "Publication status", exact: true });
        assert.equal(await trigger.textContent(), "");
        const statusBounds = await status.boundingBox();
        const triggerBounds = await trigger.boundingBox();
        assert.ok(triggerBounds.x > statusBounds.x + statusBounds.width);
        assert.ok(triggerBounds.y <= statusBounds.y);
        assert.ok(triggerBounds.y + triggerBounds.height >= statusBounds.y + statusBounds.height);
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
        assert.equal(await trigger.getAttribute("aria-expanded"), "false");
        await page.mouse.move(0, 0);
        const closed = await appearance();
        await status.focus();
        await page.keyboard.press("Tab");
        await page.getByRole("tooltip", { name: "History", exact: true }).waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("tooltip", { name: "History", exact: true })
          .waitFor({ state: "hidden" });
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
          await select(page, "Draft");
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
      await page.getByRole("heading", { name: "v22 (live) → v18", exact: true }).waitFor();
      await page.locator('mark[data-change="added"]').waitFor();
      const reader = page.getByRole("region", { name: "v22 (live) → v18", exact: true });
      const heading = reader.getByRole("heading", { name: "v22 (live) → v18", exact: true });
      assert.equal(
        await heading.evaluate((element) => element.classList.contains("sr-only")),
        true,
      );
      assert.equal(await reader.getByText("Read-only version.", { exact: false }).count(), 0);
      assert.equal(await reader.getByRole("button", { name: "Read", exact: true }).count(), 0);
      const toggle = page.getByRole("button", { name: "Compare", exact: true });
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      const colors = (kind) =>
        reader
          .locator(`mark[data-change="${kind}"]`)
          .first()
          .locator("../..")
          .evaluate((element) => {
            const style = getComputedStyle(element);
            return [style.color, style.backgroundColor];
          });
      assert.notDeepEqual(await colors("removed"), await colors("added"));
      if (width < 1024) assert.equal(await panel(page).isVisible(), false);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      const resume = page.getByRole("button", { name: "Resume as draft", exact: true });
      const toggleBounds = await toggle.boundingBox();
      const resumeBounds = await resume.boundingBox();
      assert.ok(toggleBounds.x + toggleBounds.width <= resumeBounds.x);
      assert.equal(toggleBounds.y, resumeBounds.y);
      await toggle.press("Space");
      await page.getByRole("heading", { name: "v18", exact: true }).waitFor();
      assert.equal(await toggle.getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator('mark[data-change="added"]').count(), 0);
      await toggle.and(page.locator(":focus")).waitFor();
      await page.keyboard.press("Enter");
      await heading.waitFor();
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      await page.locator('mark[data-change="added"]').waitFor();
      const liveMenu = await actions(page, 22);
      assert.equal(
        await liveMenu.getByRole("menuitem", { name: "Compare", exact: true }).isDisabled(),
        true,
      );
      await liveMenu.press("Escape");
      await liveMenu.waitFor({ state: "hidden" });
      await select(page, 18);
      assert.equal(await page.locator('mark[data-change="added"]').count(), 0);
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
      await counts(page, 5, 1);
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
    await page.getByRole("button", { name: "History", exact: true }).click();
    const title = await page.getByRole("textbox", { name: "Title", exact: true }).inputValue();
    await loadExample(page);
    await counts(page, 5, 1);
    assert.equal(
      await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
      title,
    );
    const english = await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue();
    assert.match(english, /Good ideas start/);
    await page.getByRole("tab", { name: "Français", exact: true }).click();
    await counts(page, 5, 1, "FR");
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
    await counts(page, 5, 1);
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
    await page.getByRole("button", { name: "History", exact: true }).click();
    await counts(page, number === 1 ? 1 : 2, 0);
  }
});

void test("concurrent correction targets the open post and preserves its unsaved draft", async (t) => {
  const page = await preview(t, false);
  await page.goto(`${base}/fr/admin/blogs/${article.slice(0, -1)}2?history=true`);
  await page.locator('[data-preview-ready="true"]').waitFor();
  await loadExample(page);
  const frenchHistory = page.getByRole("complementary", { name: "Historique · FR", exact: true });
  await frenchHistory.getByText("Publications 5 / 5 · Brouillons 1 / 1", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Ma correction à conserver");
  await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("checkbox", { name: "Comme brouillon", exact: true }).check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page
    .locator("form")
    .getByRole("alert")
    .filter({ hasText: "Cet article a changé" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Titre", exact: true }).inputValue(),
    "Ma correction à conserver",
  );
});

void test("selecting the current live publication shows the editor", async (t) => {
  const page = await preview(t, false);
  await counts(page, 2, 0);
  const live = panel(page).getByRole("button", { name: /^v2 Live\b/ });
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const returnToDraft = page.getByRole("button", { name: "Return to working draft", exact: true });
  await live.click();
  assert.equal(await returnToDraft.count(), 0);
  assert.equal(await title.isEditable(), true);

  await select(page, 1);
  await returnToDraft.waitFor();
  await live.click();
  assert.equal(await returnToDraft.count(), 0);
  assert.equal(await title.isEditable(), true);

  await loadExample(page);
  await counts(page, 5, 1);
  await select(page, 22);
  await returnToDraft.waitFor();
});

void test("the live History menu can unpublish the active language and disables Compare", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const savedTitle = "Draft to keep";
  await title.fill(savedTitle);

  const dirtyMenu = await actions(page, 22);
  assert.equal(
    await dirtyMenu.getByRole("menuitem", { name: "Unpublish", exact: true }).isDisabled(),
    true,
  );
  await dirtyMenu.press("Escape");
  await dirtyMenu.waitFor({ state: "hidden" });
  await save(page);
  await counts(page, 5, 1);

  const liveMenu = await actions(page, 22);
  assert.equal(
    await liveMenu.getByRole("menuitem", { name: "Compare", exact: true }).isDisabled(),
    true,
  );
  await liveMenu.getByRole("menuitem", { name: "Unpublish", exact: true }).click();
  await actionToast(page, "This language is no longer public.");
  await counts(page, 5, 1);
  assert.equal(await title.inputValue(), savedTitle);
  assert.equal(await panel(page).getByText("Live", { exact: true }).count(), 0);

  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await counts(page, 5, 1, "FR");
  await panel(page, "FR").getByText("Live", { exact: true }).waitFor();
});

void test("History can publish the newest saved version when no version is live", async (t) => {
  const page = await preview(t, false);
  await counts(page, 2, 0);

  const liveMenu = await actions(page, 2);
  await liveMenu.getByRole("menuitem", { name: "Unpublish", exact: true }).click();
  await actionToast(page, "This language is no longer public.");

  const olderMenu = await actions(page, 1);
  await olderMenu.getByRole("menuitem", { name: "Compare", exact: true }).focus();
  assert.equal(await olderMenu.getByRole("menuitem", { name: "Publish", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  await olderMenu.waitFor({ state: "hidden" });

  const newestMenu = await actions(page, 2);
  const publish = newestMenu.getByRole("menuitem", { name: "Publish", exact: true });
  await publish.waitFor();
  assert.equal(await newestMenu.getByRole("menuitem").first().textContent(), "Publish");
  await publish.press("Enter");

  await actionToast(page, "This language is now published");
  await counts(page, 2, 0);
  await panel(page)
    .getByRole("button", { name: /^v2\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
  const publishedMenu = await actions(page, 2);
  await publishedMenu.getByRole("menuitem", { name: "Unpublish", exact: true }).waitFor();
  assert.equal(
    await publishedMenu.getByRole("menuitem", { name: "Publish", exact: true }).count(),
    0,
  );
});

void test("inspection preserves the working draft; dirty work offers save, discard and cancel", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
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

async function resume(page, number) {
  await select(page, number);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  const replacement = page.getByRole("dialog", { name: "Replace the current draft?", exact: true });
  await replacement.getByRole("button", { name: "Replace draft", exact: true }).click();
}

void test("the single draft is replaced only after confirmation and successful save", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  assert.equal(await panel(page).locator("svg g[data-reprise-id]").count(), 0);
  const originalDraftId = await panel(page)
    .locator("li[data-history-id]")
    .first()
    .getAttribute("data-history-id");
  const original = await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue();
  await select(page, 18);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  const replacement = page.getByRole("dialog", { name: "Replace the current draft?", exact: true });
  await replacement.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
    original,
  );
  await resume(page, 18);
  const resumed = await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue();
  assert.notEqual(resumed, original);
  await page.getByRole("checkbox", { name: "As draft", exact: true }).check();
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await replacement.getByRole("button", { name: "Replace draft", exact: true }).click();
  await page
    .locator("form")
    .getByRole("alert")
    .filter({ hasText: "Storage is unavailable" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Markdown", exact: true }).inputValue(),
    resumed,
  );
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await counts(page, 5, 1);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await replacement.getByRole("button", { name: "Replace draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await counts(page, 5, 1);
  assert.equal(await panel(page).locator(`li[data-history-id="${originalDraftId}"]`).count(), 0);
  await select(page, "Draft");
  await page.getByRole("button", { name: "Edit this draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Continue the same draft");
  await save(page);
  assert.equal(await replacement.count(), 0);
  await counts(page, 5, 1);
  await panel(page).getByRole("button", { name: "Actions: Draft", exact: true }).waitFor();
});

void test("resuming without a saved draft needs no replacement warning", async (t) => {
  const page = await preview(t);
  await (
    await actions(page, "Draft")
  )
    .getByRole("menuitem", { name: "Delete draft", exact: true })
    .click();
  const deletion = page.getByRole("dialog", { name: "Delete draft", exact: true });
  await deletion.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await deletion.waitFor({ state: "hidden" });
  await counts(page, 5, 0);
  await select(page, 18);
  await page.getByRole("button", { name: "Resume as draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Markdown", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("dialog", { name: "Replace the current draft?", exact: true }).count(),
    0,
  );
  await save(page);
  await counts(page, 5, 1);
  await panel(page)
    .getByRole("button", { name: /^v22\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
});

void test("refreshing after a conflicting historical replacement requires new consent", async (t) => {
  const page = await preview(t);
  await resume(page, 18);
  const markdown = page.getByRole("textbox", { name: "Markdown", exact: true });
  await page.getByRole("checkbox", { name: "As draft", exact: true }).check();
  const resumed = await markdown.inputValue();
  await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator("form")
    .getByRole("alert")
    .filter({ hasText: "This record changed" })
    .waitFor();
  await page.getByRole("button", { name: "Refresh article", exact: true }).click();
  assert.equal(await markdown.inputValue(), resumed);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const replacement = page.getByRole("dialog", { name: "Replace the current draft?", exact: true });
  await replacement.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await markdown.inputValue(), resumed);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await replacement.getByRole("button", { name: "Replace draft", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await counts(page, 5, 1);
});

void test("unified diff marks changed words, keeps insertions single and renders markup as text", async (t) => {
  const page = await preview(t, false);
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("One clear sentence.");
  await save(page);
  await page.getByRole("checkbox", { name: "As draft", exact: true }).uncheck();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await page.getByRole("textbox", { name: "Markdown", exact: true }).fill("One precise sentence.");
  await (
    await actions(page, "Unsaved draft")
  )
    .getByRole("menuitem", { name: "Compare", exact: true })
    .click();
  assert.equal(await page.locator('mark[data-change="removed"]').textContent(), "clear");
  assert.equal(await page.locator('mark[data-change="added"]').textContent(), "precise");
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Markdown", exact: true })
    .fill("One clear sentence. <script>window.blogHistoryUnsafe=true</script>");
  await (
    await actions(page, "Unsaved draft")
  )
    .getByRole("menuitem", { name: "Compare", exact: true })
    .click();
  assert.equal(await page.locator('mark[data-change="removed"]').count(), 0);
  assert.equal(await page.locator('mark[data-change="added"]').count(), 1);
  assert.equal(await page.evaluate(() => window.blogHistoryUnsafe), undefined);
  assert.match(await page.locator('mark[data-change="added"]').textContent(), /<script>/);
});

void test("comparison identifies both sides, includes changed fields and draft saves do not skip publications", async (t) => {
  const page = await preview(t);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const slug = page.getByRole("textbox", { name: "Slug", exact: true });
  const summary = page.getByRole("textbox", { name: "Summary", exact: true });
  const beforeTitle = await title.inputValue();
  const beforeSlug = await slug.inputValue();
  const beforeSummary = await summary.inputValue();
  for (let index = 0; index < 3; index++) {
    await title.fill(`Revised title ${index}`);
    await slug.fill("revised-history-comparison");
    await summary.fill("A revised summary.");
    await save(page);
    await counts(page, 5, 1);
    assert.equal(
      await panel(page)
        .getByRole("button", { name: /^v23\b/ })
        .count(),
      0,
    );
  }
  await (
    await actions(page, "Draft")
  )
    .getByRole("menuitem", { name: "Compare", exact: true })
    .click();
  await page.getByRole("heading", { name: "v22 (live) → Draft", exact: true }).waitFor();
  const reader = page.getByRole("region", { name: "v22 (live) → Draft", exact: true });
  await reader
    .getByRole("region", { name: "Markdown", exact: true })
    .getByRole("heading", { name: "Markdown", level: 3, exact: true })
    .waitFor();
  for (const [label, before, after] of [
    ["Title", beforeTitle, "Revised title 2"],
    ["Slug", beforeSlug, "revised-history-comparison"],
    ["Summary", beforeSummary, "A revised summary."],
  ]) {
    const field = reader
      .locator("dl > div")
      .filter({ has: page.locator("dt").getByText(label, { exact: true }) });
    assert.equal(await field.locator("del").textContent(), before);
    assert.equal(await field.locator("ins").textContent(), after);
    assert.equal(await field.locator("dt").textContent(), label);
    for (const side of ["before", "after"]) {
      const value = field.locator(`[data-diff-side="${side}"]`);
      assert.ok((await value.textContent()).startsWith(side === "before" ? "−" : "+"));
    }
  }
  await select(page, "Draft");
  await (
    await actions(page, "Draft")
  )
    .getByRole("menuitem", { name: "Compare", exact: true })
    .click();
  await reader.waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page.getByRole("checkbox", { name: "As draft", exact: true }).uncheck();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await counts(page, 5, 0);
  await panel(page)
    .getByRole("button", { name: /^v23\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
});

void test("Blogs fields, actions, dialogs and routes follow the French interface", async (t) => {
  const ui = {
    locale: "fr",
    status: "État de publication",
    content: "FR",
    title: "Titre",
    summary: "Résumé",
    draft: "Brouillon",
    history: "Historique",
    actions: "Actions",
    compare: "Comparer",
    live: "en ligne",
    back: "Articles",
    save: "Enregistrer",
    asDraft: "Comme brouillon",
    saved: "Brouillon enregistré.",
    returnToDraft: "Revenir au brouillon",
    resume: "Reprendre comme brouillon",
    replaceTitle: "Remplacer le brouillon courant ?",
    cancel: "Annuler",
    upload: "Importer une image — Miniature",
    crop: "Recadrer l’image",
    useImage: "Utiliser l’image",
    error: "Une erreur est survenue. Veuillez réessayer.",
    publicTitle: "Notre blog",
  };
  const page = await preview(t, false);
  await page.goto(`${base}/${ui.locale}/admin/blogs/${article}?history=true`);
  await loadExample(page);
  const history = page.getByRole("complementary", {
    name: `${ui.history} · ${ui.content}`,
    exact: true,
  });
  await history.getByRole("button", { name: `${ui.actions}: ${ui.draft}`, exact: true }).waitFor();
  await page.getByRole("textbox", { name: ui.summary, exact: true }).waitFor();
  const status = page.getByRole("button", { name: ui.status, exact: true });
  assert.equal(await status.textContent(), ui.draft);
  await page.getByRole("textbox", { name: ui.title, exact: true }).fill(`Localized ${ui.locale}`);
  const asDraft = page.getByRole("checkbox", { name: ui.asDraft, exact: true });
  assert.equal(await asDraft.isChecked(), false);
  await asDraft.check();
  await page.getByRole("button", { name: ui.save, exact: true }).click();
  await actionToast(page, ui.saved);
  const draftActions = `${ui.actions}: ${ui.draft}`;
  const compareDraft = async () => {
    await history.getByRole("button", { name: draftActions, exact: true }).click();
    await page
      .getByRole("menu", { name: draftActions, exact: true })
      .getByRole("menuitem", { name: ui.compare, exact: true })
      .click();
  };
  await compareDraft();
  const heading = `v22 (${ui.live}) → ${ui.draft}`;
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  await page
    .getByRole("region", { name: "Markdown", exact: true })
    .getByRole("heading", { name: "Markdown", level: 3, exact: true })
    .waitFor();
  await history.getByRole("button", { name: new RegExp(`^${ui.draft}\\b`) }).click();
  await page.getByRole("heading", { name: ui.draft, exact: true }).waitFor();
  await compareDraft();
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  await history.getByRole("button", { name: /^v18\b/ }).click();
  await page.getByRole("button", { name: ui.resume, exact: true }).click();
  const replacement = page.getByRole("dialog", { name: ui.replaceTitle, exact: true });
  await replacement.getByRole("button", { name: ui.cancel, exact: true }).click();
  await page.getByRole("button", { name: ui.returnToDraft, exact: true }).click();
  await page.getByLabel(ui.upload, { exact: true }).setInputFiles({
    name: "localized.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const crop = page.getByRole("dialog", { name: ui.crop, exact: true });
  await crop.getByRole("button", { name: ui.useImage, exact: true }).waitFor();
  await crop.getByRole("button", { name: ui.cancel, exact: true }).click();
  await page.getByRole("link", { name: ui.back, exact: true }).click();
  await page.locator('[data-preview-ready="true"]').waitFor();
  assert.equal(new URL(page.url()).pathname, `/${ui.locale}/admin/blogs`);
  await page
    .getByRole("link", {
      name: /^Modifier:/,
    })
    .first()
    .waitFor();
  await page.getByRole("link", { name: "Public blog", exact: true }).click();
  await page.getByRole("heading", { name: ui.publicTitle, exact: true }).waitFor();
  await page.locator('[data-preview-ready="true"]').waitFor();
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
  await page.getByLabel("Directory state", { exact: true }).selectOption("error");
  await page.getByRole("alert").filter({ hasText: ui.error }).waitFor();
});

void test("publishing an unedited historical draft prunes only the oldest publication and isolates French", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  const publicationMenu = await actions(page, 18);
  await publicationMenu.getByRole("menuitem", { name: "Compare", exact: true }).focus();
  assert.equal(
    await publicationMenu.getByRole("menuitem", { name: "Publish", exact: true }).count(),
    0,
  );
  await page.keyboard.press("Escape");
  await publicationMenu.waitFor({ state: "hidden" });
  await select(page, 18);
  assert.equal(await page.getByRole("button", { name: "Publish", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await resume(page, 18);
  await save(page);
  await counts(page, 5, 1);
  await panel(page)
    .getByRole("button", { name: /^v22\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
  const menu = await actions(page, "Draft");
  const publishDraft = menu.getByRole("menuitem", { name: "Publish", exact: true });
  await publishDraft.waitFor();
  assert.equal(await menu.getByRole("menuitem").first().textContent(), "Publish");
  await publishDraft.click();
  await actionToast(page, "This language is now published");
  assert.equal(
    await page.getByRole("dialog", { name: "Review publication", exact: true }).count(),
    0,
  );
  await counts(page, 5, 0);
  await panel(page)
    .getByRole("button", { name: /^v23\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
  for (const number of [19, 20, 21, 22])
    await panel(page)
      .getByRole("button", {
        name: `Actions: ${typeof number === "number" ? `v${number}` : number}`,
        exact: true,
      })
      .waitFor();
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await counts(page, 5, 1, "FR");
  assert.equal(
    await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
    "Faire de la place aux idées",
  );
  await page.getByRole("tab", { name: "English", exact: true }).click();
  await loadExample(page);
  await counts(page, 5, 1);
  await page.getByRole("tab", { name: "Français", exact: true }).click();
  await counts(page, 5, 1, "FR");
});

void test("the missing-illustrations simulation explains where it applies", async (t) => {
  const page = await preview(t, false, undefined, false);
  const simulation = page.getByRole("checkbox", { name: "Simulate missing illustrations" });
  const description = () =>
    simulation.evaluate((input) =>
      document.getElementById(input.getAttribute("aria-describedby"))?.textContent.trim(),
    );

  assert.equal(await simulation.isEnabled(), true);
  assert.equal(
    await description(),
    "Publish a draft with illustrations to see the omission warning.",
  );
  await simulation.check();
  const history = page.getByRole("checkbox", { name: "History transport", exact: true });
  await history.uncheck();
  assert.equal(await simulation.isDisabled(), true);
  assert.equal(await description(), "Enable History transport to simulate missing illustrations.");
  await history.check();
  assert.equal(await simulation.isEnabled(), true);

  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.waitForURL(`${base}/en/admin/blogs`);
  assert.equal(await simulation.isDisabled(), true);
  assert.equal(await description(), "Open a post in Manage posts to try this simulation.");
});

void test("missing illustrations require explicit omission, failures remain retryable and public rendering omits them", async (t) => {
  const page = await preview(t, false);
  await counts(page, 2, 0);
  await panel(page)
    .getByRole("button", { name: /^v2\b/ })
    .getByText("Live", { exact: true })
    .waitFor();
  await page.route("https://assets.the-corner.swiss/images/**", (route) => route.abort());
  await select(page, 1);
  await page.getByText(/Set aside ten minutes to sketch out the problem/).waitFor();
  await page.getByText("Image unavailable", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Text without illustrations");
  const workingMenu = await actions(page, "Unsaved draft");
  await workingMenu.getByRole("menuitem", { name: "Compare", exact: true }).focus();
  assert.equal(
    await workingMenu.getByRole("menuitem", { name: "Publish", exact: true }).count(),
    0,
  );
  await page.keyboard.press("Escape");
  await workingMenu.waitFor({ state: "hidden" });
  await save(page);
  await page.getByLabel("Simulate missing illustrations", { exact: true }).check();
  await (
    await actions(page, "Draft")
  )
    .getByRole("menuitem", { name: "Publish", exact: true })
    .click();
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
  await counts(page, 5, 1);
  await page.getByLabel("Administrator", { exact: true }).uncheck();
  await page.getByLabel("Editor", { exact: true }).selectOption("alex");
  const staffDraftMenu = await actions(page, "Draft");
  await staffDraftMenu.getByRole("menuitem", { name: "Compare", exact: true }).focus();
  assert.equal(
    await staffDraftMenu.getByRole("menuitem", { name: "Publish", exact: true }).count(),
    0,
  );
  await page.keyboard.press("Escape");
  await staffDraftMenu.waitFor({ state: "hidden" });
  const staffLiveMenu = await actions(page, 22);
  await staffLiveMenu.getByRole("menuitem", { name: "Compare", exact: true }).waitFor();
  assert.equal(
    await staffLiveMenu.getByRole("menuitem", { name: "Unpublish", exact: true }).count(),
    0,
  );
  await staffLiveMenu.press("Escape");
  await staffLiveMenu.waitFor({ state: "hidden" });
  await select(page, 18);
  assert.equal(await page.getByRole("button", { name: "Resume as draft", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Publish", exact: true }).count(), 0);
  const staffMenu = await actions(page, 18);
  assert.equal(
    await staffMenu.getByRole("menuitem", { name: "Delete version", exact: true }).count(),
    0,
  );
  await staffMenu.getByRole("menuitem", { name: "Compare", exact: true }).click();
  await page.locator('mark[data-change="added"]').waitFor();
  await page.getByRole("button", { name: "Return to working draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Colleague correction");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await actionToast(page, "Draft saved.");
  await counts(page, 5, 1);
  await page.getByLabel("Editor", { exact: true }).selectOption("jordan");
  const live = (await actions(page, 22)).getByRole("menuitem", {
    name: "Delete version",
    exact: true,
  });
  assert.equal(await live.isDisabled(), true);
  await page.keyboard.press("Escape");
  await (
    await actions(page, "Draft")
  )
    .getByRole("menuitem", { name: "Delete draft", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete draft", exact: true });
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await counts(page, 5, 0);
});

void test("table badges publish a saved historical draft with automatic retention", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  await resume(page, 18);
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
  await actionToast(page, "This language is now published");
  assert.equal(await badge.getAttribute("aria-pressed"), "true");
});

void test("ordinary clients keep editing and comparison names the absence of a live translation", async (t) => {
  const page = await preview(t, false);
  await page.getByRole("button", { name: "Publication status", exact: true }).click();
  await actionToast(page, "This language is no longer public");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unpublished draft");
  await (
    await actions(page, "Unsaved draft")
  )
    .getByRole("menuitem", { name: "Compare", exact: true })
    .click();
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

void test("a stale missing-image plan refreshes and requires confirmation again", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  await resume(page, 18);
  await save(page);
  await page.getByLabel("Simulate missing illustrations", { exact: true }).check();
  await page.getByRole("checkbox", { name: "As draft", exact: true }).uncheck();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
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
  await dialog.getByLabel("Publish without the missing illustrations", { exact: true }).check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "This record changed" }).waitFor();
  assert.equal(await dialog.locator("li").count(), 1);
  await dialog.getByRole("button", { name: "Refresh confirmation", exact: true }).click();
  await dialog
    .getByText("The confirmation now uses the latest article state. Review it before publishing.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await dialog.locator("li").count(), 1);
  await dialog.getByLabel("Publish without the missing illustrations", { exact: true }).check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await actionToast(page, "This language is now published");
  await counts(page, 5, 0);
});

void test("a pruned selection recovers to the actual latest draft without losing unsaved input", async (t) => {
  const page = await preview(t);
  await counts(page, 5, 1);
  await select(page, "Draft");
  for (let index = 0; index < 9; index++)
    await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
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
  await counts(page, 5, 1);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Retain this unsaved title");
  await page.getByRole("checkbox", { name: "As draft", exact: true }).check();
  await page.getByRole("button", { name: "Simulate concurrent correction", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
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
  await counts(page, 5, 1);
  await page.getByLabel("Simulate action failures", { exact: true }).check();
  await panel(page).getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  assert.equal(await panel(page).locator("li[data-history-id]").count(), 6);
  await panel(page).getByRole("button", { name: "Retry", exact: true }).click();
  await panel(page).getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
  await page.getByLabel("Simulate action failures", { exact: true }).uncheck();
  await counts(page, 5, 1);
  await page.getByRole("link", { name: "Manage posts", exact: true }).click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByRole("textbox", { name: "Title *", exact: true }).fill("Empty history example");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("No saved versions in this language yet.", { exact: true }).waitFor();
});

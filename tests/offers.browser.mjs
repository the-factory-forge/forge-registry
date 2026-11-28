import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chromium } from "./showroom-browser.mjs";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
await test("Offers share the customer directory, preserve URL filters and issue priced lines on mobile", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + "/en/offers");
  const table = page.getByRole("table", { name: "Offers", exact: true });
  await table.getByText("#of-1", { exact: true }).waitFor();
  await table.getByText("#of-2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Search offers" }).click();
  const search = page.getByRole("searchbox", { name: "Search offers" });
  await search.fill("#of-2");
  await table.getByText("#of-1", { exact: true }).waitFor({ state: "hidden" });
  await table.getByText("#of-2", { exact: true }).waitFor();
  await search.fill("");
  await table.getByText("#of-1", { exact: true }).waitFor();
  await table.getByRole("button", { name: "Number" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/offersSort=/);
  const filter = page.getByRole("combobox", { name: "Status", exact: true });
  await filter.selectOption("pending");
  await page.waitForURL(/status=pending/);
  await page.reload();
  assert.equal(await filter.inputValue(), "pending");
  assert.equal(await table.getByText("Printed materials").count(), 0);
  await filter.selectOption("draft");
  await page.waitForURL(/status=draft/);
  await page.goBack();
  await table.getByText("Studio website").waitFor();
  await page.goForward();
  await table.getByText("Printed materials").waitFor();
  assert.equal(
    await table.locator("thead th:last-child").evaluate((el) => getComputedStyle(el).position),
    "sticky",
  );
  await page.goto(base + "/en/customers/acme/offers");
  assert.equal(await table.getByRole("columnheader", { name: "Customer", exact: true }).count(), 0);
  await page.getByRole("link", { name: "Create", exact: true }).click();
  assert.equal(
    await page.getByRole("combobox", { name: "Customer", exact: true }).inputValue(),
    "acme",
  );
  const sender = page.getByRole("heading", { name: "Sender", exact: true });
  await sender.waitFor();
  assert.equal(await page.locator("form img").count(), 0);
  assert.ok(
    (await sender.boundingBox()).y <
      (await page.getByRole("combobox", { name: "Customer", exact: true }).boundingBox()).y,
  );
  await page.getByLabel("Title", { exact: true }).fill("Sample order");
  await page
    .getByRole("combobox", { name: "Add product" })
    .selectOption({ label: "Linen notebook" });
  await page.getByRole("button", { name: "Save draft" }).click();
  const actions = page.getByRole("complementary", { name: "Actions", exact: true });
  const pdfHeading = actions.getByRole("heading", { name: "PDF", exact: true });
  assert.equal(await pdfHeading.count(), 0);
  await actions.getByRole("button", { name: "Issue", exact: true }).click();
  await actions.getByRole("link", { name: "Preview", exact: true }).waitFor();
  const emailPdf = actions.getByRole("button", { name: "Email", exact: true });
  const sentBadge = emailPdf.locator("..").getByText("Sent", { exact: true });
  assert.equal(await page.getByText("Unsent", { exact: true }).count(), 0);
  assert.equal(await sentBadge.count(), 0);
  await emailPdf.click();
  await sentBadge.waitFor();
  assert.ok(await emailPdf.isDisabled());
  const panel = await actions.boundingBox();
  assert.equal(await page.getByRole("heading", { name: "Sender", exact: true }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Recipient", exact: true }).count(), 0);
  const lineItems = page.getByRole("table", { name: "Line items" });
  const lines = await lineItems.boundingBox();
  const gross = lineItems.getByRole("row", { name: /Gross/ }).getByRole("cell", { name: /CHF/ });
  const scroller = await lineItems.locator("..").boundingBox();
  const grossAmount = await gross.boundingBox();
  assert.ok(grossAmount.x + grossAmount.width <= scroller.x + scroller.width);
  assert.ok(panel.y + panel.height <= lines.y, "The combined card sits above the mobile document");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await actions.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByText("Accepted", { exact: true }).waitFor();
  assert.equal(await actions.getByRole("link", { name: "Edit", exact: true }).count(), 0);
  const save = page.getByRole("button", { name: "Save draft", exact: true });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  assert.equal(await save.count(), 0);
  const net = lineItems.locator("tbody tr").first().getByRole("cell").nth(-2);
  const initialNet = await net.textContent();
  const quantity = lineItems.getByRole("button", { name: /^Quantity 1:/ });
  await quantity.click();
  const quantityInput = lineItems.getByRole("textbox", { name: "Quantity 1", exact: true });
  await quantityInput.fill("0");
  await save.click();
  await page
    .getByRole("alert")
    .getByText(/Check the required fields/)
    .waitFor();
  await quantity.click();
  await quantityInput.fill("2");
  assert.notEqual(await net.textContent(), initialNet);
  const toggle = page.getByRole("button", { name: "Actions", exact: true });
  await toggle.click();
  assert.equal(await actions.count(), 0);
  assert.notEqual(await net.textContent(), initialNet);
  await toggle.click();
  await actions.waitFor();
  await cancel.click();
  assert.equal(await net.textContent(), initialNet);
  assert.equal(await save.count(), 0);
  await page.getByRole("button", { name: "Title: Sample order", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Updated order");
  await save.click();
  await page.getByRole("heading", { name: /Updated order/ }).waitFor();
  await actions.getByRole("button", { name: "Reissue" }).click();
  await actions.getByRole("button", { name: "Decline", exact: true }).waitFor();
  assert.ok(await emailPdf.isEnabled());
  assert.equal(await sentBadge.count(), 0);
});

await test("Contenteditable offer fields keep column widths stable across viewports", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/en/offers/studio");
    const table = page.getByRole("table", { name: "Line items" });
    const columnWidths = () =>
      table
        .getByRole("columnheader")
        .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().width));
    await table.getByRole("button", { name: /^Unit price 1:/ }).waitFor();
    const before = await columnWidths();

    await table.getByRole("button", { name: /^Unit price 1:/ }).click();
    const price = table.getByRole("textbox", { name: "Unit price 1", exact: true });
    assert.equal(await price.getAttribute("contenteditable"), "plaintext-only");
    assert.equal(await price.getAttribute("inputmode"), "decimal");
    assert.deepEqual(await columnWidths(), before);
    await price.fill("1234567.89");
    assert.deepEqual(await columnWidths(), before);
    await price.press("Escape");
    const priceTrigger = table.getByRole("button", { name: /^Unit price 1: CHF 1,490/ });
    assert.ok(await priceTrigger.evaluate((element) => element === document.activeElement));
    await priceTrigger.press("Enter");
    await price.fill("1500.00");
    await price.press("Enter");
    await table.getByRole("button", { name: /^Unit price 1: CHF 1,500/ }).waitFor();
    assert.deepEqual(await columnWidths(), before);

    await table.getByRole("button", { name: "Add line", exact: true }).click();
    const description = table.getByRole("textbox", { name: "Description 4", exact: true });
    assert.equal(await description.getAttribute("contenteditable"), "plaintext-only");
    assert.equal(await description.getAttribute("aria-multiline"), "true");
    const firstLine = "Extended description ".repeat(15).trim();
    await description.fill(firstLine);
    await description.press("Enter");
    await page.keyboard.insertText("Second line");
    await description.press("Tab");
    const descriptionTrigger = table.getByRole("button", { name: /^Description 4: Extended/ });
    assert.equal(await descriptionTrigger.textContent(), firstLine + "\nSecond line");

    await table.getByRole("button", { name: "Unit 1: project", exact: true }).click();
    const unit = table.getByRole("textbox", { name: "Unit 1", exact: true });
    const maxLengthUnit = "u".repeat(40);
    await unit.fill(maxLengthUnit);
    await unit.press("Home");
    await page.keyboard.insertText("x");
    assert.equal(await unit.textContent(), maxLengthUnit);
    await unit.press("Escape");
    assert.deepEqual(await columnWidths(), before);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});

await test("Offer actions sit beside the document and support keyboard decisions", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: "reduce",
  });
  await page.goto(base + "/en/offers/studio");
  const offerDocument = page.getByRole("region", { name: "Studio website", exact: true });
  await offerDocument.getByRole("heading", { name: "Studio website", exact: true }).waitFor();
  assert.equal(await offerDocument.getByRole("textbox").count(), 0);
  const reference = await page.getByText("#of-1", { exact: true }).boundingBox();
  const status = await page.getByText("Pending", { exact: true }).boundingBox();
  const documentPanel = await offerDocument.boundingBox();
  assert.ok(reference.y + reference.height <= documentPanel.y);
  assert.ok(status.y + status.height <= documentPanel.y);
  const lineItems = offerDocument.getByRole("table", { name: "Line items" });
  assert.deepEqual(await lineItems.locator("tbody th").allTextContents(), ["1", "2", "3"]);
  await lineItems.getByRole("row", { name: /Gross.*2,116.60/ }).waitFor();
  assert.equal(await lineItems.getByRole("columnheader").last().textContent(), "Actions");
  const actions = page.getByRole("complementary", { name: "Actions", exact: true });
  const pdfHeading = actions.getByRole("heading", { name: "PDF", exact: true });
  const preview = actions.getByRole("link", { name: "Preview", exact: true });
  const downloadLink = actions.getByRole("link", { name: "Download", exact: true });
  await preview.waitFor();
  assert.equal(await preview.getAttribute("target"), "_blank");
  assert.equal(await preview.getAttribute("href"), await downloadLink.getAttribute("href"));
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  assert.equal(download.suggestedFilename(), "offer-1.pdf");
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.match(bytes.toString("latin1"), /\/Subtype \/Image\b/);
  const panel = await actions.boundingBox();
  const offerDetail = offerDocument.locator("xpath=ancestor::article[1]");
  assert.equal(await offerDetail.getByRole("complementary").count(), 1);
  assert.equal(panel.y, documentPanel.y, "Actions align with the top of the document");
  const toggle = offerDetail.getByRole("button", { name: "Actions", exact: true });
  const toggleBox = await toggle.boundingBox();
  assert.ok(Math.abs(toggleBox.x + toggleBox.width - panel.x - panel.width) < 1);
  assert.ok(toggleBox.y + toggleBox.height <= panel.y);
  assert.equal(status.y + status.height / 2, toggleBox.y + toggleBox.height / 2);
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(await toggle.getAttribute("aria-controls"), await actions.getAttribute("id"));
  await toggle.focus();
  await page.keyboard.press("Enter");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await actions.count(), 0);
  const collapsedToggle = await toggle.boundingBox();
  const collapsedStatus = await page.getByText("Pending", { exact: true }).boundingBox();
  assert.equal(collapsedToggle.width, 32);
  assert.equal(collapsedToggle.height, 32);
  assert.equal(
    collapsedStatus.y + collapsedStatus.height / 2,
    collapsedToggle.y + collapsedToggle.height / 2,
  );
  assert.ok((await offerDocument.boundingBox()).width > documentPanel.width);
  assert.ok(await toggle.evaluate((element) => document.activeElement === element));
  await page.keyboard.press("Space");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await actions.waitFor();
  await page.setViewportSize({ width: 1600, height: 330 });
  await page.evaluate(() => window.scrollTo(0, 250));
  const stickyPanel = await actions.boundingBox();
  const stickyToggle = await toggle.boundingBox();
  const sectionHeader = actions.getByRole("heading", { name: "Actions" }).locator("..");
  const border = await actions.evaluate((element) => {
    element.scrollTop = 36;
    return { top: element.clientTop, scroll: element.scrollTop };
  });
  assert.ok(stickyToggle.y >= 0 && stickyToggle.y + stickyToggle.height < stickyPanel.y);
  assert.ok(border.top > 0 && border.scroll > 16);
  assert.equal((await actions.boundingBox()).y, stickyPanel.y);
  assert.equal((await sectionHeader.boundingBox()).y, stickyPanel.y + border.top);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const lines = await page.getByRole("table", { name: "Line items" }).boundingBox();
  const sender = page.getByRole("heading", { name: "Sender", exact: true });
  const recipient = page.getByRole("heading", { name: "Recipient", exact: true });
  assert.equal(await sender.count(), 0);
  assert.equal(await recipient.count(), 0);
  await page.emulateMedia({ media: "print" });
  assert.ok(await sender.isVisible());
  assert.ok(await recipient.isVisible());
  assert.ok(await page.getByText("Rue de Saint-Guérin 6").isVisible());
  assert.ok(await page.getByText("Rue du Rhône 10", { exact: true }).isVisible());
  assert.equal(await page.getByRole("link", { name: "Edit customer" }).count(), 0);
  await page.emulateMedia({ media: "screen" });
  assert.equal(await page.locator("article img").count(), 0);
  assert.ok(lines.x + lines.width <= panel.x, "Actions sit to the right of the document");
  const accept = actions.getByRole("button", { name: "Accept", exact: true });
  const decline = actions.getByRole("button", { name: "Decline", exact: true });
  const deleteOffer = actions.getByRole("button", { name: "Delete offer", exact: true });
  const deleteBox = await deleteOffer.boundingBox();
  const actionsHeading = await actions.getByRole("heading", { name: "Actions" }).boundingBox();
  const acceptBox = await accept.boundingBox();
  assert.ok(deleteBox.x >= actionsHeading.x + actionsHeading.width);
  assert.ok(deleteBox.y + deleteBox.height <= acceptBox.y);
  assert.ok(acceptBox.y + acceptBox.height <= (await pdfHeading.boundingBox()).y);
  await accept.focus();
  await page.keyboard.press("Tab");
  assert.ok(await decline.evaluate((button) => button === document.activeElement));
  await page.keyboard.press("Enter");
  await page.getByText("Declined", { exact: true }).waitFor();
  assert.equal(await accept.count(), 0);
  assert.equal(await decline.count(), 0);
  await preview.waitFor();
  await deleteOffer.click();
  const confirmation = page.getByRole("dialog", { name: "Delete offer", exact: true });
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await confirmation.waitFor({ state: "hidden" });
  await deleteOffer.click();
  await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL(/\/en\/offers$/);
  assert.equal(await page.getByRole("link", { name: "#of-1", exact: true }).count(), 0);
});

await test("Offer lines can be reordered by pointer and keyboard and removed from the right", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(base + "/en/offers/studio");
  const table = page.getByRole("table", { name: "Line items", exact: true });
  const rows = table.locator("tbody tr");
  const descriptions = () => rows.locator("td:nth-child(2)").allTextContents();
  const first = table.getByRole("button", { name: "Reorder line 1", exact: true });
  const third = table.getByRole("button", { name: "Reorder line 3", exact: true });
  await first.waitFor();
  await table.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const remove = rows.first().getByRole("button", { name: "Remove line", exact: true });
  assert.ok(
    await remove.evaluate(
      (button) => button.closest("td") === button.closest("tr").lastElementChild,
    ),
  );
  await rows.first().hover();
  assert.equal(await remove.evaluate((button) => getComputedStyle(button).opacity), "1");
  await page.getByRole("heading", { name: /Studio website/ }).hover();
  assert.equal(await remove.evaluate((button) => getComputedStyle(button).opacity), "0");
  const date = page.getByRole("button", { name: "Offer date: 2026-11-11", exact: true });
  assert.equal(await date.locator("svg").evaluate((icon) => getComputedStyle(icon).opacity), "0");
  await date.hover();
  assert.equal(await date.locator("svg").evaluate((icon) => getComputedStyle(icon).opacity), "1");
  await date.click();
  const dateInput = page.locator('input[type="date"][aria-label="Offer date"]');
  await dateInput.fill("2026-11-12");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await date.waitFor();
  assert.equal(await page.getByRole("button", { name: "Save draft", exact: true }).count(), 0);
  await table.getByRole("button", { name: "Add line", exact: true }).click();
  const description = rows.last().getByRole("textbox", { name: "Description 4", exact: true });
  assert.ok(await description.evaluate((input) => input === document.activeElement));
  await description.fill("Temporary line");
  await rows.last().getByRole("button", { name: "Remove line", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Save draft", exact: true }).count(), 0);
  const up = (row) => row.getByRole("button", { name: "Move line up", exact: true });
  const down = (row) => row.getByRole("button", { name: "Move line down", exact: true });
  const opacity = (button) => button.evaluate((el) => getComputedStyle(el.parentElement).opacity);
  const original = ["Website delivery", "Monthly hosting", "Additional service"];
  await page.getByRole("heading", { name: /Studio website/ }).hover();
  assert.equal(await opacity(down(rows.first())), "0");
  await rows.first().hover();
  assert.equal(await opacity(down(rows.first())), "1");
  assert.equal(await opacity(down(rows.nth(1))), "0");
  assert.ok(await up(rows.first()).isDisabled());
  assert.ok(await down(rows.last()).isDisabled());
  await down(rows.first()).click();
  assert.deepEqual(await descriptions(), [
    "Monthly hosting",
    "Website delivery",
    "Additional service",
  ]);
  await rows.nth(1).hover();
  await up(rows.nth(1)).click();
  assert.deepEqual(await descriptions(), original);
  await page.getByRole("heading", { name: /Studio website/ }).hover();
  assert.equal(await opacity(down(rows.nth(1))), "0");
  await first.focus();
  await page.keyboard.press("Tab");
  assert.ok(await down(rows.first()).evaluate((button) => button === document.activeElement));
  assert.equal(await opacity(down(rows.first())), "1");
  await down(rows.first()).blur();

  const start = await first.getByText("1", { exact: true }).boundingBox();
  const end = await third.getByText("3", { exact: true }).boundingBox();
  async function drag() {
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2 + 8, { steps: 8 });
  }
  await drag();
  assert.deepEqual(await descriptions(), original);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(await descriptions(), original);
  await drag();
  await page.mouse.up();
  assert.deepEqual(await descriptions(), [
    "Monthly hosting",
    "Additional service",
    "Website delivery",
  ]);

  await third.press("ArrowUp");
  assert.deepEqual(await descriptions(), [
    "Monthly hosting",
    "Website delivery",
    "Additional service",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await table.evaluate((el) => el.scrollIntoView({ block: "center" }));
  assert.equal(await opacity(up(rows.last())), "1");
  const touchStart = await third.getByText("3", { exact: true }).boundingBox();
  const touchEnd = await first.getByText("1", { exact: true }).boundingBox();
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: touchStart.x + touchStart.width / 2, y: touchStart.y + touchStart.height / 2 },
    ],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchEnd.x + touchEnd.width / 2, y: touchEnd.y + touchEnd.height / 2 - 8 }],
  });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.deepEqual(await descriptions(), [
    "Additional service",
    "Monthly hosting",
    "Website delivery",
  ]);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await rows.nth(1).getByRole("button", { name: "Remove line", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.waitForURL(/\/offers\/studio$/);
  await table.getByText("Additional service", { exact: true }).waitFor();
  assert.deepEqual(await rows.locator("td:nth-child(2)").allTextContents(), [
    "Additional service",
    "Website delivery",
  ]);
});

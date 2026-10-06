import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3215";
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});
async function preview(t, path = "/en/reservations", options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL + path);
  await page.locator('[data-preview-ready="true"]').waitFor();
  return page;
}
async function createBooking(page, name = "Robin Example") {
  await page
    .getByRole("combobox", { name: "Practitioner or resource", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: /09:00.*GMT/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("robin@example.test");
  await page.getByRole("button", { name: "Review booking", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Book appointment", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Your reservation has been saved.", { exact: false }).waitFor();
}

test("homepage discovery, booking, calendar views, private rescheduling and cancellation", async (t) => {
  const page = await preview(t, "/");
  await page.getByRole("link", { name: /Reservations Appointments and overnight stays/ }).waitFor();
  await page.getByRole("button", { name: "Plugin", exact: true }).click();
  await page.getByRole("link", { name: /Reservations Appointments and overnight stays/ }).click();
  await createBooking(page);
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  await page
    .getByText(/Robin Example ·/)
    .first()
    .waitFor();
  for (const name of ["Month", "Day", "Agenda", "Week"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page
      .getByText(/Robin Example ·/)
      .first()
      .waitFor();
  }
  await page.getByRole("link", { name: "Manage latest reservation" }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /(?:13:00|01:00.*PM).*GMT/ }).click();
  await dialog.getByRole("button", { name: "Save new time" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Cancel reservation", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await page.getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Reschedule", exact: true }).count(), 0);
});

test("manual approval, retained fields on failure, mobile and French", async (t) => {
  const page = await preview(t, "/en/reservations", {
    viewport: { width: 390, height: 844 },
    timezoneId: "America/New_York",
  });
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("clinic");
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: /09:00.*GMT/ }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Pat Example");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("pat@example.test");
  await page.getByRole("button", { name: "Review booking" }).click();
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Pat Example",
  );
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: /09:00.*GMT/ }).click();
  await page.getByRole("button", { name: "Review booking" }).click();
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await page.getByText("Awaiting approval", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  await page
    .getByText(/Pat Example ·/)
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve", exact: true }).focus();
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(
    await page.locator(".reservations-calendar").evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await page.screenshot({ path: "/tmp/reservations-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Français", exact: true }).click();
  await page.getByRole("heading", { name: "Réserver un rendez-vous" }).waitFor();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Vérifier la réservation" }).count(), 1);
});

test("settings editors, server-style failures, new resources, closures and shared state", async (t) => {
  const page = await preview(t, "/en/admin/reservations/settings");
  await page.getByRole("link", { name: "New resource", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Jordan");
  await page.getByRole("checkbox", { name: "Active", exact: true }).check();
  const monday = page.getByRole("group", { name: "Monday", exact: true });
  await monday.getByRole("button", { name: "Add interval" }).click();
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Jordan",
  );
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).waitFor();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByText("Jordan", { exact: true }).waitFor();
  await page.getByRole("link", { name: "New service", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Consultation");
  await page.getByRole("spinbutton", { name: "Duration (minutes)", exact: true }).fill("30");
  await page.getByRole("checkbox", { name: "Alex", exact: true }).check();
  await page.getByRole("checkbox", { name: "Active", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).waitFor();
  await page.getByRole("link", { name: "Public booking", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Service", exact: true })
    .selectOption({ label: "Consultation" });
  await page.getByRole("button", { name: /09:00.*GMT/ }).waitFor();
});

test("empty calendar, loading state and keyboard date selection", async (t) => {
  const page = await preview(t);
  const date = page.getByLabel("Date", { exact: true });
  await date.waitFor();
  await page.getByLabel("Slow responses").check();
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await page.getByRole("button", { name: "Empty calendar", exact: true }).click();
  await page.getByRole("tab", { name: "Agenda", exact: true }).click();
  await page.getByText("No reservations in this period.").waitFor();
  await page.screenshot({ path: "/tmp/reservations-calendar.png", fullPage: true });
  await page.getByRole("link", { name: "Public booking", exact: true }).click();
  const selected = page.locator('button[aria-pressed="true"]').first();
  await selected.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /09:00.*GMT/ }).waitFor();
});

test("staff create, filter, reschedule and reject a manual request", async (t) => {
  const page = await preview(t, "/en/admin/reservations");
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("clinic");
  await page.getByRole("button", { name: "New reservation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /09:00.*GMT/ }).click();
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Staff Guest");
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("staff-guest@example.test");
  await dialog.getByRole("button", { name: "Book appointment", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const event = page.getByText(/Staff Guest ·/).first();
  await event.waitFor();
  const status = page.getByRole("combobox", { name: "Status", exact: true });
  await status.selectOption("confirmed");
  await event.waitFor({ state: "hidden" });
  await status.selectOption("pending");
  await event.click();
  await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
  await dialog.getByRole("button", { name: /(?:13:00|01:00.*PM).*GMT/ }).click();
  await dialog.getByRole("button", { name: "Save new time", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await event.click();
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await event.waitFor({ state: "hidden" });
  await status.selectOption("rejected");
  await event.waitFor();
});

test("rolling year rows, filtered counts, leap days and keyboard drilldown", async (t) => {
  const page = await preview(t);
  const date = await page.getByLabel("Date", { exact: true }).inputValue();
  await createBooking(page, "Year Guest");
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  await page.getByRole("tab", { name: "Year", exact: true }).click();
  const table = page.getByRole("table", { name: "Year", exact: true });
  await table.waitFor();
  assert.equal(await table.getByRole("row").count(), 12);
  assert.equal(
    await table.locator("button[data-date]").first().getAttribute("data-date"),
    date.slice(0, 7) + "-01",
  );
  const booked = table.locator(`button[data-date="${date}"]`);
  assert.match(await booked.getAttribute("aria-label"), /Reservations: 2$/);
  const resource = page.getByRole("combobox", { name: "Practitioner or resource", exact: true });
  await resource.selectOption("10000000-0000-4000-8000-000000000002");
  await table.waitFor();
  assert.match(await booked.getAttribute("aria-label"), /Reservations: 0$/);
  await resource.selectOption("");
  await table.waitFor();
  const status = page.getByRole("combobox", { name: "Status", exact: true });
  await status.selectOption("pending");
  await table.waitFor();
  assert.match(await booked.getAttribute("aria-label"), /Reservations: 0$/);
  await status.selectOption("");
  await table.waitFor();
  await booked.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator(":focus").getAttribute("data-date"), date);
  await page.keyboard.press("Enter");
  await page
    .getByText(/Year Guest ·/)
    .first()
    .waitFor();
  assert.equal(
    await page.getByRole("tab", { name: "Day", exact: true }).getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("tab", { name: "Year", exact: true }).click();
  await table.waitFor();
  for (
    let i = 0;
    i < 4 && (await table.locator('button[data-date$="-02-29"]').count()) === 0;
    i++
  ) {
    const start = await table.locator("button[data-date]").first().getAttribute("data-date");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await table
      .locator(`button[data-date="${Number(start.slice(0, 4)) + 1}${start.slice(4)}"]`)
      .waitFor();
  }
  assert.equal(await table.locator('button[data-date$="-02-29"]').count(), 1);
  assert.equal(await table.locator('button[data-date$="-02-30"]').count(), 0);
  assert.equal(await table.locator('button[data-date$="-04-31"]').count(), 0);
  await page.screenshot({ path: "/tmp/reservations-year.png", fullPage: true });
});

test("French year view on mobile keeps scrolling inside the table in both themes", async (t) => {
  const page = await preview(t, "/fr/admin/reservations", {
    viewport: { width: 390, height: 844 },
  });
  await page.getByRole("tab", { name: "Année", exact: true }).click();
  const table = page.getByRole("table", { name: "Année", exact: true });
  await table.waitFor();
  assert.equal(await table.getByRole("row").count(), 12);
  for (const theme of ["Dark", "Light"]) {
    const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
      await toggle.click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.equal(
      await table.evaluate((el) => el.parentElement.scrollWidth > el.parentElement.clientWidth),
      true,
    );
  }
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await table.locator("button[data-date]").last().focus();
  assert.equal(
    await table
      .getByRole("rowheader")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().left) >= 0),
    true,
  );
  await page.screenshot({ path: "/tmp/reservations-year-mobile.png", fullPage: true });
});

test("apartment stay booking, retained dates, multi-day calendar, rescheduling and closures", async (t) => {
  const page = await preview(t);
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("apartment");
  await page.getByRole("heading", { name: "Book a stay", exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "Accommodation", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000002");
  const arrival = await page.getByLabel("Arrival date", { exact: true }).inputValue();
  const addDays = (days) =>
    new Date(Date.parse(`${arrival}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const departure = addDays(3);
  await page.getByLabel("Departure date", { exact: true }).fill(departure);
  await page.getByRole("button", { name: /(?:15:00|03:00.*PM).*GMT/ }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Stay Guest");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("stay@example.test");
  await page.getByLabel("Simulate action failures").check();
  await page.getByRole("button", { name: "Review booking", exact: true }).click();
  await page.getByText(/Nights: 3/).waitFor();
  await page.getByRole("button", { name: "Book stay", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Arrival date", { exact: true }).inputValue(), arrival);
  assert.equal(await page.getByLabel("Departure date", { exact: true }).inputValue(), departure);
  assert.equal(
    await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(),
    "Stay Guest",
  );
  await page.getByLabel("Simulate action failures").uncheck();
  await page.getByRole("button", { name: "Review booking", exact: true }).click();
  await page.getByRole("button", { name: "Book stay", exact: true }).click();
  await page.getByText("Your reservation has been saved.", { exact: false }).waitFor();
  await page.getByText(/Nights: 3/).waitFor();
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  for (const view of ["Month", "Week", "Day", "Agenda"]) {
    await page.getByRole("tab", { name: view, exact: true }).click();
    await page
      .getByText(/Stay Guest ·/)
      .first()
      .waitFor();
  }
  await page.getByRole("tab", { name: "Year", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Accommodation", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000002");
  await page.waitForFunction(
    (date) =>
      document
        .querySelector(`button[data-date="${date}"]`)
        ?.getAttribute("aria-label")
        ?.endsWith(": 1"),
    addDays(1),
  );
  assert.match(
    await page.locator(`button[data-date="${departure}"]`).getAttribute("aria-label"),
    /: 1$/,
  );
  await page.getByRole("link", { name: "Manage latest reservation", exact: true }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Departure date", { exact: true }).fill(addDays(4));
  await dialog.getByRole("button", { name: /(?:16:00|04:00.*PM).*GMT/ }).click();
  await dialog.getByRole("button", { name: "Save new time", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText(/Nights: 4/).waitFor();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("link", { name: "Edit Apartment 2", exact: true }).click();
  assert.equal(
    await page.getByRole("heading", { name: "Weekly working hours", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Add closure", exact: true }).click();
  await page.getByLabel("Blocked from", { exact: true }).fill(addDays(1));
  await page.getByLabel("Blocked through (inclusive)", { exact: true }).fill(addDays(2));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Blocked from", { exact: true }).fill(addDays(10));
  await page.getByLabel("Blocked through (inclusive)", { exact: true }).fill(addDays(12));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved.", { exact: true }).waitFor();
});

test("French stay dates and arrival choices work by keyboard on mobile in both themes", async (t) => {
  const page = await preview(t, "/fr/reservations", { viewport: { width: 390, height: 844 } });
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("apartment");
  await page.getByRole("heading", { name: "Réserver un séjour", exact: true }).waitFor();
  for (const theme of ["Light", "Dark"]) {
    const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "Dark"))
      await toggle.click();
    await page.getByRole("button", { name: "Date de départ", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /15:00.*UTC/ }).focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: `/tmp/reservations-stay-${theme.toLowerCase()}.png`,
      fullPage: true,
    });
  }
});

test("staff configures stay policy and creates a manually approved stay", async (t) => {
  const page = await preview(t, "/en/admin/reservations/settings");
  await page.getByRole("combobox", { name: "Example", exact: true }).selectOption("apartment");
  await page.getByRole("link", { name: "New service", exact: true }).click();
  assert.equal(await page.getByLabel("Duration (minutes)", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Earliest arrival", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Checkout time", { exact: true }).inputValue(), "");
  await page.getByLabel("Name", { exact: true }).fill("Weekend stay");
  await page.getByLabel("Active", { exact: true }).check();
  await page.getByLabel("Apartment 2", { exact: true }).check();
  await page.getByLabel("Earliest arrival", { exact: true }).fill("15:00");
  await page.getByLabel("Arrival window end (exclusive)", { exact: true }).fill("18:00");
  await page.getByLabel("Checkout time", { exact: true }).fill("10:00");
  await page.getByLabel("Minimum nights", { exact: true }).fill("2");
  await page.getByLabel("Maximum nights", { exact: true }).fill("5");
  await page.getByRole("combobox", { name: /^Approval/ }).selectOption("manual");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/services\/(?!new)[^/]+$/);
  await page.getByRole("link", { name: "Staff calendar", exact: true }).click();
  await page.getByRole("button", { name: "New reservation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Stay offering", exact: true })
    .selectOption({ label: "Weekend stay" });
  const arrival = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await dialog.getByLabel("Arrival date", { exact: true }).fill(arrival);
  await dialog
    .getByLabel("Departure date", { exact: true })
    .fill(new Date(Date.parse(`${arrival}T12:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10));
  await dialog.getByRole("button", { name: /(?:15:00|03:00.*PM).*GMT/ }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Staff Stay");
  await dialog.getByLabel("Email", { exact: true }).fill("staffstay@example.test");
  await dialog.getByRole("button", { name: "Book stay", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "Year", exact: true }).click();
  await page.locator(`button[data-date="${arrival}"]`).click();
  await page
    .getByText(/Staff Stay ·/)
    .first()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByText(/Staff Stay ·.*Confirmed/)
    .first()
    .waitFor();
});

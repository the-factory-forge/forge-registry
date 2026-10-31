import assert from "node:assert/strict";
import { after, before, test, suite } from "node:test";

import { openDriveFolderDialog, closeDriveNavigation } from "./drive-helpers.mjs";
import { chromium } from "./showroom-browser.mjs";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
await suite("Connector showcase", async () => {
  let browser;
  before(async () => {
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
  });
  async function open(t, path, width = 1280) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.goto(base + path);
    return page;
  }

  await test("connectors are discoverable in the directory and adapter search", async (t) => {
    const page = await open(t, "/?category=Connector");
    const examples = page.getByRole("region", { name: "Examples", exact: true });
    assert.equal(await examples.getByRole("link").count(), 2);
    for (const [name, slug] of [
      ["Customers–Bexio", "customers-bexio"],
      ["Projects–Drive", "projects-drive"],
    ]) {
      assert.equal(
        await examples.getByRole("link", { name: new RegExp(name) }).getAttribute("href"),
        `/connectors/${slug}`,
      );
    }
    await page.reload();
    assert.equal(await examples.getByRole("link").count(), 2);
    await page.getByRole("searchbox", { name: "Search examples" }).fill("adapter");
    assert.equal(await examples.getByRole("link").count(), 2);
    await examples.getByRole("link", { name: /Customers–Bexio/ }).click();
    await page.getByRole("heading", { name: "Bexio contacts" }).waitFor();
    await page.getByText("Adapters and installation", { exact: true }).click();
    await page
      .getByText("BexioCredentialProvider — server-side access token", { exact: true })
      .waitFor();
  });

  await test("Bexio linking, reviewed import, failure recovery and URL searches", async (t) => {
    const page = await open(t, "/connectors/customers-bexio?person=Alex");
    const person = page.getByRole("region", { name: "Contact person", exact: true });
    await person.getByRole("button", { name: "Link", exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).check();
    await person.getByRole("button", { name: "Search Bexio", exact: true }).click();
    await person.getByRole("alert").waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).uncheck();
    await page.getByRole("button", { name: "Reload contacts", exact: true }).click();
    await person.getByRole("button", { name: "Link", exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).check();
    await person.getByRole("button", { name: "Link", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "The action failed" }).waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).uncheck();
    await person.getByRole("button", { name: "Link", exact: true }).click();
    await person.getByText("101", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Review import", exact: true }).click();
    await page.getByRole("region", { name: "Confirm import", exact: true }).waitFor();
    await page.getByRole("button", { name: "Confirm import", exact: true }).click();
    await page.getByText("Synchronized", { exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Read-only connection" }).check();
    assert.equal(
      await page.getByRole("button", { name: "Send to Bexio", exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("checkbox", { name: "Read-only connection" }).uncheck();
    await person.getByRole("button", { name: "Unlink locally", exact: true }).click();
    await person.getByRole("button", { name: "Link", exact: true }).waitFor();
    await person.getByRole("textbox", { name: "Search people" }).fill("Nobody");
    await person.getByRole("button", { name: "Search Bexio" }).click();
    await person.getByText("No matching contacts.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("person"), "Nobody");
    await page.goBack();
    await person.getByRole("button", { name: "Link", exact: true }).waitFor();
    assert.equal(await person.getByRole("textbox", { name: "Search people" }).inputValue(), "Alex");
    await page.goForward();
    await person.getByText("No matching contacts.", { exact: true }).waitFor();
    await page.reload();
    assert.equal(
      await person.getByRole("textbox", { name: "Search people" }).inputValue(),
      "Nobody",
    );
    await person.getByText("No matching contacts.", { exact: true }).waitFor();
  });

  await test("bulk import is retryable and saved customers automatically synchronize", async (t) => {
    const page = await open(t, "/connectors/customers-bexio");
    const bulk = page.getByRole("region", { name: "Sync all from Bexio", exact: true });
    const button = bulk.getByRole("button", { name: "Sync all from Bexio", exact: true });
    await page.getByRole("checkbox", { name: "Simulate action failures" }).check();
    await button.click();
    await bulk.getByRole("alert").waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).uncheck();
    await button.click();
    const result = bulk.getByRole("region", { name: "Import results", exact: true });
    await result.waitFor();
    const count = (label) =>
      result
        .locator("dl > div")
        .filter({ has: page.locator("dt", { hasText: label }) })
        .locator("dd");
    assert.equal(await count("Created").innerText(), "1");
    await button.click();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("dt")].find((node) => node.textContent === "Created")
          ?.nextElementSibling?.textContent === "0",
    );
    assert.equal(await count("Updated").innerText(), "2");
    await page.getByRole("link", { name: "About", exact: true }).click();
    await page.getByRole("textbox", { name: /^Full name/ }).fill("Saved automatically");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByText("Customer updated.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Sync", exact: true }).click();
    await page.getByRole("button", { name: "Review import", exact: true }).click();
    await page
      .getByRole("region", { name: "Confirm import", exact: true })
      .getByText("Saved automatically", { exact: true })
      .waitFor();
    await page.getByRole("link", { name: "About", exact: true }).click();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).check();
    await page.getByRole("textbox", { name: /^Full name/ }).fill("Saved despite Bexio failure");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Customer saved, but Bexio" }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: /^Full name/ }).inputValue(),
      "Saved despite Bexio failure",
    );
    await page.getByRole("checkbox", { name: "Simulate action failures" }).uncheck();
    await page.getByRole("link", { name: "Sync", exact: true }).click();
    await page.getByRole("button", { name: "Send to Bexio", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Customer saved, but Bexio" })
      .waitFor({ state: "hidden" });
    await page.getByRole("checkbox", { name: "Read-only connection" }).check();
    assert.equal(await button.isDisabled(), true);
  });

  await test("project Drive retains folder failure recovery and navigation", async (t) => {
    const page = await open(t, "/connectors/projects-drive");
    await page.getByText("Design brief.txt", { exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).check();
    await openDriveFolderDialog(page);
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("textbox") });
    await dialog.getByRole("textbox").fill("Connector folder");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.getByRole("alert").filter({ hasText: "Storage is unavailable" }).waitFor();
    assert.equal(await dialog.getByRole("textbox").inputValue(), "Connector folder");
    assert.equal(
      await dialog.getByRole("button", { name: "Create", exact: true }).isEnabled(),
      true,
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("checkbox", { name: "Simulate action failures" }).uncheck();
    await openDriveFolderDialog(page);
    await dialog.getByRole("textbox").fill("Connector folder");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await closeDriveNavigation(page);
    await page.getByRole("link", { name: "Connector folder", exact: true }).last().click();
    await page.waitForURL(/folder=/);
    await page.goBack();
    await page.getByText("Design brief.txt", { exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Read-only connection" }).check();
    await page.getByText("Read-only", { exact: true }).waitFor();
    await page.getByText("Design brief.txt", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Upload files", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Delete", exact: true }).count(), 0);
  });

  await test("connector layouts fit desktop and mobile in both themes", async (t) => {
    const page = await open(t, "/");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(theme);
          localStorage.setItem("forge-showroom-theme", theme);
        }, theme);
        for (const slug of ["customers-bexio", "projects-drive"]) {
          await page.goto(`${base}/connectors/${slug}`);
          await page
            .getByRole("heading", {
              name: slug === "customers-bexio" ? "Bexio contacts" : "Customer portal",
              level: slug === "customers-bexio" ? 2 : 1,
              exact: true,
            })
            .waitFor();
          if (slug === "customers-bexio")
            await page.locator('section[aria-label="Bexio contacts"][aria-busy="false"]').waitFor();
          else {
            await page.getByText("Design brief.txt", { exact: true }).waitFor();
            if (width === 390)
              assert.ok(
                (
                  await page
                    .getByRole("heading", { name: "Customer portal", level: 1, exact: true })
                    .boundingBox()
                ).height < 80,
              );
          }
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          await page.screenshot({
            path: `/private/tmp/connector-${slug}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
      }
    }
  });
});

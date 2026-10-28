import "./register-mailing.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import { mailingBrand, mailingExamples } from "../src/showroom/mailing-examples.ts";

const { renderEmail } = await import("../registry/components/plugins/mailing/index.ts");

void test("common mailing examples use the Corner identity and theme without delivery", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Preview must not fetch or send mail"));
  assert.equal(new Set(mailingExamples.map(({ slug }) => slug)).size, mailingExamples.length);
  assert.deepEqual(
    Object.fromEntries(
      ["Account", "Reservations"].map((group) => [
        group,
        mailingExamples.filter((example) => example.group === group).length,
      ]),
    ),
    { Account: 4, Reservations: 6 },
  );
  for (const example of mailingExamples) {
    const logoUrl = "https://registry.the-corner.io/icon.png";
    const email = await renderEmail({ ...example, brand: { ...mailingBrand, logoUrl } });
    for (const value of [example.heading, ...example.paragraphs, example.action.url]) {
      assert.ok(email.html.includes(value), `${example.slug}: HTML contains ${value}`);
      assert.ok(email.text.includes(value), `${example.slug}: text contains ${value}`);
    }
    for (const { label, value } of example.details ?? []) {
      assert.ok(email.html.includes(value));
      assert.ok(email.text.includes(`${label}: ${value}`));
    }
    assert.equal(new URL(example.action.url).origin, "https://example.com");
    assert.ok(email.html.includes("The Corner Factory"));
    assert.ok(email.text.includes("The Corner Factory"));
    assert.ok(email.html.includes(logoUrl));
    assert.match(email.html, /background-color:#ffffff/);
    assert.match(email.html, /color:#000000/);
    assert.match(email.html, /background-color:#13343a/);
    assert.match(email.html, /font-family:Montserrat, Inter,/);
    assert.doesNotMatch(email.html, /Northstar|Pinewood|Your website|<script|rel="stylesheet"/);
  }
});

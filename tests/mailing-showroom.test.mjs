import "./register-mailing.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import { mailingExamples } from "../src/showroom/mailing-examples.ts";

const { renderEmail } = await import("../registry/components/plugins/mailing/index.ts");

void test("common mailing examples render matching HTML and text without delivery", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Preview must not fetch or send mail"));
  assert.equal(new Set(mailingExamples.map(({ slug }) => slug)).size, mailingExamples.length);
  for (const example of mailingExamples) {
    const email = await renderEmail({ ...example, brand: { name: "Your website" } });
    for (const value of [example.heading, ...example.paragraphs, example.action.url]) {
      assert.ok(email.html.includes(value), `${example.slug}: HTML contains ${value}`);
      assert.ok(email.text.includes(value), `${example.slug}: text contains ${value}`);
    }
    for (const { label, value } of example.details ?? []) {
      assert.ok(email.html.includes(value));
      assert.ok(email.text.includes(`${label}: ${value}`));
    }
    assert.equal(new URL(example.action.url).origin, "https://example.com");
    assert.doesNotMatch(email.html, /<img|<script|<link/);
  }
});

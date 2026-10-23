import "./register-mailing.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { renderEmail } = await import("../registry/components/plugins/mailing/index.ts");
import { mailingBrands, mailingExamples } from "../src/showroom/mailing-examples.ts";

const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      })[character],
  );

void test("showroom covers account mail and every reservation event with stable sample URLs", () => {
  assert.deepEqual(
    mailingExamples.map(({ slug }) => slug),
    [
      "verify-email",
      "reset-password",
      "invitation",
      "email-change",
      "reservation-booked",
      "reservation-confirmation",
      "reservation-rescheduled",
      "reservation-rejected",
      "reservation-cancelled",
      "reservation-link",
    ],
  );
  assert.equal(new Set(mailingExamples.map(({ slug }) => slug)).size, 10);
  for (const example of mailingExamples.filter(({ group }) => group === "Account")) {
    assert.match(example.paragraphs.join(" "), /expires in/);
  }
  const booked = mailingExamples.find(({ slug }) => slug === "reservation-booked");
  assert.match(booked.paragraphs.join(" "), /not confirmed yet/);
  assert.ok(booked.details.some(({ value }) => value === "Pending approval"));
  const rescheduled = mailingExamples.find(({ slug }) => slug === "reservation-rescheduled");
  assert.match(rescheduled.paragraphs.join(" "), /16–18 October/);
  assert.ok(rescheduled.details.some(({ value }) => value.startsWith("23 October")));
  const recovered = mailingExamples.find(({ slug }) => slug === "reservation-link");
  assert.match(recovered.paragraphs.join(" "), /does not create a new booking/);
});

void test("every brand renders the same complete sample in HTML and plain text without delivery", async (t) => {
  t.mock.method(globalThis, "fetch", () =>
    assert.fail("Showroom rendering must not fetch or send mail"),
  );
  assert.equal(new Set(Object.values(mailingBrands).map(({ theme }) => theme.primary)).size, 3);
  assert.equal(new Set(Object.values(mailingBrands).map(({ theme }) => theme.fontSerif)).size, 3);
  for (const { logoPath, ...brand } of Object.values(mailingBrands)) {
    const logo = await readFile(new URL("../public" + logoPath, import.meta.url));
    assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    for (const example of mailingExamples) {
      const email = await renderEmail({
        ...example,
        brand: { ...brand, logoUrl: new URL(logoPath, "https://showroom.example.test").href },
      });
      for (const value of [
        brand.name,
        example.heading,
        example.greeting,
        ...example.paragraphs,
        ...(example.details?.flatMap(({ label, value }) => [label, value]) ?? []),
        example.action.label,
        example.footer,
      ]) {
        assert.ok(
          email.html.includes(escape(value)),
          `${example.slug}: HTML must contain ${value}`,
        );
        assert.ok(email.text.includes(value), `${example.slug}: text must contain ${value}`);
      }
      assert.ok(email.html.includes(escape(example.action.url)));
      assert.ok(email.text.includes(example.action.url));
      assert.ok(email.html.includes(brand.theme.primary));
      assert.ok(
        email.html.includes(brand.theme.fontSerif.replaceAll("'", "&#x27;")) ||
          email.html.includes(brand.theme.fontSerif),
      );
      assert.doesNotMatch(email.html, /<script|<link|var\(--/);
    }
  }
});

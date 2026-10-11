import "./register-mailing.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { renderEmail } = await import("../registry/components/plugins/mailing/index.ts");
import { sendResendEmail } from "../registry/components/plugins/mailing/resend.server.ts";

const content = {
  brand: { name: "Family chalet", logoUrl: "https://example.test/icon.png" },
  locale: "fr",
  preview: "Your stay is confirmed",
  heading: "Reservation confirmed",
  greeting: "Hello <script>alert(1)</script>",
  paragraphs: ["See you soon & enjoy your stay."],
  details: [{ label: "Arrival", value: "16 October 2026" }],
  action: { label: "Open calendar", url: "https://example.test/calendar?a=1&b=2#stay" },
  footer: "Keep this email.",
};

void test("renders a complete, escaped email and an equivalent plain-text alternative", async () => {
  const email = await renderEmail(content);
  assert.match(email.html, /<!DOCTYPE html/);
  assert.match(email.html, /<html[^>]*lang="fr"/);
  assert.match(email.html, /<body[^>]*lang="fr"/);
  assert.equal(email.html.match(/<title>/g)?.length, 1);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(email.html, /<script|<link|var\(--|light-dark\(/);
  assert.match(email.html, /a=1&amp;b=2#stay/);
  assert.match(email.html, /scope="row"/);
  for (const value of [
    content.heading,
    content.paragraphs[0],
    "Arrival: 16 October 2026",
    content.action.url,
    content.footer,
  ])
    assert.ok(email.text.includes(value));
  assert.ok(
    (
      await renderEmail({
        ...content,
        brand: { name: "No logo" },
        action: undefined,
        details: undefined,
        footer: undefined,
      })
    ).html,
  );
});

void test("rejects unsafe and relative action and image URLs", async () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "/relative",
    "https://user:secret@example.test",
  ]) {
    await assert.rejects(() => renderEmail({ ...content, action: { label: "Open", url } }));
    await assert.rejects(() => renderEmail({ ...content, brand: { name: "Site", logoUrl: url } }));
  }
});

void test("delivery preserves both versions and idempotency, and reports failures without provider details", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: calls.length === 1 ? 200 : 503 });
  });
  const config = { apiKey: "test-only-key", from: "Chalet <chalet@example.test>" };
  const email = {
    id: "reservation-job-1",
    to: "guest@example.test",
    subject: "Your stay",
    ...(await renderEmail(content)),
  };
  await sendResendEmail(config, email);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].options.headers["Idempotency-Key"], email.id);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    from: config.from,
    to: [email.to],
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  await assert.rejects(sendResendEmail(config, email), /Email delivery failed\./);
  await assert.rejects(sendResendEmail({ ...config, apiKey: "" }, email), /not configured/);
  assert.equal(calls.length, 2);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network unavailable");
  });
  await assert.rejects(sendResendEmail(config, email), /network unavailable/);
});

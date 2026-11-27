import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createServer } from "vite";

await test("Catalog copies, exact line rounding, multi-page A4 PDFs and email attachments", async (t) => {
  const vite = await createServer({
    configFile: false,
    resolve: { tsconfigPaths: true },
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
  });
  t.after(() => vite.close());
  const load = (file) => vite.ssrLoadModule("/registry/components/" + file);
  const { emptyLine, emptyOffer, issueOffer, offerTotals, lineAmounts, recipientAddressLines } =
    await load("plugins/offers/model.ts");
  const { productLine } = await load("connectors/offers-products/index.tsx");
  const { renderOfferPdf } = await load("plugins/offers/pdf/render.server.tsx");
  const { createOfferMailer } = await load("connectors/offers-mailing/server.ts");
  const { sendResendEmail } = await load("plugins/mailing/resend.server.ts");
  const product = { id: "x", name: "Sample", description: "Bound notebook", priceMinor: 149000 };
  const first = { ...productLine(product), taxBps: 810 };
  product.priceMinor = 123;
  product.description = "Changed";
  assert.equal(first.priceMinor, 149000);
  assert.match(first.description, /Bound notebook/);
  const lines = [
    first,
    { ...emptyLine(), description: "Hosting", quantityMilli: 12000, priceMinor: 3900, taxBps: 810 },
    { ...emptyLine(), description: "Included", priceMinor: 1500, taxBps: 810, discountBps: 10000 },
  ];
  assert.deepEqual(offerTotals(lines), {
    net: 195800,
    gross: 211660,
    taxes: [{ rate: 810, amount: 15860 }],
  });
  assert.deepEqual(
    lineAmounts({ ...first, quantityMilli: 1250, priceMinor: 101, discountBps: 2000, taxBps: 500 }),
    { net: 101, tax: 5, gross: 106 },
  );
  const recipient = {
    id: "owner",
    companyName: "Acme Studio",
    name: "Alex",
    email: "alex@example.test",
    street: "Rue du Rhône 10",
    addressComplement: "Second floor",
    city: "Geneva",
  };
  const postalLines = ["Rue du Rhône 10", "Second floor", "Geneva"];
  assert.deepEqual(recipientAddressLines(recipient), ["Acme Studio", ...postalLines]);
  for (const companyName of [undefined, null, "", "  "]) {
    assert.deepEqual(recipientAddressLines({ ...recipient, companyName }), [
      "Alex",
      ...postalLines,
    ]);
  }
  const row = {
    id: "x",
    customerId: "owner",
    currency: "CHF",
    number: 4,
    version: 1,
    draft: {
      ...emptyOffer("2026-11-11"),
      title: "Proposal",
      lines: Array.from({ length: 100 }, (_, i) => ({ ...first, description: "Item " + i })),
    },
  };
  const { issued } = issueOffer(row, recipient, {
    locale: "en-CH",
    issuer: "Studio",
    issuerAddress: "8 Market Street\n1200 Geneva",
    issuedAt: "2026-11-11T10:00:00Z",
    token: "token",
  });
  recipient.city = "Berlin";
  assert.equal(issued.recipient.city, "Geneva");
  assert.equal(issued.issuerAddress, "8 Market Street\n1200 Geneva");
  const logo = await readFile(
    new URL("../public/showroom/offers/sender-logo.png", import.meta.url),
  );
  const bytes = await renderOfferPdf(
    issued,
    undefined,
    "data:image/png;base64," + logo.toString("base64"),
  );
  const pdf = bytes.toString("latin1");
  assert.ok(pdf.startsWith("%PDF-"));
  assert.match(pdf, /\/Subtype \/Image\b/);
  const { issuerAddress: _address, ...legacy } = issued;
  const legacyPdf = await renderOfferPdf({ ...legacy, content: { ...issued.content, lines } });
  assert.doesNotMatch(legacyPdf.toString("latin1"), /\/Subtype \/Image\b/);
  assert.ok(pdf.match(/\/Type \/Page\b/g).length > 1);
  assert.match(pdf, /595\.28/);
  let sent;
  const mail = createOfferMailer({
    brand: { name: "Studio" },
    deliver: async (msg) => {
      sent = msg;
    },
  });
  await mail(issued, bytes);
  assert.equal(sent.id, "offer/token");
  assert.equal(sent.to, "alex@example.test");
  assert.match(sent.text, /#of-4/);
  assert.deepEqual(sent.attachments[0].content, bytes);
  let body;
  t.mock.method(globalThis, "fetch", async (_url, opts) => {
    body = JSON.parse(opts.body);
    return new Response("{}");
  });
  await sendResendEmail({ apiKey: "fixture", from: "staff@example.test" }, sent);
  assert.deepEqual(Buffer.from(body.attachments[0].content, "base64"), bytes);
});

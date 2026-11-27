import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createCustomersSchema } from "../../registry/components/plugins/customers/server/schema.ts";
import { user } from "./auth.schema.fixture.ts";
import { generatedMigration } from "./migrations.mjs";
const { createOffersSchema, createOffersService } =
  await import("../../registry/components/plugins/offers/server/index.ts");
import { emptyOffer, emptyLine } from "../../registry/components/plugins/offers/model.ts";
await test("Offers retain issued terms, restrict customer access and make delivery retryable", async (t) => {
  const ns = "offers_" + randomUUID().replaceAll("-", "");
  const url = "postgres://drive_test:local_drive_test_only@127.0.0.1:55439/drive_test";
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  const pool = postgres(url, { connection: { search_path: ns }, onnotice: () => {} });
  const db = drizzle({ client: pool });
  t.after(async () => {
    await pool.end();
    await admin`drop schema if exists ${admin(ns)} cascade`;
    await admin.end();
  });
  await admin`create schema ${admin(ns)}`;
  const customers = createCustomersSchema(user),
    schema = createOffersSchema(customers);
  for (const statement of await generatedMigration({}, { user, customers, ...schema }))
    await pool.unsafe(statement.replaceAll('"public".', ""));
  for (const id of ["a", "b"]) {
    await db.insert(user).values({ id, name: id, email: id + "@example.test" });
    await db.insert(customers).values({ id, city: "Old address" });
  }
  const sent = [];
  let reject = true;
  const service = createOffersService({
    db,
    schema,
    customers,
    users: user,
    currency: "CHF",
    locale: "en",
    issuer: "Studio",
    issuerAddress: "8 Market Street\n1200 Geneva",
    authorize: async (ctx, action, owner) => ctx === "all" || action === "list" || ctx === owner,
    renderPdf: async (i) => Buffer.from(i.recipient.city + " " + i.content.title),
    sendEmail: async (i, pdf) => {
      if (reject) throw Error("delivery failed");
      sent.push([i.token, pdf.toString()]);
    },
  });
  const staff = service.client("all"),
    limited = service.client("b");
  const input = {
    ...emptyOffer("2026-11-11"),
    title: "Draft",
    lines: [{ ...emptyLine(), description: "Support", priceMinor: 12 }],
  };
  const a = await staff.create("a", input),
    b = await staff.create("b", input);
  assert.notEqual(a.number, b.number);
  for (const search of [String(a.number), `#${a.number}`, `#of-${a.number}`]) {
    assert.deepEqual(
      (await staff.list({ search })).items.map((r) => r.id),
      [a.id],
    );
  }
  assert.deepEqual(
    (await limited.list()).items.map((r) => r.id),
    [b.id],
  );
  assert.equal((await limited.list({ customerId: "a" })).items.length, 0);
  await assert.rejects(limited.get(a.id), /FORBIDDEN/);
  await assert.rejects(limited.issue(a.id, a.version), /FORBIDDEN/);
  await assert.rejects(db.delete(customers).where(eq(customers.id, "a")));
  await db.update(customers).set({ city: "Issue address" }).where(eq(customers.id, "a"));
  const issued = await staff.issue(a.id, a.version);
  assert.equal(issued.issued.recipient.city, "Issue address");
  assert.equal((await staff.get(a.id)).issued.issuerAddress, "8 Market Street\n1200 Geneva");
  await assert.rejects(staff.save(a.id, a.version, input), /CONFLICT/);
  await db.update(customers).set({ city: "New address" }).where(eq(customers.id, "a"));
  const decided = await staff.decide(a.id, issued.version, "accepted");
  const edited = await staff.save(a.id, decided.version, { ...input, title: "Revised" });
  assert.equal(edited.status, "accepted");
  assert.equal(edited.issued.content.title, "Draft");
  assert.equal((await staff.document(a.id)).bytes.toString(), "Issue address Draft");
  await assert.rejects(staff.send(a.id, issued.issued.token), /delivery failed/);
  assert.equal((await staff.get(a.id)).sentAt, null);
  reject = false;
  await Promise.all([staff.send(a.id, issued.issued.token), staff.send(a.id, issued.issued.token)]);
  assert.equal(sent.length, 1);
  assert.ok((await staff.get(a.id)).sentAt);
  const renewed = await staff.issue(a.id, edited.version);
  assert.equal(renewed.number, a.number);
  assert.equal(renewed.status, "pending");
  assert.equal(renewed.sentAt, null);
  assert.equal(renewed.issued.recipient.city, "New address");
  assert.equal((await staff.document(a.id)).bytes.toString(), "New address Revised");
  await assert.rejects(staff.send(a.id, issued.issued.token), /CONFLICT/);
});

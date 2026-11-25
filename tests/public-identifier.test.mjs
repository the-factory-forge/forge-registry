import assert from "node:assert/strict";
import test from "node:test";

import {
  publicRecordPath,
  publicRecordRedirect,
  resolvePublicIdentifier,
  slugify,
} from "../registry/components/utils/public-identifier.ts";

await test("public lookup preserves legacy slug links and falls back to normalized UUIDs", async () => {
  const id = "b1000000-0000-4000-8000-000000000001";
  const current = { id, slug: "notes" };
  const legacy = { id: "b1000000-0000-4000-8000-000000000002", slug: id };
  const records = [current, legacy];
  const find = (field, key) => records.find((row) => row[field] === key);
  assert.equal(await resolvePublicIdentifier(id, find), legacy);
  records.pop();
  for (const key of [id, id.toUpperCase(), "notes"]) {
    assert.equal(await resolvePublicIdentifier(key, find), current);
  }
  assert.equal(await resolvePublicIdentifier("missing", find), null);
  assert.equal(
    await resolvePublicIdentifier("invalid/path", () => assert.fail("invalid lookup")),
    null,
  );
  assert.equal(publicRecordPath("/fr/blogs/", current), "/fr/blogs/notes");
  assert.equal(publicRecordPath("/products", { id }), "/products/" + id);
  assert.equal(publicRecordRedirect("/fr/blogs", id, current), "/fr/blogs/notes");
  assert.equal(publicRecordRedirect("/fr/blogs", "notes", current), null);
  assert.equal(publicRecordRedirect("/products", id, { id }), null);
  assert.equal(slugify("  Idées & pratique  "), "idees-pratique");
  assert.equal(slugify("long name", 5), "long");
});

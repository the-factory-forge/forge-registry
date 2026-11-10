import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  supportCreateSchema,
  supportCommentSchema,
  supportImageType,
  supportQuerySchema,
  supportStatusSchema,
} from "../registry/components/plugins/supports/schema.ts";

const input = {
  requestId: "request",
  title: " Title ",
  description: " **Description** ",
  type: "bug",
  attachmentIds: [],
};
await test("support inputs enforce required fields, enums, bounds and unique attachments", () => {
  assert.equal(supportCreateSchema.parse(input).title, "Title");
  assert.equal(
    supportCreateSchema.parse({ ...input, description: "    code()\n" }).description,
    "    code()\n",
  );
  for (const invalid of [
    { title: " " },
    { description: " " },
    { type: "other" },
    { title: "x".repeat(201) },
    { description: "x".repeat(5001) },
    { attachmentIds: Array(6).fill("image") },
    { attachmentIds: ["same", "same"] },
  ])
    assert.equal(supportCreateSchema.safeParse({ ...input, ...invalid }).success, false);
  assert.equal(
    supportCommentSchema.safeParse({ id: "ticket", requestId: "req", body: " ", attachmentIds: [] })
      .success,
    false,
  );
  assert.equal(
    supportCommentSchema.safeParse({
      id: "ticket",
      requestId: "req",
      body: "",
      attachmentIds: ["image"],
    }).success,
    true,
  );
  assert.deepEqual(supportQuerySchema.parse({}), { search: "", page: 1 });
  assert.equal(supportQuerySchema.safeParse({ page: -1 }).success, false);
  for (const status of ["open", "closed", "canceled"])
    assert.equal(supportStatusSchema.parse(status), status);
  for (const invalid of ["resolved", "cancelled", null, {}, 1])
    assert.equal(supportStatusSchema.safeParse(invalid).success, false);
});
await test("image validation recognizes screenshot formats and rejects executable or mislabeled content", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6f4sAAAAASUVORK5CYII=",
    "base64",
  );
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  assert.equal(supportImageType(png), "image/png");
  assert.equal(supportImageType(gif), "image/gif");
  assert.equal(supportImageType(Buffer.from('<svg onload="alert(1)"/>')), undefined);
  assert.equal(supportImageType(png.subarray(0, 8)), undefined);
});
await test("support distribution owns its dependencies and keeps server imports out of the UI", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const ui = items.find((item) => item.name === "supports");
  assert(ui.dependencies.includes("@tanstack/markdown@0.0.16"));
  for (const file of ui.files)
    assert.doesNotMatch(
      await readFile(file.path, "utf8"),
      /from ["'][^"']*(?:\/server\/|@aws-sdk|drizzle-orm)/,
    );
  const storage = items.find((item) => item.name === "supports-storage");
  assert(storage.registryDependencies.includes("@forge/database"));
  assert(storage.files.some((file) => file.path.endsWith("storage-filename.ts")));
});

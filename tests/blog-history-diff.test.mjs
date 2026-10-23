import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { blogTextDiff } = await import("../registry/components/plugins/blogs/history-diff.ts");
const text = (row) => row.parts.map((part) => part.value).join("");

void test("unified diff highlights only replaced words and keeps unchanged context once", () => {
  const rows = blogTextDiff(
    "Context\n\nUne idée claire.\n\nEnd",
    "Context\n\nUne idée précise.\n\nEnd",
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["context", "removed", "added", "context"],
  );
  assert.equal(
    rows[1].parts
      .filter((part) => part.removed)
      .map((part) => part.value)
      .join(""),
    "claire",
  );
  assert.equal(
    rows[2].parts
      .filter((part) => part.added)
      .map((part) => part.value)
      .join(""),
    "précise",
  );
  assert.equal(rows.filter((row) => text(row) === "Context").length, 1);
});
void test("pure insertions avoid a fake removal or repeated prefix", () => {
  const rows = blogTextDiff("1234567890", "1234567890 XOXOXO");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "added");
  assert.equal(
    rows[0].parts
      .filter((part) => part.added)
      .map((part) => part.value)
      .join("")
      .trim(),
    "XOXOXO",
  );
  assert.equal(text(rows[0]), "1234567890 XOXOXO");
});
void test("deletion, exact text and untrusted markup are returned as text tokens", () => {
  assert.deepEqual(
    blogTextDiff("Stay\n\nRemove", "Stay").map((row) => row.kind),
    ["context", "removed"],
  );
  assert.deepEqual(blogTextDiff("Same", "Same").map(text), ["Same"]);
  assert.equal(text(blogTextDiff("", "<script>alert(1)</script>")[0]), "<script>alert(1)</script>");
});

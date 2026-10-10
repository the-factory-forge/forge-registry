import assert from "node:assert/strict";
import test from "node:test";

import { unzipSync, strFromU8 } from "fflate";

import "./drive-storage/register.mjs";

const { downloadFolder } = await import("../registry/components/plugins/drive/download.ts");
const scope = { type: "project", id: "test" };
const folder = { id: "root", name: "Bills", kind: "folder", state: "ready" };
const file = {
  id: "file",
  name: "résumé.txt",
  kind: "file",
  state: "ready",
  size: 3,
  parentId: "root",
};
const page = (items, nextCursor) => ({
  items,
  nextCursor,
  space: { capabilities: { download: true } },
});
const signal = () => new AbortController().signal;

void test("folder ZIP includes every page, nested bytes and empty folders", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async () => new Response("one"));
  const archive = await downloadFolder(
    {
      async listEntries(input) {
        requests.push([input.parentId, input.cursor]);
        assert.deepEqual(input.scope, scope);
        if (input.parentId === "nested") return page([{ ...file, parentId: "nested" }]);
        if (input.parentId === "empty") return page([]);
        return input.cursor
          ? page([{ ...folder, id: "empty", name: "Empty", parentId: "root" }])
          : page([{ ...folder, id: "nested", name: "2026", parentId: "root" }], "next");
      },
      async getDownload(input) {
        assert.deepEqual(input, { scope, entryId: "file" });
        return { url: "https://storage.example/signed" };
      },
    },
    scope,
    folder,
    signal(),
  );
  assert.equal(archive.type, "application/zip");
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  assert.deepEqual(Object.keys(files), [
    "Bills/",
    "Bills/2026/",
    "Bills/2026/résumé.txt",
    "Bills/Empty/",
  ]);
  assert.equal(strFromU8(files["Bills/2026/résumé.txt"]), "one");
  assert.deepEqual(requests, [
    ["root", undefined],
    ["nested", undefined],
    ["root", "next"],
    ["empty", undefined],
  ]);
});

void test("folder downloads reject denied reads, corrupt trees, unsafe paths and metadata limits", async () => {
  for (const [result, code] of [
    [{ ...page([]), space: { capabilities: { download: false } } }, "FORBIDDEN"],
    [page([{ ...file, name: "../escape" }]), "INVALID"],
    [page([{ ...file, size: 100_000_001 }]), "DOWNLOAD_LIMIT"],
    [page([{ ...file, parentId: "other" }]), "CONFLICT"],
    [page([{ ...file, state: "deleting" }]), "CONFLICT"],
    [page([file, { ...file, id: "duplicate-name" }]), "CONFLICT"],
    [page([{ ...folder, parentId: "root" }]), "CONFLICT"],
    [
      page(Array.from({ length: 1000 }, (_, id) => ({ ...file, id: `${id}`, name: `${id}` }))),
      "DOWNLOAD_LIMIT",
    ],
    [page([], "repeated"), "CONFLICT"],
  ]) {
    await assert.rejects(
      downloadFolder(
        {
          async listEntries() {
            return result;
          },
          async getDownload() {
            assert.fail("No file should be fetched before validation succeeds");
          },
        },
        scope,
        folder,
        signal(),
      ),
      { code },
    );
  }
});

void test("folder downloads fail without a partial archive on unsafe URLs, storage failures and revoked access", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  for (const [url, code] of [
    ["javascript:alert(1)", "INVALID"],
    ["https://storage.example/file", "STORAGE"],
  ]) {
    await assert.rejects(
      downloadFolder(
        {
          async listEntries() {
            return page([file]);
          },
          async getDownload() {
            return { url };
          },
        },
        scope,
        folder,
        signal(),
      ),
      { code },
    );
  }
  await assert.rejects(
    downloadFolder(
      {
        async listEntries() {
          return page([file]);
        },
        async getDownload() {
          throw Object.assign(new Error(), { code: "FORBIDDEN" });
        },
      },
      scope,
      folder,
      signal(),
    ),
    { code: "FORBIDDEN" },
  );
});

void test("folder download limits actual streamed bytes and respects cancellation", async (t) => {
  let cancelled = false;
  const chunk = new Uint8Array(10_000_000);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  const client = {
    async listEntries() {
      return page([file]);
    },
    async getDownload() {
      return { url: "https://storage.example/file" };
    },
  };
  await assert.rejects(downloadFolder(client, scope, folder, signal()), { code: "DOWNLOAD_LIMIT" });
  assert.equal(cancelled, true);
  await assert.rejects(downloadFolder(client, scope, folder, AbortSignal.abort()), {
    name: "AbortError",
  });
});

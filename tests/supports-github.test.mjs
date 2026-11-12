import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createGithubClient,
  SupportsGithubError,
  fromGithubStatus,
  toGithubStatus,
} from "../registry/components/connectors/supports-github/server/github.server.ts";
import {
  sourceMarkdown,
  IMPORT_LIMIT,
} from "../registry/components/connectors/supports-github/server/markdown.ts";
import { githubMock } from "./supports-github/github-mock.mjs";

await test("forwarded Markdown retains mentions and code but replaces images, HTML and signed references", () => {
  const source = "https://github.com/sample/website/issues/1";
  const converted = sourceMarkdown(
    "Hello @maintainer\n\n**Details** and `@code`\n\n![screen](https://example.test/private?token=secret)\n\n[relative](../blob/main/README.md)\n\n<script>alert(1)</script>\n\n```js\nconst x = '<img>';\n```",
    source,
  );
  assert.match(converted, /Hello @maintainer/);
  assert.match(converted, /\*\*Details\*\*/);
  assert.match(converted, /image not copied/);
  assert.match(converted, /https:\/\/github.com\/sample\/website\/blob\/main\/README.md/);
  assert.doesNotMatch(converted, /token=secret|!\[|<script>/);
  assert.match(converted, /const x = '<img>'/);
  assert.equal(IMPORT_LIMIT, 65536);
});
await test("status mapping preserves cancellation and supports reopening", () => {
  assert.equal(fromGithubStatus({ state: "open" }), "open");
  for (const reason of ["duplicate", "not_planned"])
    assert.equal(fromGithubStatus({ state: "closed", state_reason: reason }), "canceled");
  assert.equal(fromGithubStatus({ state: "closed", state_reason: null }), "closed");
  assert.deepEqual(toGithubStatus("canceled"), { state: "closed", state_reason: "not_planned" });
  assert.deepEqual(toGithubStatus("open"), { state: "open", state_reason: "reopened" });
});
await test("GitHub adapter refuses public repositories, redacts errors, and identifies uncertain writes", async () => {
  const mock = githubMock();
  const client = createGithubClient({ ...mock, getAccessToken: async () => "secret-token" });
  await client.verify();
  mock.settings.private = false;
  await assert.rejects(client.verify(), (error) => error.code === "REPOSITORY");
  mock.settings.private = true;
  mock.settings.lose = "create";
  await assert.rejects(
    client.create("Title", "Body"),
    (error) =>
      error instanceof SupportsGithubError && error.uncertain && !error.message.includes("secret"),
  );
  assert.equal(mock.issues.length, 1);
  mock.settings.fail = "create";
  await assert.rejects(client.create("Title", "Body"), (error) => !error.uncertain);
  assert(mock.calls.every((call) => call.headers.Authorization === "Bearer secret-token"));
});
await test("support GitHub source is distributed without reversing the base plugin dependency", async () => {
  const { items } = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const ui = items.find((item) => item.name === "supports-github");
  const server = items.find((item) => item.name === "supports-github-server");
  assert(ui && server);
  assert(server.registryDependencies.includes("@forge/supports-storage"));
  assert(
    !items
      .find((item) => item.name === "supports")
      .registryDependencies.includes("@forge/supports-github"),
  );
  for (const file of ui.files)
    assert.doesNotMatch(
      await readFile(file.path, "utf8"),
      /from ["'][^"']*(?:\/server\/|drizzle-orm|node:crypto)/,
    );
});

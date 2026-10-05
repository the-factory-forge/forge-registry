import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("pre-commit requires staged registry source and current generated files", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "forge-registry-hook-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
  const runGit = (...args) => {
    const result = git(...args);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
  };
  const write = (path, content) => writeFileSync(join(cwd, path), content);
  const commit = () => git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "test");
  const blocked = (message) => {
    const index = runGit("write-tree");
    const result = commit();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, message);
    assert.equal(runGit("write-tree"), index, "the hook must not stage files");
  };
  const passes = () => {
    const result = commit();
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };

  runGit("init", "--quiet");
  runGit("config", "user.name", "Hook test");
  runGit("config", "user.email", "hook@example.test");
  runGit("config", "core.hooksPath", fileURLToPath(new URL("../.githooks", import.meta.url)));
  mkdirSync(join(cwd, "registry"));
  mkdirSync(join(cwd, "public/r"), { recursive: true });
  write(
    "package.json",
    JSON.stringify({
      private: true,
      scripts: {
        "registry:sync":
          "node -e \"require('node:fs').copyFileSync('registry/item.txt', 'public/r/item.json')\"",
      },
    }),
  );
  write("registry/item.txt", "original\n");
  write("public/r/item.json", "original\n");
  runGit("add", ".");
  passes();

  // Do not build from unstaged source or silently include a new source file.
  write("registry/item.txt", "updated\n");
  blocked(/stage or stash all registry/);
  assert.equal(readFileSync(join(cwd, "public/r/item.json"), "utf8"), "original\n");
  runGit("add", "registry/item.txt");
  write("registry/new.txt", "new\n");
  blocked(/stage or stash all registry/);
  runGit("add", "registry/new.txt");

  // Rebuild stale output, then allow it once reviewed and staged.
  blocked(/git add public\/r/);
  assert.equal(readFileSync(join(cwd, "public/r/item.json"), "utf8"), "updated\n");
  runGit("add", "public/r");
  passes();

  // A clean working tree can still contain stale staged output.
  write("public/r/item.json", "stale\n");
  runGit("add", "public/r");
  blocked(/generated registry files differ/);
  runGit("add", "public/r");
  passes();

  // git diff alone cannot detect a generated file missing from the index.
  runGit("rm", "--cached", "public/r/item.json");
  blocked(/public\/r\/item.json/);
  runGit("add", "public/r");
  passes();

  write("package.json", JSON.stringify({ scripts: { "registry:sync": "exit 1" } }));
  runGit("add", "package.json");
  blocked(/pnpm registry:sync failed/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { projectLabels } from "../registry/components/plugins/projects/labels.ts";
import {
  projectFormValues,
  safeProjectUrl,
  validateProject,
} from "../registry/components/plugins/projects/utils.ts";

test("project forms submit only the basic fields and validate their limits", () => {
  const project = {
    id: "project",
    name: " Project ",
    status: "production",
    description: null,
    ownerId: "existing",
    url: "https://example.com",
    assigneeId: "employee",
  };
  const values = projectFormValues(project);
  assert.deepEqual(values, { name: " Project ", status: "production", description: "" });
  assert.deepEqual(validateProject(values, projectLabels), {});
  assert.deepEqual(projectFormValues(), { name: "", status: "requested", description: "" });
  assert.ok(validateProject({ ...values, name: "  " }, projectLabels).name);
  assert.ok(validateProject({ ...values, status: "unknown" }, projectLabels).status);
  assert.ok(
    validateProject({ ...values, description: "a".repeat(5001) }, projectLabels).description,
  );
  assert.equal(
    validateProject({ ...values, description: "a".repeat(5000) }, projectLabels).description,
    undefined,
  );
});

test("website links permit HTTP(S) and local paths without unsafe redirects", () => {
  for (const value of [
    "https://example.com",
    "http://localhost:3000/a?b=c#d",
    "/",
    "/portfolio/demo",
    "/path?q=hello%20world",
  ])
    assert.equal(safeProjectUrl(value), value);
  assert.equal(safeProjectUrl(" https://example.com "), "https://example.com");
  for (const value of [
    "",
    null,
    "javascript:alert(1)",
    "data:text/html,foo",
    "ftp://example.com",
    "//example.com",
    "/\\example.com",
    "https:/example.com",
    "https://",
    "https://user:pass@example.com",
    "https://example.com/\nfoo",
    "/\t/example.com",
    "/path with spaces",
    "/" + "a".repeat(2048),
  ])
    assert.equal(safeProjectUrl(value), undefined, String(value));
});

test("projects installs customers without creating a reverse dependency or framework coupling", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  const item = manifest.items.find((entry) => entry.name === "projects");
  assert.equal(item.type, "registry:block");
  assert.deepEqual(item.registryDependencies, [
    "@forge/customers",
    "@forge/cn",
    "@forge/ui-shims",
    "@forge/table-styles",
    "@forge/table-search",
    "@forge/native-select",
    "@forge/action-toast",
    "@forge/optimistic-action",
    "@forge/icon-tooltip",
    "@forge/editor-form",
  ]);
  assert.deepEqual(item.dependencies, ["@base-ui/react", "lucide-react"]);
  const customersItem = manifest.items.find((entry) => entry.name === "customers");
  assert.ok(!customersItem.registryDependencies.includes("@forge/projects"));
  const shipped = [...item.files, ...customersItem.files];
  for (const file of item.files) {
    const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
    assert.equal(file.target, file.path.replace("registry/components/", "@components/"));
    assert.doesNotMatch(source, /from ["'](?:next|@tanstack|@\/lib\/|@\/showroom\/)/);
    assert.doesNotMatch(source, /GitHub|googleAnalytics|lighthouse|ImageUp|CameraIcon/);
    for (const [, dependency] of source.matchAll(/from "(@\/components\/plugins\/[^";]+)"/g)) {
      const path = dependency.replace("@/components/", "registry/components/");
      assert.ok(
        shipped.some(
          (entry) =>
            entry.path.replace(/\/index\.tsx$|\.tsx?$/g, "") === path ||
            entry.path.replace(/\.tsx?$/, "") === path,
        ),
        dependency,
      );
    }
  }
  for (const file of customersItem.files)
    assert.doesNotMatch(
      await readFile(new URL(`../${file.path}`, import.meta.url), "utf8"),
      /plugins\/projects/,
    );
});

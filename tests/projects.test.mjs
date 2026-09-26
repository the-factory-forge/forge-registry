import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { projectLabels } from "../registry/components/plugins/projects/labels.ts";
import {
  projectFormValues,
  safeProjectUrl,
  validateProject,
} from "../registry/components/plugins/projects/utils.ts";

const customers = [{ id: "customer", name: "Alex", email: "", emailVerified: false }];
const assignees = [{ id: "employee", name: "Jordan" }];

test("project forms require an existing customer and preserve optional fields", () => {
  const values = { ...projectFormValues(undefined, "customer"), name: " Project " };
  assert.deepEqual(validateProject(values, customers, assignees, projectLabels), {});
  assert.equal(projectFormValues().status, "requested");
  assert.equal(
    projectFormValues(
      { ...values, ownerId: "existing", description: null, url: null, assigneeId: null },
      "different",
    ).ownerId,
    "existing",
  );
  for (const ownerId of ["", "   ", "missing"])
    assert.ok(validateProject({ ...values, ownerId }, customers, assignees, projectLabels).ownerId);
  assert.ok(validateProject(values, [], assignees, projectLabels).ownerId);
  assert.ok(validateProject({ ...values, name: "  " }, customers, assignees, projectLabels).name);
  assert.ok(
    validateProject({ ...values, assigneeId: "missing" }, customers, assignees, projectLabels)
      .assigneeId,
  );
  assert.deepEqual(
    validateProject({ ...values, assigneeId: "employee" }, customers, assignees, projectLabels),
    {},
  );
  assert.ok(
    validateProject({ ...values, status: "unknown" }, customers, assignees, projectLabels).status,
  );
  assert.ok(
    validateProject(
      { ...values, description: "a".repeat(5001) },
      customers,
      assignees,
      projectLabels,
    ).description,
  );
  assert.equal(
    validateProject(
      { ...values, description: "a".repeat(5000) },
      customers,
      assignees,
      projectLabels,
    ).description,
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

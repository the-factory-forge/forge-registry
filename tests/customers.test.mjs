import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  customerDisplayName,
  customerInitials,
  customerFormValues,
} from "../registry/components/plugins/customers/utils.ts";

await test("customer names, initials, and nullable profile fields retain TC behavior", () => {
  const customer = {
    id: "1",
    name: "Alex Morgan",
    email: "alex@example.com",
    emailVerified: false,
    companyName: " Acme Studio ",
    street: null,
  };
  assert.equal(customerDisplayName(customer), "Acme Studio");
  assert.equal(customerDisplayName({ ...customer, companyName: " " }), "Alex Morgan");
  assert.equal(customerInitials("  Acme   Studio ", ""), "AS");
  assert.equal(customerInitials("", "alex@example.com"), "AL");
  assert.equal(customerInitials("", ""), "?");
  assert.equal(customerFormValues(customer).street, "");
  assert.deepEqual(
    Object.keys(customerFormValues()).sort(),
    ["addressComplement", "city", "companyName", "email", "name", "phoneNumber", "street"].sort(),
  );
});

await test("customers retains its dependencies and contains no website integrations", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  const item = manifest.items.find((entry) => entry.name === "customers");
  assert.deepEqual(item.registryDependencies, [
    "@forge/cn",
    "@forge/ui-shims",
    "@forge/table-styles",
    "@forge/table-search",
    "@forge/action-toast",
    "@forge/optimistic-action",
    "@forge/icon-tooltip",
    "@forge/editor-form",
    "@forge/dropdown-menu",
    "@forge/table-selection",
    "@forge/record-deletion",
    "@forge/loading-indicator",
  ]);
  for (const file of item.files) {
    const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']@tanstack\//);
    assert.doesNotMatch(source, /Bexio|AccountInvitation/);
  }
});

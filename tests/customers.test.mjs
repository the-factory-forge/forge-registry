import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  customerDisplayName,
  customerInitials,
  customerFormValues,
  generateCustomerPassword,
} from "../registry/components/plugins/customers/utils.ts";

test("customer names, initials, and nullable profile fields retain TC behavior", () => {
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

test("generated passwords respect bounds and include all four character groups", () => {
  const generated = new Set();
  for (let i = 0; i < 30; i++) {
    const password = generateCustomerPassword();
    assert.equal(password.length, 20);
    for (const group of [/[a-z]/, /[A-Z]/, /[0-9]/, /[!@#$%^&*()\-_=+]/])
      assert.match(password, group);
    generated.add(password);
  }
  assert.equal(generated.size, 30);
  assert.equal(generateCustomerPassword(24, 30).length, 24);
  assert.equal(generateCustomerPassword(12, 12).length, 12);
  for (const bounds of [
    [0, 12],
    [20, 12],
    [1.5, 12],
    [12, 1025],
  ])
    assert.throws(() => generateCustomerPassword(...bounds), RangeError);
});

test("customers distribution is complete and contains no website integrations", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  const item = manifest.items.find((entry) => entry.name === "customers");
  assert.deepEqual(item.registryDependencies, ["@forge/cn", "@forge/ui-shims"]);
  for (const file of item.files) {
    const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
    assert.equal(file.target, file.path.replace("registry/components/", "@components/"));
    assert.doesNotMatch(source, /from ["'](?:next|@tanstack|@\/lib\/|@\/showroom\/)/);
    assert.doesNotMatch(source, /Bexio|AccountInvitation/);
    for (const [, dependency] of source.matchAll(
      /from "(@\/components\/plugins\/customers\/[^";]+)"/g,
    )) {
      assert.ok(
        item.files.some(
          (entry) =>
            entry.path.replace(/\.tsx?$/, "") ===
            dependency.replace("@/components/", "registry/components/"),
        ),
        dependency,
      );
    }
  }
});

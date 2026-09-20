import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const { createEmployeeService } =
  await import("../registry/components/plugins/employees/server/employees.server.ts");

const admin = { id: "admin", role: "admin", mustChangePassword: false };
function fixture(options = {}) {
  let employee = {
    id: "employee",
    name: "Alex",
    email: "alex@example.test",
    role: "user",
    emailVerified: true,
  };
  const calls = [];
  const api = {
    listUsers: async (input) => {
      calls.push(["list", input]);
      return { users: [employee], total: 1 };
    },
    createUser: async (input) => {
      calls.push(["create", input]);
      return { user: { ...employee, ...input.body } };
    },
    getUser: async (input) => {
      calls.push(["get", input]);
      return employee;
    },
    adminUpdateUser: async (input) => {
      calls.push(["update", input]);
      employee = { ...employee, ...input.body.data };
      return employee;
    },
    banUser: async (input) => {
      calls.push(["ban", input]);
      return { user: { ...employee, banned: true } };
    },
    unbanUser: async (input) => {
      calls.push(["unban", input]);
      return { user: { ...employee, banned: false } };
    },
    removeUser: async (input) => {
      calls.push(["remove", input]);
      return { success: true };
    },
    sendVerificationEmail: async (input) => {
      calls.push(["send", input]);
      return { status: true };
    },
  };
  const headers = new Headers({ cookie: "administrator-session" });
  return {
    calls,
    headers,
    service: createEmployeeService({
      api,
      headers,
      actor: admin,
      verificationEnabled: true,
      ...options,
    }),
  };
}

test("employee operations require a fresh eligible administrator supplied by the host", () => {
  for (const actor of [
    null,
    { id: "user", role: "user" },
    { ...admin, banned: true },
    { ...admin, mustChangePassword: true },
  ]) {
    assert.throws(() => fixture({ actor }), /Administrator access required/);
  }
  assert.doesNotThrow(() => fixture({ actor: { ...admin, role: "user,admin" } }));
});

test("creation validates credentials and requires a first-login password change", async () => {
  const { service, calls, headers } = fixture();
  await assert.rejects(() =>
    service.create({ name: " ", email: "bad", password: "short", role: "admin" }),
  );
  assert.deepEqual(calls, []);
  const created = await service.create({
    name: " Alex ",
    email: "alex@example.test",
    password: "Temporary-password-123",
    role: "user",
  });
  assert.equal(created.name, "Alex");
  assert.equal(calls[0][1].body.data.mustChangePassword, true);
  assert.equal(calls[0][1].headers, headers);
  assert.throws(() => service.list({ offset: -1 }));
  assert.deepEqual(await service.list({ offset: 25 }), {
    users: [
      {
        id: "employee",
        name: "Alex",
        email: "alex@example.test",
        role: "user",
        emailVerified: true,
      },
    ],
    total: 1,
  });
});

test("editing protects the current administrator and resets verification only for a new address", async () => {
  const { service, calls } = fixture();
  await assert.rejects(
    () => service.update({ id: "admin", name: "Admin", email: "admin@example.test", role: "user" }),
    /own administrator/,
  );
  assert.deepEqual(calls, []);
  const unchanged = await service.update({
    id: "employee",
    name: "New name",
    email: "ALEX@example.test",
    role: "admin",
  });
  assert.equal(unchanged.emailVerified, true);
  assert.equal(unchanged.email, "alex@example.test");
  const changed = await service.update({
    id: "employee",
    name: "New name",
    email: "new@example.test",
    role: "user",
  });
  assert.equal(changed.emailVerified, false);
  assert.equal(changed.role, "user");
});

test("verification sends only to the authorized recipient without forwarding administrator cookies", async () => {
  const { service, calls } = fixture();
  const callbackURL = "https://site.example/fr/login";
  assert.deepEqual(await service.sendVerification({ id: "employee" }, callbackURL), {
    status: "verified",
  });
  assert.equal(calls.filter(([name]) => name === "send").length, 0);
  await service.update({
    id: "employee",
    name: "Alex",
    email: "changed@example.test",
    role: "user",
  });
  assert.deepEqual(
    await service.sendVerification({ id: "employee", email: "injected@example.test" }, callbackURL),
    { status: "sent" },
  );
  assert.deepEqual(calls.at(-1), [
    "send",
    { body: { email: "changed@example.test", callbackURL } },
  ]);
  const unavailable = fixture({ verificationEnabled: false });
  await unavailable.service.update({
    id: "employee",
    name: "Alex",
    email: "changed@example.test",
    role: "user",
  });
  assert.deepEqual(await unavailable.service.sendVerification({ id: "employee" }, callbackURL), {
    status: "unavailable",
  });
  assert.equal(unavailable.calls.filter(([name]) => name === "send").length, 0);
});

test("access changes and deletion use native auth operations with the authenticated request", async () => {
  const { service, calls, headers } = fixture();
  assert.equal((await service.setBan({ id: "employee", banned: true })).banned, true);
  assert.equal((await service.setBan({ id: "employee", banned: false })).banned, false);
  assert.deepEqual(await service.remove({ id: "employee" }), { success: true });
  for (const [index, name] of ["ban", "unban", "remove"].entries()) {
    assert.equal(calls[index][0], name);
    assert.deepEqual(calls[index][1], { headers, body: { userId: "employee" } });
  }
});

test("login and employees ship complete independent source without host configuration", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  for (const name of ["login", "employees", "employees-server"]) {
    const item = manifest.items.find((item) => item.name === name);
    const published = JSON.parse(
      await readFile(new URL(`../public/r/${name}.json`, import.meta.url), "utf8"),
    );
    for (const file of item.files) {
      const source = await readFile(new URL(`../${file.path}`, import.meta.url), "utf8");
      assert.equal(published.files.find((entry) => entry.path === file.path).content, source);
      assert.doesNotMatch(
        source,
        /from ["'](?:next|@tanstack\/react-(?:start|router)|@\/lib\/|@\/showroom\/|varlock)/,
      );
      assert.doesNotMatch(source, /process\.env|ENV\.|SITE_NAME|SITE_LOGO/);
      if (name !== "employees-server") assert.doesNotMatch(source, /from ["'][^"']*\/server\//);
    }
  }
});

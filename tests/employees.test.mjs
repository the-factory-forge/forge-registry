import "./drive-storage/register.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const { createEmployeeService } =
  await import("../registry/components/plugins/employees/server/employees.server.ts");

const admin = { id: "admin", role: "admin", mustChangePassword: false };
function fixture({ employee: overrides, failInvitation = false, ...options } = {}) {
  let employee = {
    id: "employee",
    name: "Alex",
    email: "alex@example.test",
    role: "user",
    emailVerified: true,
    websitePublished: true,
    ...overrides,
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
      sendInvitation: async (employee, invitationURL) => {
        calls.push(["invite", { email: employee.email, invitationURL }]);
        if (failInvitation) throw new Error("Delivery failed");
      },
      ...options,
    }),
  };
}

await test("employee operations require a fresh eligible administrator supplied by the host", () => {
  for (const actor of [
    null,
    { id: "no-role" },
    { id: "user", role: "user" },
    { id: "similar-role", role: "superadmin" },
    { ...admin, banned: true },
    { ...admin, mustChangePassword: true },
  ]) {
    assert.throws(() => fixture({ actor }), /Administrator access required/);
  }
  assert.doesNotThrow(() => fixture({ actor: { ...admin, role: "user,admin" } }));
});

await test("creation strips supplied passwords and invites the new account without credentials", async () => {
  const { service, calls, headers } = fixture();
  await assert.rejects(() =>
    service.create({ name: " ", email: "bad", password: "short", role: "admin" }),
  );
  assert.deepEqual(calls, []);
  const created = await service.create(
    {
      name: " Alex ",
      email: "alex@example.test",
      password: "Temporary-password-123",
      role: "user",
    },
    "https://site.example/fr/reset-password?invitation=true",
  );
  assert.equal(created.user.name, "Alex");
  assert.equal(created.invitationSent, true);
  assert.equal("password" in calls[0][1].body, false);
  assert.deepEqual(calls[1], [
    "invite",
    {
      email: "alex@example.test",
      invitationURL: "https://site.example/fr/reset-password?invitation=true",
    },
  ]);
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
        websitePublished: true,
      },
    ],
    total: 1,
  });
});

await test("editing protects the current administrator and resets verification only for a new address", async () => {
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
    websitePublished: false,
  });
  assert.equal(unchanged.emailVerified, true);
  assert.equal(unchanged.websitePublished, true);
  assert.equal(
    "websitePublished" in calls.find(([action]) => action === "update")[1].body.data,
    false,
  );
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

await test("verification sends only to the authorized recipient without forwarding administrator cookies", async () => {
  const { service, calls } = fixture();
  const callbackURL = "https://site.example/fr/login";
  assert.deepEqual(
    await service.sendVerification(
      { id: "employee" },
      callbackURL,
      "https://site.example/fr/reset-password?invitation=true",
    ),
    {
      status: "verified",
    },
  );
  assert.equal(calls.filter(([name]) => name === "send").length, 0);
  await service.update({
    id: "employee",
    name: "Alex",
    email: "changed@example.test",
    role: "user",
  });
  assert.deepEqual(
    await service.sendVerification(
      { id: "employee", email: "injected@example.test" },
      callbackURL,
      "https://site.example/fr/reset-password?invitation=true",
    ),
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
  assert.deepEqual(
    await unavailable.service.sendVerification(
      { id: "employee" },
      callbackURL,
      "https://site.example/fr/reset-password?invitation=true",
    ),
    {
      status: "unavailable",
    },
  );
  assert.equal(unavailable.calls.filter(([name]) => name === "send").length, 0);
});

await test("access changes and deletion use native auth operations with the authenticated request", async () => {
  const { service, calls, headers } = fixture();
  assert.equal((await service.setBan({ id: "employee", banned: true })).banned, true);
  assert.equal((await service.setBan({ id: "employee", banned: false })).banned, false);
  assert.deepEqual(await service.remove({ id: "employee" }), { success: true });
  for (const [index, name] of ["ban", "unban", "remove"].entries()) {
    assert.equal(calls[index][0], name);
    assert.deepEqual(calls[index][1], { headers, body: { userId: "employee" } });
  }
});

await test("auth and employees ship complete independent source without host configuration", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../registry/registry.json", import.meta.url), "utf8"),
  );
  for (const name of ["auth", "employees", "employees-server"]) {
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

const invitationURL = "https://site.example/fr/reset-password?invitation=true";
await test("invitation delivery failures preserve the new account and expose a retryable result", async () => {
  const { service, calls } = fixture({ failInvitation: true });
  const result = await service.create({ name: "Alex", email: "alex@example.test" }, invitationURL);
  assert.equal(result.invitationSent, false);
  assert.equal(result.user.id, "employee");
  assert.equal(
    calls.some(([action]) => action === "remove"),
    false,
  );
  const unavailable = fixture({ verificationEnabled: false });
  await assert.rejects(
    () => unavailable.service.create({ name: "Alex", email: "alex@example.test" }, invitationURL),
    /not configured/,
  );
  assert.deepEqual(unavailable.calls, []);
});
await test("pending accounts receive invitations rather than verification emails", async () => {
  const { service, calls } = fixture({ employee: { mustChangePassword: true } });
  assert.deepEqual(
    await service.sendVerification(
      { id: "employee", email: "injected@example.test" },
      "https://site.example/fr/login",
      invitationURL,
    ),
    { status: "sent" },
  );
  assert.deepEqual(
    calls.filter(([action]) => action !== "get"),
    [["invite", { email: "alex@example.test", invitationURL }]],
  );
  const blocked = fixture({ employee: { banned: true, mustChangePassword: true } });
  await assert.rejects(
    () =>
      blocked.service.sendVerification(
        { id: "employee" },
        "https://site.example/fr/login",
        invitationURL,
      ),
    /disabled/,
  );
  assert.equal(
    blocked.calls.some(([action]) => action === "invite"),
    false,
  );
});

import "../drive-storage/register.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { hashPassword } from "better-auth/crypto";
import { and, count, eq, notExists } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { createAuth } from "./auth.fixture.ts";
import { generatedMigration } from "./migrations.mjs";
import * as schema from "./schema.ts";
const { createCustomersService } =
  await import("../../registry/components/plugins/customers/server/index.ts");
const { createProjectsService } =
  await import("../../registry/components/plugins/projects/server/index.ts");
const { createEmployeeService } =
  await import("../../registry/components/plugins/employees/server/employees.server.ts");
import { assertMigrationsApplied } from "../../registry/components/utils/database-migrations.ts";
import { lockPlugin } from "../../registry/components/utils/database.ts";

const rejected = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const input = (email, name = "Customer") => ({
  name,
  email,
  companyName: "Acme",
  phoneNumber: "",
  street: "",
  city: "",
  addressComplement: "",
});

await test("composed migrations, Better Auth customers, employee membership and project ownership", async (t) => {
  const namespace = `persistence_${randomUUID().replaceAll("-", "")}`;
  const connection = "postgres://drive_test:local_drive_test_only@127.0.0.1:55439/drive_test";
  const root = postgres(connection, { max: 1, onnotice: () => {} });
  const pool = postgres(connection, {
    max: 8,
    connection: { search_path: namespace },
    onnotice: () => {},
  });
  const db = drizzle({ client: pool, relations: schema.authRelations });
  const folder = await mkdtemp(join(tmpdir(), "forge-migrations-"));
  t.after(async () => {
    await pool.end();
    await root`drop schema if exists ${root(namespace)} cascade`;
    await root.end();
    await rm(folder, { recursive: true, force: true });
  });
  await root`create schema ${root(namespace)}`;
  const migration = await generatedMigration({}, schema);
  await mkdir(join(folder, "20261023000000_composed"));
  await writeFile(
    join(folder, "20261023000000_composed", "migration.sql"),
    migration.map((sql) => sql.replaceAll('"public".', "")).join("\n--> statement-breakpoint\n"),
  );
  await migrate(db, { migrationsFolder: folder, migrationsSchema: namespace });
  await assertMigrationsApplied(db, { migrationsFolder: folder, migrationsSchema: namespace });
  assert.deepEqual(await generatedMigration(schema, schema), []);
  await db.insert(schema.user).values({
    id: "admin",
    name: "Admin",
    email: "admin@example.test",
    emailVerified: true,
    role: "admin",
  });
  const password = await hashPassword("disposable-local-password");
  await db.insert(schema.account).values({
    id: "credential",
    accountId: "admin",
    providerId: "credential",
    userId: "admin",
    password,
    updatedAt: new Date(),
  });
  const auth = createAuth(db);
  const response = await auth.api.signInEmail({
    body: { email: "admin@example.test", password: "disposable-local-password" },
    asResponse: true,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; "),
  });
  const before = {
    users: await db.select().from(schema.user),
    accounts: await db.select().from(schema.account),
    sessions: await db.select().from(schema.session),
  };
  await migrate(db, { migrationsFolder: folder, migrationsSchema: namespace });
  assert.deepEqual(await db.select().from(schema.user), before.users);
  assert.deepEqual(await db.select().from(schema.account), before.accounts);
  assert.deepEqual(await db.select().from(schema.session), before.sessions);
  assert.equal((await auth.api.getSession({ headers })).user.id, "admin");

  let deliveryFails = false;
  const deliveries = [];
  const options = {
    db,
    users: schema.user,
    customers: schema.customers,
    authForTransaction: (tx) => createAuth(tx).api,
    headers: () => headers,
    authorize: async (actor) => actor === "admin",
    sendInvitation: async (_, customer) => {
      // The separate connection must see both rows: delivery happens after commit.
      assert.equal(
        (await db.select().from(schema.customers).where(eq(schema.customers.id, customer.id)))
          .length,
        1,
      );
      if (deliveryFails) throw new Error("Provider unavailable");
      deliveries.push(customer.email);
    },
  };
  const customers = createCustomersService(options).client("admin");
  await rejected(createCustomersService(options).client("guest").list(), "FORBIDDEN");
  await rejected(customers.create(input("")), "INVALID");
  await rejected(customers.create(input("invalid")), "INVALID");
  await rejected(customers.create(input("ADMIN@example.test")), "CONFLICT");
  const created = await customers.create(input(" Customer@Example.test "));
  assert.equal(created.invitationSent, true);
  const customer = created.customer;
  assert.equal(customer.email, "customer@example.test");
  const [identity] = await db.select().from(schema.user).where(eq(schema.user.id, customer.id));
  assert.equal(identity.role, "user");
  assert.equal(identity.mustChangePassword, true);
  assert.equal(
    (await db.select().from(schema.account).where(eq(schema.account.userId, customer.id))).length,
    0,
  );
  await rejected(customers.create(input("CUSTOMER@example.test")), "CONFLICT");
  const competing = await Promise.allSettled([
    customers.create(input("unique@example.test")),
    customers.create(input("unique@example.test")),
  ]);
  assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(competing.find((result) => result.status === "rejected").reason.code, "CONFLICT");
  deliveryFails = true;
  const recoverable = await customers.create(input("retry@example.test"));
  assert.equal(recoverable.invitationSent, false);
  assert.equal((await customers.get(recoverable.customer.id)).email, "retry@example.test");
  deliveryFails = false;
  // Recovery also works after losing the creation response or restarting the host.
  const restarted = createCustomersService(options).client("admin");
  const recovered = await restarted.list({ search: "retry@example.test" });
  assert.equal(recovered.items.length, 1);
  assert.equal(recovered.items[0].id, recoverable.customer.id);
  await rejected(restarted.create(input("retry@example.test")), "CONFLICT");
  assert.equal((await restarted.resendInvitation(recovered.items[0].id)).invitationSent, true);

  const failingDb = {
    select: db.select.bind(db),
    insert: db.insert.bind(db),
    update: db.update.bind(db),
    delete: db.delete.bind(db),
    transaction: (callback) =>
      db.transaction(async (tx) => {
        await callback(tx);
        throw new Error("Commit rejected");
      }),
  };
  const failing = createCustomersService({ ...options, db: failingDb }).client("admin");
  await rejected(failing.create(input("rollback@example.test")), "STORAGE");
  assert.equal(
    (await db.select().from(schema.user).where(eq(schema.user.email, "rollback@example.test")))
      .length,
    0,
  );
  assert.ok(!deliveries.includes("rollback@example.test"));
  await db.insert(schema.verification).values({
    id: "invitation",
    identifier: "reset-password:existing",
    value: customer.id,
    expiresAt: new Date(Date.now() + 60000),
  });
  await t.test("profile-only edits preserve pending invitations and identity", async () => {
    await db
      .update(schema.user)
      .set({ email: customer.email.toUpperCase() })
      .where(eq(schema.user.id, customer.id));
    const [before] = await db.select().from(schema.user).where(eq(schema.user.id, customer.id));
    await customers.update(customer.id, { ...input(customer.email), street: "Updated address" });
    assert.equal((await customers.get(customer.id)).street, "Updated address");
    assert.deepEqual(
      (await db.select().from(schema.user).where(eq(schema.user.id, customer.id)))[0],
      before,
    );
    assert.equal(
      (await db.select().from(schema.verification).where(eq(schema.verification.id, "invitation")))
        .length,
      1,
    );
    await db
      .update(schema.user)
      .set({ email: customer.email })
      .where(eq(schema.user.id, customer.id));
  });
  await rejected(failing.update(customer.id, input("changed@example.test", "Changed")), "STORAGE");
  assert.equal((await customers.get(customer.id)).email, customer.email);
  assert.equal(
    (await db.select().from(schema.verification).where(eq(schema.verification.id, "invitation")))
      .length,
    1,
  );
  await customers.setVerified(customer.id, true);
  assert.equal((await customers.get(customer.id)).emailVerified, true);
  await customers.update(customer.id, input("changed@example.test", "Changed"));
  assert.equal((await customers.get(customer.id)).emailVerified, false);
  assert.equal(
    (await db.select().from(schema.verification).where(eq(schema.verification.id, "invitation")))
      .length,
    0,
  );

  const employee = notExists(
    db.select().from(schema.customers).where(eq(schema.customers.id, schema.user.id)),
  );
  const directory = {
    async contains(id) {
      return (
        (
          await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(and(eq(schema.user.id, id), employee))
        ).length > 0
      );
    },
    async list(offset, limit) {
      const users = await db
        .select()
        .from(schema.user)
        .where(employee)
        .orderBy(schema.user.name, schema.user.id)
        .offset(offset)
        .limit(limit);
      const [total] = await db.select({ total: count() }).from(schema.user).where(employee);
      return { users, total: total.total };
    },
  };
  const employees = createEmployeeService({
    api: auth.api,
    headers,
    actor: { id: "admin", role: "admin" },
    directory,
    verificationEnabled: true,
    sendInvitation: async () => {},
  });
  assert.deepEqual(
    (await employees.list({})).users.map((user) => user.id),
    ["admin"],
  );
  for (const operation of [
    () => employees.setBan({ id: customer.id, banned: true }),
    () => employees.update({ id: customer.id, name: "No", email: customer.email, role: "admin" }),
    () => employees.remove({ id: customer.id }),
    () => employees.sendVerification({ id: customer.id }, "/", "/"),
  ])
    await assert.rejects(operation, /Employee access/);
  const customerActor = createEmployeeService({
    api: auth.api,
    headers,
    actor: { id: customer.id, role: "admin" },
    directory,
    verificationEnabled: true,
    sendInvitation: async () => {},
  });
  await assert.rejects(customerActor.list({}), /Employee access/);

  const projects = createProjectsService({
    db,
    projects: schema.projects,
    authorize: async (actor, _, ownerId) => actor === "admin" || actor === ownerId,
  });
  const project = await projects.client("admin").create(customer.id, {
    name: "Website",
    description: "Scope",
    ownerId: "attacker",
    url: "ignored",
  });
  assert.equal(project.ownerId, customer.id);
  await db
    .update(schema.projects)
    .set({
      url: "https://example.test",
      posterImage: "site/projects/poster.png",
      assigneeId: "admin",
    })
    .where(eq(schema.projects.id, project.id));
  await rejected(
    projects.client("other").update(project.id, { name: "No", description: "" }),
    "FORBIDDEN",
  );
  const edited = await projects.client(customer.id).update(project.id, {
    name: "Updated",
    description: "Changed",
    status: "production",
    ownerId: recoverable.customer.id,
    url: "overwrite",
  });
  assert.equal(edited.ownerId, customer.id);
  assert.equal(edited.url, "https://example.test");
  assert.equal(edited.posterImage, "site/projects/poster.png");
  assert.equal(edited.assigneeId, "admin");
  await rejected(customers.remove(customer.id), "IN_USE");
  assert.ok(await customers.get(customer.id));
  await assert.rejects(
    db.delete(schema.customers).where(eq(schema.customers.id, customer.id)),
    (error) => ["23503", "23001"].includes(error.cause?.code),
  );
  await projects.client("admin").remove(project.id);
  await customers.remove(customer.id);
  await rejected(customers.get(customer.id), "NOT_FOUND");

  await t.test(
    "customer and project pages bound reads and authorization, including empty pages",
    async () => {
      const ids = Array.from(
        { length: 123 },
        (_, index) => `page-customer-${String(index).padStart(3, "0")}`,
      );
      await db.insert(schema.user).values(
        ids.map((id) => ({
          id,
          name: `Paging ${id}`,
          email: `${id}@example.test`,
          role: "user",
        })),
      );
      await db.insert(schema.customers).values(ids.map((id) => ({ id })));
      let checked = 0;
      const paged = createCustomersService({
        ...options,
        authorize: async (_, action, id) => {
          if (action !== "read" || id === undefined) return true;
          checked++;
          return ids.indexOf(id) >= 50;
        },
      }).client("admin");
      const first = await paged.list({ search: "Paging" });
      assert.deepEqual(first, { items: [], nextCursor: "50" });
      assert.equal(checked, 50);
      const second = await paged.list({ search: "Paging", cursor: first.nextCursor });
      assert.equal(second.items.length, 50);
      assert.equal(checked, 100);
      const third = await paged.list({ search: "Paging", cursor: second.nextCursor });
      assert.deepEqual(
        [...second.items, ...third.items].map((row) => row.id),
        ids.slice(50),
      );
      assert.equal(third.nextCursor, undefined);
      assert.equal(checked, 123);
      for (const query of [
        { pageSize: 0 },
        { pageSize: 101 },
        { pageSize: 1.5 },
        { cursor: "-1" },
        { cursor: "1e3" },
        { cursor: "9007199254740991" },
        { search: "x".repeat(251) },
      ]) {
        await rejected(paged.list(query), "INVALID");
      }

      const ownerId = ids[0];
      await db.insert(schema.projects).values(
        ids.map((id, index) => ({
          id: `project-${id}`,
          ownerId,
          name: `Paging ${String(index).padStart(3, "0")}`,
        })),
      );
      checked = 0;
      const projectPages = createProjectsService({
        db,
        projects: schema.projects,
        authorize: async (_, action, owner, id) => {
          if (owner !== ownerId) return false;
          if (action !== "read" || id === undefined) return true;
          checked++;
          return id !== `project-${ids[0]}`;
        },
      }).client("admin");
      const empty = await projectPages.list(ownerId, { pageSize: 1 });
      assert.deepEqual(empty, { items: [], nextCursor: "1" });
      assert.equal(checked, 1);
      const page = await projectPages.list(ownerId, { cursor: empty.nextCursor, pageSize: 100 });
      assert.equal(page.items.length, 100);
      assert.equal(checked, 101);
      const last = await projectPages.list(ownerId, { cursor: page.nextCursor, pageSize: 100 });
      assert.deepEqual(
        [...page.items, ...last.items].map((row) => row.id),
        ids.slice(1).map((id) => `project-${id}`),
      );
      assert.equal(last.nextCursor, undefined);
      await rejected(projectPages.list(ids[1]), "FORBIDDEN");
      await rejected(projectPages.list(ownerId, { pageSize: 101 }), "INVALID");
      await rejected(projectPages.list(ownerId, { cursor: "bad" }), "INVALID");
      assert.deepEqual((await projectPages.list(ownerId, { search: "%_" })).items, []);
    },
  );

  await t.test("named locks serialize independent connections and survive rollback", async () => {
    let release;
    let entered;
    const acquired = new Promise((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const first = db.transaction(async (tx) => {
      await lockPlugin(tx, "concurrent-test");
      entered();
      await blocked;
    });
    await acquired;
    let secondEntered = false;
    const second = db.transaction(async (tx) => {
      await lockPlugin(tx, "concurrent-test");
      secondEntered = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(secondEntered, false);
    release();
    await Promise.all([first, second]);
    await assert.rejects(
      db.transaction(async (tx) => {
        await lockPlugin(tx, "concurrent-test");
        throw new Error("rollback");
      }),
      /rollback/,
    );
    await db.transaction((tx) => lockPlugin(tx, "concurrent-test"));
    assert.equal(
      (
        await db
          .select()
          .from(schema.pluginLocks)
          .where(eq(schema.pluginLocks.key, "concurrent-test"))
      ).length,
      1,
    );
  });
});

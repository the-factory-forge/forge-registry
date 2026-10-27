import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";

import type { BlogsDatabase } from "../../registry/components/plugins/blogs/server/types.ts";
import { createCustomersService } from "../../registry/components/plugins/customers/server/index.ts";
import type {
  DriveDatabase,
  DriveTransaction,
} from "../../registry/components/plugins/drive/server/types.ts";
import { createEmployeeService } from "../../registry/components/plugins/employees/server/employees.server.ts";
import { createProjectsService } from "../../registry/components/plugins/projects/server/index.ts";
import { createAuth } from "./auth.fixture.ts";
import * as schema from "./schema.ts";

// Compiled by tsc, never executed. The host has auth relations and arbitrary additional tables.
export async function checkHostTypes() {
  const db = drizzle({ connection: "postgres://unused", relations: schema.authRelations });
  const drive: DriveDatabase = db;
  const blogs: BlogsDatabase = db;
  const customers = createCustomersService({
    db,
    users: schema.user,
    customers: schema.customers,
    authForTransaction: (tx) => createAuth(tx).api,
    headers: () => new Headers(),
    authorize: async () => true,
    sendInvitation: async () => {},
  });
  const projects = createProjectsService({
    db,
    projects: schema.projects,
    authorize: async () => true,
  });
  const customerPage = await customers.client(undefined).list({ pageSize: 25 });
  const projectPage = await projects
    .client(undefined)
    .list("customer", { cursor: customerPage.nextCursor });
  const names: string[] = projectPage.items.map((project) => project.name);
  // @ts-expect-error Directory reads use bounded query objects, not an unpaged search string.
  void customers.client(undefined).list("all");
  createEmployeeService({
    api: createAuth(db).api,
    headers: new Headers(),
    actor: null,
    verificationEnabled: false,
    sendInvitation: async () => {},
  });
  await db.transaction(async (tx) => {
    const shared: DriveTransaction = tx;
    await shared.select().from(schema.user).where(eq(schema.user.id, "host-user"));
    await shared
      .insert(schema.projects)
      .values({ id: "p", ownerId: "customer", name: "Project", status: "requested" });
    // @ts-expect-error Project ownership is required by the composed schema.
    shared.insert(schema.projects).values({ id: "missing-owner", name: "Project" });
    // @ts-expect-error Status remains inferred from the table, including for host transactions.
    shared.update(schema.projects).set({ status: "arbitrary" });
    // @ts-expect-error Callbacks cannot fall back to untyped runtime SQL.
    shared.execute("select 1");
  });
  return { drive, blogs, customers, names };
}

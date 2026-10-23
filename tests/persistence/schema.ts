export * from "./auth.schema.fixture.ts";
export * from "./agent-key.schema.fixture.ts";
export * from "../../registry/components/plugins/drive/server/schema.ts";
export * from "../../registry/components/plugins/blogs/server/schema.ts";
export * from "../../registry/components/plugins/menus/server/schema.ts";
export * from "../../registry/components/plugins/reservations/server/schema.ts";
export { pluginLocks } from "../../registry/components/utils/database.ts";
import { createCustomersSchema } from "../../registry/components/plugins/customers/server/schema.ts";
import { createProjectsSchema } from "../../registry/components/plugins/projects/server/schema.ts";
import { user } from "./auth.schema.fixture.ts";

export const customers = createCustomersSchema(user);
export const projects = createProjectsSchema(customers);

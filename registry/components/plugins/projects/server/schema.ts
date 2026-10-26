import { sql } from "drizzle-orm";
import { check, index, pgTable, text } from "drizzle-orm/pg-core";

import type { CustomersSchema } from "@/components/plugins/customers/server/schema";
import type { ProjectStatus } from "@/components/plugins/projects/types";

export function createProjectsSchema(customers: CustomersSchema) {
  return pgTable(
    "project",
    {
      id: text("id").primaryKey(),
      ownerId: text("owner_id")
        .notNull()
        .references(() => customers.id, { onDelete: "restrict" }),
      name: text("name").notNull(),
      status: text("status").$type<ProjectStatus>().notNull().default("requested"),
      description: text("description"),
      // Retain legacy data without inviting a destructive host migration.
      url: text("url"),
      posterImage: text("poster_image"),
      assigneeId: text("assignee_id"),
    },
    (t) => [
      index("project_owner").on(t.ownerId),
      check(
        "project_status",
        sql`${t.status} in ('requested', 'prospect', 'under-construction', 'production')`,
      ),
    ],
  );
}
export type ProjectsSchema = ReturnType<typeof createProjectsSchema>;
export type ProjectRecord = ProjectsSchema["$inferSelect"];

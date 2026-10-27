import { randomUUID } from "node:crypto";

import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import type { ProjectsSchema } from "@/components/plugins/projects/server/schema";
import {
  containsPattern,
  directoryQuerySchema,
  type DirectoryQuery,
  type PluginDatabase,
} from "@/components/utils/database";

const idSchema = z.string().min(1).max(250);
export const projectStatusSchema = z.enum([
  "requested",
  "prospect",
  "under-construction",
  "production",
]);
export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  status: projectStatusSchema.default("requested"),
  description: z
    .string()
    .trim()
    .max(5000)
    .transform((value) => value || null),
});
export type ProjectsAction = "read" | "create" | "edit" | "delete";
export class ProjectsError extends Error {
  code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "IN_USE" | "STORAGE";
  constructor(code: ProjectsError["code"]) {
    super(code);
    this.code = code;
  }
}
export interface ProjectsServiceOptions<Context> {
  db: PluginDatabase;
  projects: ProjectsSchema;
  /** Authorize the persisted owner; a browser-supplied owner ID never establishes access. */
  authorize(
    this: void,
    context: Context,
    action: ProjectsAction,
    ownerId: string,
    projectId?: string,
  ): Promise<boolean>;
}
export function createProjectsService<Context>({
  db,
  projects,
  authorize,
}: ProjectsServiceOptions<Context>) {
  async function guard<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ProjectsError) throw error;
      if (error instanceof z.ZodError) throw new ProjectsError("INVALID");
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        ["23503", "23001"].includes(String(cause.code))
      )
        throw new ProjectsError("IN_USE");
      throw new ProjectsError("STORAGE");
    }
  }
  async function permit(context: Context, action: ProjectsAction, ownerId: string, id?: string) {
    idSchema.parse(ownerId);
    if (!(await authorize(context, action, ownerId, id))) throw new ProjectsError("FORBIDDEN");
  }
  function client(context: Context) {
    async function mutate(
      id: string,
      action: "edit" | "delete",
      values?: Partial<typeof projects.$inferInsert>,
    ) {
      idSchema.parse(id);
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
        if (!row) throw new ProjectsError("NOT_FOUND");
        await permit(context, action, row.ownerId, row.id);
        if (action === "delete") {
          await tx.delete(projects).where(eq(projects.id, id));
          return row;
        }
        const [updated] = await tx
          .update(projects)
          .set(values!)
          .where(eq(projects.id, id))
          .returning();
        return updated;
      });
    }
    return {
      list: (ownerId: string, input: DirectoryQuery = {}) =>
        guard(async () => {
          await permit(context, "read", ownerId);
          const { search, pageSize, cursor } = directoryQuerySchema.parse(input);
          const pattern = containsPattern(search);
          const rows = await db
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.ownerId, ownerId),
                or(ilike(projects.name, pattern), ilike(projects.description, pattern)),
              ),
            )
            .orderBy(projects.name, projects.id)
            .offset(cursor)
            .limit(pageSize + 1);
          const allowed: typeof rows = [];
          for (const row of rows.slice(0, pageSize))
            if (await authorize(context, "read", row.ownerId, row.id)) allowed.push(row);
          return {
            items: allowed,
            nextCursor: rows.length > pageSize ? String(cursor + pageSize) : undefined,
          };
        }),
      get: (id: string) =>
        guard(async () => {
          idSchema.parse(id);
          const [row] = await db.select().from(projects).where(eq(projects.id, id));
          if (!row) throw new ProjectsError("NOT_FOUND");
          await permit(context, "read", row.ownerId, row.id);
          return row;
        }),
      create: (ownerId: string, input: unknown) =>
        guard(async () => {
          const value = projectInputSchema.parse(input);
          await permit(context, "create", ownerId);
          const [row] = await db
            .insert(projects)
            .values({ ...value, id: randomUUID(), ownerId })
            .returning();
          return row;
        }),
      update: (id: string, input: unknown) =>
        guard(() => mutate(id, "edit", projectInputSchema.parse(input))),
      setStatus: (id: string, status: unknown) =>
        guard(() => mutate(id, "edit", { status: projectStatusSchema.parse(status) })),
      remove: (id: string) =>
        guard(async () => {
          await mutate(id, "delete");
        }),
    };
  }
  return { client };
}

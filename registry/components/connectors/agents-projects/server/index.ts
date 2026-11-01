import { z } from "zod";

import {
  agentId,
  agentRecord,
  agentTools,
  agentOperation,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import {
  createProjectsService,
  projectInputSchema,
  projectStatusSchema,
} from "@/components/plugins/projects/server/service.server";
import { directoryQuerySchema } from "@/components/utils/database";

type Client<Context> = ReturnType<ReturnType<typeof createProjectsService<Context>>["client"]>;
export function createProjectsAgentOperation<Context>(
  options: AgentConnectorOptions<Context, Client<Context>>,
) {
  const { read, write } = agentTools<Context>();
  const values = projectInputSchema.extend({ description: z.string().trim().max(5000) });
  const query = directoryQuerySchema.extend({
    cursor: z
      .string()
      .regex(/^(0|[1-9]\d*)$/)
      .max(16)
      .optional(),
  });
  const before = (c: Context, i: { id: string }) => options.client(c).get(i.id);
  return agentOperation("projects", "Projects", options.authorize, [
    read("projects_list", z.object({ ownerId: agentId, query }), (c, i) =>
      options.client(c).list(i.ownerId, i.query),
    ),
    read("projects_get", agentRecord, (c, i) => options.client(c).get(i.id)),
    write("projects_create", z.object({ ownerId: agentId, values }), {
      before: async () => null,
      run: (c, i) => options.client(c).create(i.ownerId, i.values),
    }),
    write("projects_update", agentRecord.extend({ values }), {
      before,
      run: (c, i) => options.client(c).update(i.id, i.values),
    }),
    write("projects_set_status", agentRecord.extend({ status: projectStatusSchema }), {
      before,
      run: (c, i) => options.client(c).setStatus(i.id, i.status),
    }),
    write("projects_delete", agentRecord, {
      before,
      run: (c, i) => options.client(c).remove(i.id),
      effects: ["Deletes the project. Related host records can prevent deletion."],
    }),
  ]);
}

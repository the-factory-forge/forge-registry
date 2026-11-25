import { z } from "zod";

import {
  agentFile,
  agentId,
  agentOperation,
  agentTools,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { AgentsError } from "@/components/plugins/agents/types";
import {
  supportCreateSchema,
  supportCommentInputSchema,
  supportIdSchema,
  supportQuerySchema,
  supportPrioritySchema,
  supportStatusSchema,
} from "@/components/plugins/supports/schema";
import type { SupportsClient } from "@/components/plugins/supports/types";

/** Staff membership and attachment ownership remain enforced by the Supports client. */
export function createSupportsAgentOperation<Context>(
  options: AgentConnectorOptions<Context, SupportsClient>,
) {
  const { read, write } = agentTools<Context>();
  const record = z.object({ id: supportIdSchema });
  const before = (context: Context, input: { id: string }) => options.client(context).get(input.id);
  return agentOperation("supports", "Supports", options.authorize, [
    read("supports_list", supportQuerySchema, (c, i) => options.client(c).list(i)),
    read("supports_get", record.extend({ cursor: supportIdSchema.optional() }), (c, i) =>
      options.client(c).get(i.id, i.cursor),
    ),
    write("supports_create", supportCreateSchema.omit({ requestId: true }), {
      before: async () => null,
      run: (c, i, _files, requestId) => options.client(c).create({ ...i, requestId }),
      effects: ["Creates a ticket visible to the website's staff."],
    }),
    write("supports_comment", supportCommentInputSchema, {
      before,
      run: (c, i, _files, requestId) => options.client(c).comment({ ...i, requestId }),
      effects: ["Adds a comment visible to the website's staff."],
    }),
    write("supports_set_status", record.extend({ status: supportStatusSchema }), {
      before,
      run: (c, i) => options.client(c).setStatus(i.id, i.status),
    }),
    {
      ...write(
        "supports_set_priority",
        record.extend({ priority: supportPrioritySchema.nullable() }),
        {
          before: async (c, i) => (await before(c, i)).ticket,
          run: (c, i) => {
            const client = options.client(c);
            if (!client.setPriority) throw new AgentsError("FORBIDDEN");
            return client.setPriority(i.id, i.priority);
          },
        },
      ),
      authorize: async (c) => !!options.client(c).setPriority,
    },
    write("supports_upload", z.object({ attachmentId: agentId }), {
      before: async () => null,
      attachments: (i) => [i.attachmentId],
      run: async (c, i, files, requestId) =>
        options.client(c).upload({ requestId, file: await agentFile(files, i.attachmentId) }),
      effects: [
        "Uploads a private image. Attach its returned ID when creating a ticket or comment.",
      ],
    }),
    write("supports_cancel_upload", record, {
      before: async () => null,
      run: (c, i) => options.client(c).cancelUpload(i.id),
      effects: ["Removes your unclaimed upload; attached images cannot be removed."],
    }),
  ]);
}

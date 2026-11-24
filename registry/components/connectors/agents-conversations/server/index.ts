import { z } from "zod";

import {
  agentFile,
  agentId,
  agentOperation,
  agentTools,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { AgentsError, type AgentsClient } from "@/components/plugins/agents/types";

export interface AgentConversationsOptions<Context> extends AgentConnectorOptions<
  Context,
  AgentsClient
> {
  /** Intersect the caller's grant scopes with current access to the target operation. */
  authorizeOperation(
    context: Context,
    operationId: string,
    kind: "read" | "write",
  ): Promise<boolean>;
}

/** The host must narrow chat access to the current connection's target-operation scopes. */
export function createAgentConversationsOperation<Context>(
  options: AgentConversationsOptions<Context>,
) {
  const { read, write } = agentTools<Context>();
  const conversation = z.object({ conversationId: agentId });
  const decision = conversation.extend({ actionId: agentId, approve: z.boolean() });
  async function permit(c: Context, operationId: string, kind: "read" | "write") {
    if (
      !(await options.authorizeOperation(c, operationId, "read")) ||
      (kind === "write" && !(await options.authorizeOperation(c, operationId, "write")))
    )
      throw new AgentsError("FORBIDDEN");
  }
  async function chat(c: Context, id: string, kind: "read" | "write") {
    const result = await options.client(c).get(id);
    await permit(c, result.operationId, kind);
    return result;
  }
  const before = (c: Context, i: { conversationId: string }) => chat(c, i.conversationId, "write");
  return agentOperation("agents", "Agents", options.authorize, [
    read("conversations_operations", z.object({}), async (c) => {
      const operations = await options.client(c).operations();
      const allowed = await Promise.all(
        operations.map((op) => options.authorizeOperation(c, op.id, "read")),
      );
      return operations.filter((_op, index) => allowed[index]);
    }),
    read("conversations_list", z.object({ operationId: agentId }), async (c, i) => {
      await permit(c, i.operationId, "read");
      return options.client(c).list(i.operationId);
    }),
    read("conversations_get", conversation, (c, i) => chat(c, i.conversationId, "read")),
    write("conversations_create", z.object({ operationId: agentId }), {
      before: async (c, i) => {
        await permit(c, i.operationId, "write");
        return null;
      },
      run: async (c, i) => {
        await permit(c, i.operationId, "write");
        return options.client(c).create(i.operationId);
      },
    }),
    write("conversations_remove", conversation, {
      before,
      run: async (c, i) => {
        await before(c, i);
        return options.client(c).remove(i.conversationId);
      },
      effects: ["Deletes your conversation and its private attachments."],
    }),
    write(
      "conversations_send",
      conversation.extend({
        text: z.string().trim().min(1).max(32000),
        attachmentIds: z.array(agentId).max(10).default([]),
      }),
      {
        before,
        async run(c, i, _files, requestId) {
          await before(c, i);
          for await (const _event of options
            .client(c)
            .send({ ...i, requestId }, AbortSignal.timeout(120000))) {
            /* consume the existing runtime */
          }
          return options.client(c).get(i.conversationId);
        },
        effects: [
          "Sends this message to the website's configured model and may incur provider usage. Proposed business changes still require approval.",
        ],
      },
    ),
    {
      name: "conversations_decide",
      description: "Review the stored business change, then approve or reject it.",
      kind: "write",
      schema: decision,
      async prepare(c, raw) {
        const input = decision.parse(raw);
        const chat = await before(c, input);
        const action = chat.actions.find((item) => item.id === input.actionId);
        if (!action) throw new AgentsError("NOT_FOUND");
        return {
          preview: {
            ...action.preview,
            title: `${input.approve ? "Approve" : "Reject"}: ${action.preview.title}`,
            attachmentIds: [],
            changes: [
              ...action.preview.changes,
              ...(action.preview.attachmentIds ?? []).map((id) => ({
                label: "Attachment",
                after:
                  chat.messages
                    .flatMap((message) => message.attachments)
                    .find((file) => file.id === id)?.name ?? id,
              })),
            ],
            effects: input.approve
              ? action.preview.effects
              : ["Rejects this proposal without changing business data."],
          },
          snapshot: action,
        };
      },
      run: async (c, raw) => {
        const input = decision.parse(raw);
        await before(c, input);
        return options.client(c).decide(input);
      },
    },
    write("conversations_attach", conversation.extend({ attachmentId: agentId }), {
      before,
      attachments: (i) => [i.attachmentId],
      run: async (c, i, files) => {
        await before(c, i);
        return options.client(c).attach(i.conversationId, await agentFile(files, i.attachmentId));
      },
      effects: [
        "Adds a private file to your conversation; sending it to the model is a separate action.",
      ],
    }),
  ]);
}

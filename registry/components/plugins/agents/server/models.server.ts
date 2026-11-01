import { z } from "zod";

import type { AgentRuntime } from "@/components/plugins/agents/server/types";
import { AgentsError, type AgentModelProvider } from "@/components/plugins/agents/types";

const origins = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com",
};
export const modelCredentials = z.object({
  provider: z.enum(["openai", "anthropic", "deepseek"]),
  token: z.string().trim().min(1).max(4096).regex(/^\S+$/).optional(),
});
export const modelSelection = modelCredentials.extend({
  model: z.string().trim().min(1).max(256).regex(/^\S+$/),
});
export type ModelConnection = z.infer<typeof modelSelection> & { token: string };

async function request(
  provider: AgentModelProvider,
  token: string,
  path: string,
  signal: AbortSignal,
  body?: unknown,
) {
  const response = await fetch(`${origins[provider]}${path}`, {
    method: body ? "POST" : "GET",
    redirect: "error",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(provider === "anthropic"
        ? { "x-api-key": token, "anthropic-version": "2023-06-01" }
        : { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new AgentsError("RUNTIME");
  }
  return response;
}

const modelList = z.object({
  data: z.array(z.object({ id: z.string(), display_name: z.string().optional() })),
  has_more: z.boolean().optional(),
  last_id: z.string().nullable().optional(),
});
export async function listAgentModels(provider: AgentModelProvider, token: string) {
  const signal = AbortSignal.timeout(15000);
  const models = [];
  let after = "";
  for (let page = 0; page < 20; page++) {
    const path =
      provider === "anthropic"
        ? `/models?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ""}`
        : "/models";
    const result = modelList.parse(await (await request(provider, token, path, signal)).json());
    models.push(
      ...result.data.map((model) => ({ id: model.id, label: model.display_name ?? model.id })),
    );
    if (!result.has_more) return models.sort((a, b) => a.label.localeCompare(b.label));
    if (!result.last_id || result.last_id === after) throw new AgentsError("RUNTIME");
    after = result.last_id;
  }
  throw new AgentsError("LIMIT");
}

// Provider events may split UTF-8 characters and SSE lines across network chunks.
async function* events(response: Response) {
  if (!response.body) throw new AgentsError("RUNTIME");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let eventSize = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length + eventSize > 1024 * 1024) throw new AgentsError("LIMIT");
      let end;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (data.length) {
            const payload = data.join("\n");
            data = [];
            eventSize = 0;
            if (payload === "[DONE]") return;
            yield JSON.parse(payload) as unknown;
          }
        } else if (line.startsWith("data:")) {
          const part = line.slice(5).replace(/^ /, "");
          data.push(part);
          eventSize += part.length;
        }
      }
    }
    if (buffer.trim() || data.length) throw new AgentsError("RUNTIME");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

const completion = z.object({
  choices: z.array(
    z.object({
      finish_reason: z.string().nullable().optional(),
      delta: z.object({
        content: z.string().nullable().optional(),
        tool_calls: z
          .array(
            z.object({
              index: z.number().int(),
              id: z.string().optional(),
              function: z
                .object({ name: z.string().optional(), arguments: z.string().optional() })
                .optional(),
            }),
          )
          .optional(),
      }),
    }),
  ),
});
const anthropicEvent = z.object({
  type: z.string(),
  index: z.number().int().optional(),
  content_block: z
    .object({ type: z.string(), id: z.string().optional(), name: z.string().optional() })
    .optional(),
  delta: z
    .object({
      text: z.string().optional(),
      partial_json: z.string().optional(),
      stop_reason: z.string().nullable().optional(),
    })
    .optional(),
});

export async function* streamAgentModel(
  connection: ModelConnection,
  input: Parameters<AgentRuntime["stream"]>[0],
): ReturnType<AgentRuntime["stream"]> {
  const { provider, model, token } = connection;
  const claude = provider === "anthropic";
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(90000)]);
  const messages: unknown[] = [];
  for (const entry of input.messages) {
    if (entry.role === "tool" && entry.tool) {
      const { callId, name, input: args } = entry.tool;
      messages.push(
        ...(claude
          ? [
              { role: "assistant", content: [{ type: "tool_use", id: callId, name, input: args }] },
              {
                role: "user",
                content: [{ type: "tool_result", tool_use_id: callId, content: entry.text }],
              },
            ]
          : [
              {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: callId,
                    type: "function",
                    function: { name, arguments: JSON.stringify(args) },
                  },
                ],
              },
              { role: "tool", tool_call_id: callId, content: entry.text },
            ]),
      );
    } else {
      messages.push({
        role: entry.role === "assistant" ? "assistant" : "user",
        content:
          entry.text +
          (entry.attachments.length ? `\nAttachments: ${JSON.stringify(entry.attachments)}` : ""),
      });
    }
  }
  const tools = input.tools.map((tool) =>
    claude
      ? { name: tool.name, description: tool.description, input_schema: tool.inputSchema }
      : {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
            strict: false,
          },
        },
  );
  const body = {
    model,
    stream: true,
    messages: claude ? messages : [{ role: "system", content: input.instructions }, ...messages],
    ...(claude
      ? { system: input.instructions, max_tokens: 4096 }
      : provider === "deepseek"
        ? { max_tokens: 4096 }
        : { max_completion_tokens: 4096 }),
    ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
    ...(tools.length
      ? {
          tools,
          ...(claude
            ? { tool_choice: { type: "auto", disable_parallel_tool_use: true } }
            : { parallel_tool_calls: false }),
        }
      : {}),
  };
  let call: { id: string; name: string; args: string; index: number } | null = null;
  let finished = false;
  let reason: string | null = null;
  try {
    const response = await request(
      provider,
      token,
      claude ? "/messages" : "/chat/completions",
      signal,
      body,
    );
    for await (const raw of events(response)) {
      signal.throwIfAborted();
      if (claude) {
        const event = anthropicEvent.parse(raw);
        if (event.type === "error") throw new AgentsError("RUNTIME");
        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          if (
            call ||
            !event.content_block.id ||
            !event.content_block.name ||
            event.index === undefined
          )
            throw new AgentsError("RUNTIME");
          call = {
            id: event.content_block.id,
            name: event.content_block.name,
            args: "",
            index: event.index,
          };
        }
        if (event.delta?.text) yield { type: "text", text: event.delta.text };
        if (event.delta?.partial_json) {
          if (!call || event.index !== call.index) throw new AgentsError("RUNTIME");
          call.args += event.delta.partial_json;
        }
        if (event.delta?.stop_reason) reason = event.delta.stop_reason;
        if (event.type === "message_stop") finished = true;
      } else {
        const event = completion.parse(raw);
        const choice = event.choices[0];
        if (choice?.delta.content) yield { type: "text", text: choice.delta.content };
        for (const tool of choice?.delta.tool_calls ?? []) {
          call ??= { id: "", name: "", args: "", index: tool.index };
          if (tool.index !== call.index) throw new AgentsError("RUNTIME");
          call.id += tool.id ?? "";
          call.name += tool.function?.name ?? "";
          call.args += tool.function?.arguments ?? "";
        }
        if (choice?.finish_reason) {
          reason = choice.finish_reason;
          finished = true;
        }
      }
      if (call && call.args.length > 1024 * 1024) throw new AgentsError("LIMIT");
    }
    if (!finished || !["stop", "end_turn", "tool_calls", "tool_use"].includes(reason ?? ""))
      throw new AgentsError("RUNTIME");
    if (call) {
      if (!call.id || !call.name || !["tool_calls", "tool_use"].includes(reason!))
        throw new AgentsError("RUNTIME");
      yield {
        type: "tool",
        callId: call.id,
        name: call.name,
        input: JSON.parse(call.args || "{}") as unknown,
      };
    }
  } catch {
    throw new AgentsError("RUNTIME");
  }
}

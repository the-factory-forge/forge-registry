import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import {
  AgentsWebMcp,
  getWebMcpContext,
  type AgentsWebMcpClient,
} from "@/components/connectors/agents-webmcp";
import { NativeSelect } from "@/components/native-select";
import { AgentsError } from "@/components/plugins/agents/types";
import { createAgentsMock } from "@/showroom/agents-mock";
import { ShowroomIntro, ShowroomPreview } from "@/showroom/showroom-preview";

const input = z
  .object({ name: z.string().trim().min(1).max(200), requestId: z.string().min(1).max(250) })
  .strict();
function previewClient(
  mock: ReturnType<typeof createAgentsMock>,
  operationId: string,
): AgentsWebMcpClient {
  const requests = new Map<string, { name: string; id: string }>();
  const proposal = async (id: string) => {
    const chat = await mock.client.get(id);
    const action = chat.actions[0];
    if (!action) throw new AgentsError("NOT_FOUND");
    return { ...action, resultHref: undefined, proposalId: id, operationId };
  };
  return {
    async catalog() {
      return [
        {
          name: "sample_read",
          description: "Read the selected sample record.",
          kind: "read",
          schema: JSON.stringify({ type: "object", properties: {}, additionalProperties: false }),
        },
        {
          name: "sample_rename",
          description:
            "Propose a new name for the selected sample record, then wait for approval in the page.",
          kind: "write",
          schema: JSON.stringify(z.toJSONSchema(input)),
        },
      ];
    },
    async call(name, raw, signal) {
      if (name === "sample_read")
        return {
          kind: "result",
          value: JSON.stringify((await mock.record(operationId)) ?? { name: "Sample record" }),
        };
      if (name !== "sample_rename") throw new AgentsError("INVALID");
      const value = input.parse(raw);
      const previous = requests.get(value.requestId);
      if (previous && previous.name !== value.name) throw new AgentsError("INVALID");
      if (previous) return { kind: "proposal", value: await proposal(previous.id) };
      const chat = await mock.client.create(operationId);
      // Consume the shared mock until its review is persisted.
      for await (const _event of mock.client.send(
        {
          conversationId: chat.id,
          requestId: value.requestId,
          text: value.name,
          attachmentIds: [],
        },
        signal ?? new AbortController().signal,
      )) {
        /* drain */
      }
      requests.set(value.requestId, { name: value.name, id: chat.id });
      return { kind: "proposal", value: await proposal(chat.id) };
    },
    proposal,
    async decide(value) {
      const current = await proposal(value.proposalId);
      if (JSON.stringify(current.preview) !== JSON.stringify(value.review))
        throw new AgentsError("INVALID");
      await mock.client.decide({
        conversationId: value.proposalId,
        actionId: current.id,
        approve: value.approve,
      });
      return proposal(value.proposalId);
    },
  };
}
const subscribe = () => () => {};
const supported = () => !!getWebMcpContext();

async function invoke(name: string, input: unknown) {
  // The native invocation API is used here so the buttons exercise actual WebMCP.
  const model = getWebMcpContext() as ReturnType<typeof getWebMcpContext> & {
    getTools(): Promise<{ name: string }[]>;
    executeTool(tool: { name: string }, input: unknown): Promise<string | null>;
  };
  if (!model) throw new Error("WebMCP unavailable");
  const tool = (await model.getTools()).find((tool) => tool.name === name);
  if (!tool) throw new Error("Tools are not ready. Try again.");
  return model.executeTool(tool, input);
}

export function WebMcpPreview() {
  const [mock] = useState(() => createAgentsMock());
  const [operation, setOperation] = useState("blogs");
  const client = useMemo(() => previewClient(mock, operation), [mock, operation]);
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [name, setName] = useState("Reviewed sample");
  const [record, setRecord] = useState("Sample record");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    void mock.record(operation).then((record) => {
      if (current) setRecord(record?.name ?? "Sample record");
    });
    return () => {
      current = false;
    };
  }, [mock, operation]);
  const run = async (tool: string, input: unknown) => {
    setBusy(true);
    setResult("");
    try {
      setResult((await invoke(tool, input)) ?? "Done");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ShowroomPreview
      notice="Browser-session sample data. No website account, AI provider or live service is connected."
      controls={
        <div className="space-y-3 text-sm">
          <p>
            Install: <code>shadcn add @forge/agents-webmcp @forge/agents-webmcp-server</code>
          </p>
          <p>
            Hosts provide authenticated endpoints, current page context and existing plugin actions.
          </p>
          <p>
            Enable <code>chrome://flags/#enable-webmcp-testing</code> and relaunch Chrome. These
            buttons call the native API; no model or API key is needed.
          </p>
          <a href="https://developer.chrome.com/docs/ai/webmcp" className="underline">
            Browser setup and assistant extensions
          </a>
        </div>
      }
    >
      <ShowroomIntro title="WebMCP">
        Give a browser assistant the current page context and review its proposed changes here.
      </ShowroomIntro>
      <output className="mb-5 block text-sm text-muted-foreground">
        {available
          ? "Native WebMCP is available."
          : "WebMCP is unavailable in this browser. The normal page remains usable."}
      </output>
      <div className="max-w-xl space-y-5">
        <div className="space-y-2">
          <label htmlFor="factory-webmcp-record" className="block">
            Selected record
          </label>
          <NativeSelect
            id="factory-webmcp-record"
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
            className="block w-full rounded-md border border-input bg-background p-2"
          >
            <option value="blogs">Example article</option>
            <option value="customers">Example customer</option>
          </NativeSelect>
        </div>
        <p>
          Saved name: <strong data-testid="saved-name">{record}</strong>
        </p>
        <label className="block space-y-2">
          <span>Proposed name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="block w-full rounded-md border border-input bg-background p-2"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!available || busy}
            className="min-h-10 rounded-md border border-border px-3 py-2 disabled:opacity-50"
            onClick={() => void run("website_context", {})}
          >
            Read page context
          </button>
          <button
            type="button"
            disabled={!available || busy || !name.trim()}
            className="min-h-10 rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
            onClick={() => void run("sample_rename", { name, requestId: crypto.randomUUID() })}
          >
            Propose sample change
          </button>
        </div>
        {result && (
          <pre
            data-testid="webmcp-result"
            className="max-h-60 overflow-auto rounded-md border border-border p-3 text-xs break-words whitespace-pre-wrap"
          >
            {result}
          </pre>
        )}
      </div>
      <AgentsWebMcp
        client={client}
        contextKey={operation}
        getContext={() => ({
          page: "WebMCP example",
          selectedRecord: operation,
          savedName: record,
        })}
        onChange={async () => setRecord((await mock.record(operation))?.name ?? "Sample record")}
      />
    </ShowroomPreview>
  );
}

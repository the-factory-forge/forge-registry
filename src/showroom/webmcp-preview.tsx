import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import {
  AgentsWebMcp,
  getWebMcpContext,
  type AgentsWebMcpClient,
  type WebMcpProposal,
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
  onProposal: (value: WebMcpProposal) => void,
): AgentsWebMcpClient {
  const requests = new Map<string, { name: string; id: string }>();
  const proposal = async (id: string) => {
    const chat = await mock.client.get(id);
    const action = chat.actions[0];
    if (!action) throw new AgentsError("NOT_FOUND");
    const value = { ...action, resultHref: undefined, proposalId: id, operationId };
    onProposal(value);
    return value;
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
  const [lastProposal, setLastProposal] = useState<WebMcpProposal>();
  const client = useMemo(() => previewClient(mock, operation, setLastProposal), [mock, operation]);
  const currentProposal = lastProposal?.operationId === operation ? lastProposal : undefined;
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [name, setName] = useState("WebMCP test");
  const [record, setRecord] = useState("Sample record");
  const [result, setResult] = useState<{ tool: string; text: string; failed?: boolean }>();
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
    setResult({ tool, text: "" });
    try {
      const value = (await invoke(tool, input)) ?? "Done";
      let text = value;
      try {
        text = JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        // A tool may return plain text.
      }
      setResult({ tool, text });
    } catch (error) {
      setResult({
        tool,
        text: error instanceof Error ? error.message : "Request failed",
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  };
  const responseData = result && !busy && (
    <pre
      data-testid="webmcp-result"
      className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap"
    >
      {result.text}
    </pre>
  );
  const response = (
    <section aria-label="Last tool response" className="space-y-2">
      <output className="block text-xs text-muted-foreground">
        {busy
          ? result?.tool === "sample_rename"
            ? "Approve or reject on the page."
            : "Reading…"
          : result && `${result.tool}: ${result.failed ? "call failed" : "response received"}`}
      </output>
      {!busy &&
      !result?.failed &&
      (result?.tool === "sample_rename" || result?.tool === "webmcp_proposal") ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Response data</summary>
          <div className="mt-2">{responseData}</div>
        </details>
      ) : (
        responseData
      )}
    </section>
  );
  return (
    <ShowroomPreview
      width="narrow"
      notice="Sample data. Changes stay in this browser tab."
      controls={
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Test with the page buttons or the Chrome inspector.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Help & assistant prompt</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Read context and record: check the selection and saved name.</li>
              <li>Propose a new name. Reject keeps the old name; Approve saves the new one.</li>
              <li>Read last decision: check succeeded or rejected.</li>
            </ol>
            <p className="mt-4 text-muted-foreground">Try this in the extension chat:</p>
            <blockquote className="mt-2 rounded-md bg-muted p-3">
              Read the selected record. Propose renaming it to “Assistant test” and wait for my
              decision. Read it again to confirm the saved name.
            </blockquote>
            <p className="mt-4 text-muted-foreground">
              Only this demo exposes WebMCP. The extension chat uses its own AI provider. If it
              reports an invalid Tool, reload this page and reset that chat before retrying.
            </p>
            <a
              href="https://developer.chrome.com/docs/ai/webmcp"
              className="mt-3 inline-block underline underline-offset-4"
            >
              Chrome setup and extensions
            </a>
          </details>
        </div>
      }
    >
      <ShowroomIntro title="WebMCP">
        Try the tools an assistant can use. This page uses sample data.
      </ShowroomIntro>
      <output className="mb-6 block text-sm text-muted-foreground">
        {available
          ? "Native WebMCP is available."
          : "WebMCP is unavailable in this browser. The normal page remains usable."}
      </output>
      <div className="max-w-2xl space-y-6">
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="factory-webmcp-record" className="block text-sm font-medium">
              Selected record
            </label>
            <NativeSelect
              id="factory-webmcp-record"
              value={operation}
              onChange={(event) => {
                setOperation(event.target.value);
                setResult(undefined);
              }}
              className="block h-11 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="blogs">Example article</option>
              <option value="customers">Example customer</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <span className="block text-sm text-muted-foreground">Saved name</span>
            <strong data-testid="saved-name" className="block min-h-11 content-center break-words">
              {record}
            </strong>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!available || busy}
              className="min-h-11 rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              onClick={() => void run("website_context", {})}
            >
              Read page context
            </button>
            <button
              type="button"
              disabled={!available || busy}
              className="min-h-11 rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              onClick={() => void run("sample_read", {})}
            >
              Read sample record
            </button>
          </div>
          {(result?.tool === "website_context" || result?.tool === "sample_read") && response}
        </div>
        <div className="space-y-3 border-t border-border pt-6">
          <label htmlFor="factory-webmcp-name" className="block text-sm font-medium">
            Proposed name
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="factory-webmcp-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby="factory-webmcp-name-help"
              maxLength={200}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="button"
              disabled={!available || busy || !name.trim() || name.trim() === record}
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              onClick={() => void run("sample_rename", { name, requestId: crypto.randomUUID() })}
            >
              Propose sample change
            </button>
          </div>
          <p id="factory-webmcp-name-help" className="text-sm text-muted-foreground">
            {name.trim() === record
              ? "Choose a different name."
              : "Nothing changes until you approve."}
          </p>
          {result?.tool === "sample_rename" && response}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!available || busy || !currentProposal}
              className="min-h-11 rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              onClick={() =>
                currentProposal &&
                void run("webmcp_proposal", { proposalId: currentProposal.proposalId })
              }
            >
              Read last decision
            </button>
            <output className="text-sm text-muted-foreground">
              {currentProposal?.status ?? "No proposal yet"}
            </output>
          </div>
          {result?.tool === "webmcp_proposal" && response}
        </div>
      </div>
      <AgentsWebMcp
        client={client}
        contextKey={operation}
        getContext={async () => ({
          page: "WebMCP example",
          selectedRecord: operation,
          savedName: (await mock.record(operation))?.name ?? "Sample record",
        })}
        onChange={async () => setRecord((await mock.record(operation))?.name ?? "Sample record")}
      />
    </ShowroomPreview>
  );
}

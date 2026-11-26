import { createElement, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { AgentsWebMcp } from "@/components/connectors/agents-webmcp";
import type {
  AgentsWebMcpClient,
  WebMcpProposal,
} from "@/components/connectors/agents-webmcp/types";

export function mountReviewFixture(replacement: "context" | "client", fails: boolean) {
  let count = 0;
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const proposals = new Map<string, WebMcpProposal>();
  const outcomes: string[] = [];
  const refreshes: number[] = [];
  const changedOperations: string[] = [];
  const client: AgentsWebMcpClient = {
    catalog: async () => [
      {
        name: "test_write",
        description: "Test change",
        kind: "write",
        schema: JSON.stringify({ type: "object", properties: {} }),
      },
    ],
    call: async () => {
      const id = String(++count);
      const value: WebMcpProposal = {
        id,
        messageId: id,
        proposalId: id,
        operationId: "test",
        status: "pending",
        preview: { title: `Change ${id}`, target: "Record", changes: [], effects: [] },
      };
      proposals.set(id, value);
      return { kind: "proposal", value };
    },
    proposal: async (id) => proposals.get(id)!,
    decide: async ({ proposalId, approve }) => {
      if (proposalId === "1") {
        await delayed;
        if (fails) throw new Error("Delayed failure");
      }
      const value = {
        ...proposals.get(proposalId)!,
        status: approve ? ("succeeded" as const) : ("rejected" as const),
      };
      proposals.set(proposalId, value);
      outcomes.push(`${proposalId}:${value.status}`);
      return value;
    },
  };
  const clients = [client, { ...client }];
  let replace!: () => void;
  function Host() {
    const [version, setVersion] = useState(0);
    useLayoutEffect(() => {
      replace = () => setVersion(1);
    }, []);
    return createElement(AgentsWebMcp, {
      client: clients[replacement === "client" ? version : 0],
      contextKey: replacement === "context" ? String(version) : "stable",
      getContext: () => ({ version }),
      onChange: (operationId) => {
        refreshes.push(version);
        changedOperations.push(operationId);
      },
    });
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  root.render(createElement(Host));
  return {
    replace: () => replace(),
    release,
    outcomes,
    refreshes,
    changedOperations,
    unmount: () => root.unmount(),
  };
}

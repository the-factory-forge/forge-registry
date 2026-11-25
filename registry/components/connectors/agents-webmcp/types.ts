import type { AgentAction, AgentPreview } from "@/components/plugins/agents/types";

export interface WebMcpProposal extends AgentAction {
  proposalId: string;
  operationId: string;
}
export interface WebMcpToolDefinition {
  name: string;
  description: string;
  kind: "read" | "write" | "staging";
  schema: string;
}
export type WebMcpResult =
  | { kind: "result"; value: string }
  | { kind: "proposal"; value: WebMcpProposal };
/** Bind these methods to authenticated, no-store host endpoints. Never accept an actor from the browser. */
export interface AgentsWebMcpClient {
  catalog(signal?: AbortSignal): Promise<WebMcpToolDefinition[]>;
  call(name: string, input: unknown, signal?: AbortSignal): Promise<WebMcpResult>;
  proposal(proposalId: string, signal?: AbortSignal): Promise<WebMcpProposal>;
  decide(input: {
    proposalId: string;
    approve: boolean;
    review: AgentPreview;
  }): Promise<WebMcpProposal>;
}

import type { z } from "zod";

import type {
  AgentAction,
  AgentAttachment,
  AgentConversation,
  AgentConversationSummary,
  AgentMessage,
  AgentOperation,
  AgentPreview,
} from "@/components/plugins/agents/types";

export interface AgentRuntime {
  stream(input: {
    instructions: string;
    messages: readonly AgentMessage[];
    tools: readonly { name: string; description: string; inputSchema: unknown }[];
    signal: AbortSignal;
  }): AsyncIterable<
    { type: "text"; text: string } | { type: "tool"; name: string; input: unknown; callId?: string }
  >;
}
export interface AgentFiles {
  get(id: string): Promise<{ metadata: AgentAttachment; bytes: Uint8Array }>;
}
export type AgentTool<Context> = {
  name: string;
  description: string;
  schema: z.ZodType;
  /** File staging belongs to intranet chat; external clients do not supply file bytes. */
  requiresAttachments?: boolean;
} & (
  | {
      kind: "read";
      run(context: Context, input: unknown, files: AgentFiles): Promise<unknown>;
      download?(context: Context, input: unknown): Promise<{ url: string; name: string }>;
    }
  | {
      kind: "write";
      prepare(
        context: Context,
        input: unknown,
        files: AgentFiles,
      ): Promise<{ preview: AgentPreview; snapshot: unknown }>;
      run(
        context: Context,
        input: unknown,
        files: AgentFiles,
        requestId: string,
        prepared: unknown,
      ): Promise<unknown>;
    }
);
export interface AgentServerOperation<Context> extends AgentOperation {
  instructions: string;
  authorize(context: Context): Promise<boolean>;
  tools: readonly AgentTool<Context>[];
}
export interface AgentStoredAction extends AgentAction {
  callId: string;
  tool: string;
  input: unknown;
  snapshot: string;
  expiresAt?: string;
}
export interface AgentConnection {
  id: string;
  clientId: string;
}
export interface AgentActor {
  id: string;
  connection?: AgentConnection;
}
export interface AgentRecord extends Omit<AgentConversation, "actions" | "running"> {
  ownerId: string;
  connection?: AgentConnection;
  actions: AgentStoredAction[];
  run: { id: string; startedAt: string } | null;
  requests: string[];
  downloads: Record<string, { tool: string; input: unknown }>;
  deleting?: boolean;
}
export interface AgentStoredAttachment extends AgentAttachment {
  ownerId: string;
  conversationId: string;
  key: string;
  state: "uploading" | "ready" | "cleanup";
  sha256: string;
}
/** change must lock the row and commit its callback atomically. Never call a provider inside it. */
export interface AgentsStore {
  /** Insert only; an existing ID must never be replaced (proposal retry protection). */
  create(record: AgentRecord): Promise<void>;
  get(id: string, ownerId: string): Promise<AgentRecord | null>;
  list(ownerId: string, operationId: string): Promise<AgentConversationSummary[]>;
  owned(ownerId: string): Promise<string[]>;
  change<T>(id: string, ownerId: string, update: (record: AgentRecord) => T): Promise<T>;
  remove(id: string, ownerId: string): Promise<void>;
  putAttachment(record: AgentStoredAttachment): Promise<void>;
  getAttachment(id: string, ownerId: string): Promise<AgentStoredAttachment | null>;
  attachments(conversationId: string, ownerId: string): Promise<AgentStoredAttachment[]>;
  removeAttachment(id: string, ownerId: string): Promise<void>;
}
/** Private object storage, scoped to the validated <site>/agents/ prefix. No public URLs. */
export interface AgentAttachmentStore {
  keyPrefix: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

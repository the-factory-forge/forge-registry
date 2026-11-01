export interface AgentOperation {
  id: string;
  label: string;
  description: string;
  attachmentOptions?: { label: string; crop?: { width: number; height: number } }[];
}
export interface AgentAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}
export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  attachments: AgentAttachment[];
  download?: boolean;
  /** Lets provider adapters reconstruct the matching assistant tool call and tool result. */
  tool?: { callId: string; name: string; input: unknown };
}
export interface AgentPreview {
  title: string;
  target: string;
  changes: { label: string; before?: string; after: string }[];
  effects: string[];
  attachmentIds?: string[];
}
export type AgentActionStatus =
  | "pending"
  | "executing"
  | "succeeded"
  | "rejected"
  | "stale"
  | "unresolved";
export interface AgentAction {
  id: string;
  messageId: string;
  preview: AgentPreview;
  status: AgentActionStatus;
  result?: string;
  resultHref?: string;
}
export interface AgentConversationSummary {
  id: string;
  operationId: string;
  title: string;
  updatedAt: string;
}
export interface AgentConversation extends AgentConversationSummary {
  messages: AgentMessage[];
  actions: AgentAction[];
  running: boolean;
  canResume: boolean;
}
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "conversation"; conversation: AgentConversation };

/** Authenticated transport belongs to the host. Streams must close on AbortSignal. */
export interface AgentsClient {
  operations(): Promise<AgentOperation[]>;
  list(operationId: string): Promise<AgentConversationSummary[]>;
  create(operationId: string): Promise<AgentConversation>;
  get(id: string): Promise<AgentConversation>;
  remove(id: string): Promise<void>;
  send(
    input: {
      conversationId: string;
      requestId: string;
      text: string;
      attachmentIds: string[];
      resume?: boolean;
    },
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent>;
  decide(input: {
    conversationId: string;
    actionId: string;
    approve: boolean;
  }): Promise<AgentConversation>;
  attach(conversationId: string, file: File): Promise<AgentAttachment>;
  attachment(conversationId: string, id: string): Promise<Blob>;
  download?(conversationId: string, messageId: string): Promise<{ url: string; name: string }>;
}
export type AgentErrorCode =
  | "INVALID"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BUSY"
  | "PENDING"
  | "STALE"
  | "UNRESOLVED"
  | "LIMIT"
  | "STORAGE"
  | "RUNTIME";
export class AgentsError extends Error {
  code: AgentErrorCode;
  constructor(code: AgentErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Result navigation stays within the host application. */
export function safeAgentResultHref(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 2000 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\s]/.test(value)
    ? value
    : undefined;
}

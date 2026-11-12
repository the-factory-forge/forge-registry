export type SupportType = "bug" | "feature" | "support";
export type SupportStatus = "open" | "closed" | "canceled";
export interface SupportAuthor {
  id: string;
  name: string;
}
export interface SupportAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}
export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  type: SupportType;
  status: SupportStatus;
  author: SupportAuthor;
  createdAt: string;
  updatedAt: string;
  attachments: SupportAttachment[];
}
export interface SupportActivity {
  id: string;
  author: SupportAuthor;
  createdAt: string;
  kind: "comment" | "status";
  body: string;
  status: SupportStatus | null;
  attachments: SupportAttachment[];
}
export interface SupportCreateInput {
  requestId: string;
  title: string;
  description: string;
  type: SupportType;
  attachmentIds: string[];
}
export interface SupportCommentInput {
  requestId: string;
  id: string;
  body: string;
  attachmentIds: string[];
}
export interface SupportQuery {
  search?: string;
  page?: number;
}
export interface SupportPage {
  items: SupportTicket[];
  total: number;
}
export interface SupportDetail {
  ticket: SupportTicket;
  activity: SupportActivity[];
  nextCursor?: string;
}
/** Host transport: never serialize database, credentials or the authenticated actor. */
export interface SupportsClient {
  list(query: SupportQuery): Promise<SupportPage>;
  get(id: string, cursor?: string): Promise<SupportDetail>;
  create(input: SupportCreateInput): Promise<SupportTicket>;
  comment(input: SupportCommentInput): Promise<void>;
  setStatus(id: string, status: SupportStatus): Promise<void>;
  upload(input: { requestId: string; file: File }): Promise<SupportAttachment>;
  cancelUpload(id: string): Promise<void>;
  getAttachment(id: string): Promise<{ url: string }>;
}

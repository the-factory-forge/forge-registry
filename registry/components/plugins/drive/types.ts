import type { ComponentType } from "react";

import type { LinkProps } from "@/components/link";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";

export interface DriveScope {
  type: string;
  id: string;
}
export interface DriveCapabilities {
  upload: boolean;
  createFolder: boolean;
  rename: boolean;
  delete: boolean;
  download: boolean;
}
export interface DriveSpace {
  scope: DriveScope;
  name: string;
  href?: string;
  capabilities: DriveCapabilities;
}
export interface DriveEntry {
  id: string;
  parentId: string | null;
  kind: "file" | "folder";
  name: string;
  size: number;
  contentType: string;
  updatedAt: string;
  state: "ready" | "deleting";
}
export interface DrivePageResult<T> {
  items: T[];
  nextCursor?: string;
}
export interface DriveQuery {
  search?: string;
  cursor?: string;
  signal?: AbortSignal;
}
export interface DriveFolderResult extends DrivePageResult<DriveEntry> {
  space: DriveSpace;
  breadcrumbs: { id: string; name: string }[];
  maxFileBytes: number;
}
export interface DriveUploadInput {
  scope: DriveScope;
  parentId: string | null;
  requestId: string;
  name: string;
  size: number;
  contentType: string;
}
export interface DriveUploadTicket {
  id: string;
  url?: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  completed: boolean;
}
export interface DriveDeletePreview {
  token: string;
  files: number;
  folders: number;
}
export interface DriveClient {
  listSpaces(query: DriveQuery): Promise<DrivePageResult<DriveSpace>>;
  listEntries(
    input: DriveQuery & { scope: DriveScope; parentId: string | null },
  ): Promise<DriveFolderResult>;
  createFolder(input: { scope: DriveScope; parentId: string | null; name: string }): Promise<void>;
  rename(input: { scope: DriveScope; entryId: string; name: string }): Promise<void>;
  previewDelete(input: { scope: DriveScope; entryId: string }): Promise<DriveDeletePreview>;
  deleteEntry(input: { scope: DriveScope; entryId: string; token: string }): Promise<void>;
  prepareUpload(input: DriveUploadInput): Promise<DriveUploadTicket>;
  completeUpload(input: { scope: DriveScope; uploadId: string }): Promise<void>;
  cancelUpload(input: { scope: DriveScope; uploadId: string }): Promise<void>;
  getDownload(input: { scope: DriveScope; entryId: string }): Promise<{ url: string }>;
}
export interface DriveAppearanceProps {
  className?: string;
  labels?: Partial<DriveLabels>;
  linkComponent?: ComponentType<LinkProps>;
  locale?: string;
}
export interface DrivePageProps extends DriveAppearanceProps {
  client: DriveClient;
  getSpaceHref: (space: DriveSpace) => string;
}
export interface DriveBrowserProps extends DriveAppearanceProps {
  client: DriveClient;
  scope: DriveScope;
  parentId?: string | null;
  getFolderHref: (folderId: string | null) => string;
  backHref?: string;
  transferUpload?: DriveTransfer;
}

import type { ComponentType } from "react";

import type { LinkProps } from "@/components/link";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import type { TableSort, TableSortProps } from "@/components/utils/table-sort-state";

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
  /** Recovery is denied unless the host explicitly grants it. */
  restore?: boolean;
}
export interface DriveSpace {
  scope: DriveScope;
  name: string;
  href?: string;
  /** Customer associated with the host record, when available. */
  owner?: { name: string; image?: string | null };
  /** Aggregate file size in bytes; omit when unavailable. */
  size?: number;
  /** ISO timestamp of the latest change in this space, when available. */
  updatedAt?: string;
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
export interface DriveTrashEntry extends Omit<DriveEntry, "state"> {
  state: "trashed" | "deleting";
  originalParentId: string | null;
  originalPath: string;
  deletedAt: string;
  expiresAt: string;
}
export interface DriveTrashResult extends DrivePageResult<DriveTrashEntry> {
  space: DriveSpace;
}
export interface DrivePageResult<T> {
  items: T[];
  nextCursor?: string;
}
export const DRIVE_SORT_FIELDS = ["name", "updatedAt", "size", "owner"] as const;
export type DriveSort = TableSort<(typeof DRIVE_SORT_FIELDS)[number]>;
export type DriveFileSortField = Exclude<DriveSort["field"], "owner">;
export const driveDefaultSort = { field: "name", direction: "asc" } as const;
export const TRASH_SORT_FIELDS = ["name", "originalPath", "deletedAt", "expiresAt"] as const;
export type DriveTrashSort = TableSort<(typeof TRASH_SORT_FIELDS)[number]>;
export const trashDefaultSort = { field: "deletedAt", direction: "desc" } as const;
/** Older trash callers could supply file-only fields, which used deletion-date order. */
export function resolveTrashSort(sort?: DriveTrashSort | DriveSort): DriveTrashSort {
  switch (sort?.field) {
    case "name":
    case "originalPath":
    case "deletedAt":
    case "expiresAt":
      return { field: sort.field, direction: sort.direction };
    default:
      return trashDefaultSort;
  }
}

export interface DriveQuery {
  /** Apply ordering before pagination. Defaults to name ascending. */
  sort?: DriveSort;
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
  /** File identity for a caller that attaches the completed upload to another record. */
  entryId?: string;
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
  /** Copy an entry and its descendants beside the original, without replacing existing names. */
  duplicateEntry?(input: { scope: DriveScope; entryId: string; name: string }): Promise<void>;
  previewDelete(input: { scope: DriveScope; entryId: string }): Promise<DriveDeletePreview>;
  deleteEntry(input: { scope: DriveScope; entryId: string; token: string }): Promise<void>;
  listTrash?(
    input: Omit<DriveQuery, "sort"> & { scope: DriveScope; sort?: DriveTrashSort | DriveSort },
  ): Promise<DriveTrashResult>;
  trashEntry?(input: { scope: DriveScope; entryId: string; token: string }): Promise<void>;
  restoreEntry?(input: {
    scope: DriveScope;
    entryId: string;
    /** Omit to restore to the original folder; null selects the space root. */
    parentId?: string | null;
    name?: string;
  }): Promise<void>;
  prepareUpload(input: DriveUploadInput): Promise<DriveUploadTicket>;
  /** Preserve the selected directory path, including its root folder. */
  prepareFolderUpload?(
    input: DriveUploadInput & { relativePath: string },
  ): Promise<DriveUploadTicket>;
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
export interface DrivePageProps extends DriveAppearanceProps, TableSortProps<DriveSort["field"]> {
  client: DriveClient;
  getSpaceHref: (space: DriveSpace) => string;
}
export interface DriveBrowserProps
  extends DriveAppearanceProps, TableSortProps<DriveFileSortField> {
  trashOrder?: TableSortProps<DriveTrashSort["field"]>;
  trashView?: boolean;
  onTrashViewChange?: (visible: boolean) => void;
  client: DriveClient;
  scope: DriveScope;
  parentId?: string | null;
  getFolderHref: (folderId: string | null) => string;
  backHref?: string;
  /** Rename the host-owned record; omit when the current user cannot rename it. */
  onRenameSpace?: (name: string) => Promise<void>;
  transferUpload?: DriveTransfer;
  /** Optional selection control for hosts using Drive as a media library. */
  onSelectFile?: (entry: DriveEntry) => void;
  isSelectableFile?: (entry: DriveEntry) => boolean;
  selectFileLabel?: string;
  uploadAccept?: string;
}

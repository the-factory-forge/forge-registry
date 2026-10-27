import type { S3Client } from "@aws-sdk/client-s3";

import type { BlogEditor } from "@/components/plugins/blogs/types";
import type { DatabaseTransaction, PluginDatabase } from "@/components/utils/database";

export type BlogsTransaction = DatabaseTransaction;
export type BlogsDatabase = PluginDatabase;
export type BlogsPermission =
  | "read"
  | "create"
  | "edit"
  | "publish"
  | "delete"
  | "upload"
  | "changeAuthor"
  | "reviewLegacyAuthor"
  | "manageCategories";
export interface BlogsStorageOptions<Context> {
  db: BlogsDatabase;
  s3?: S3Client;
  bucket?: string;
  /** Required <SITE_NAME>/blogs/ prefix; never a bucket-root default. */
  keyPrefix: string;
  locales: string[];
  maxImageBytes?: number;
  maxMarkdownBytes?: number;
  /** Return false for anonymous or unauthorized requests. Never trust browser capabilities. */
  authorize: (
    context: Context,
    permission: BlogsPermission,
    articleId?: string,
  ) => Promise<boolean>;
  resolveEditor: (context: Context) => Promise<BlogEditor>;
  /** Public-safe current account names, batched once per read; omit missing accounts.
   * Hosts must snapshot the latest name before account deletion and invalidate caches.
   */
  resolveAuthorNames?: (ids: string[], tx: BlogsTransaction) => Promise<BlogEditor[]>;
  /** Resolve trusted account names inside the mutation transaction; null means unavailable.
   * An unavailable current author retains their signature; a new unavailable author is rejected.
   */
  resolveAuthor?: (
    context: Context,
    id: string,
    tx: BlogsTransaction,
  ) => Promise<BlogEditor | null>;
}
export interface BlogImageInput {
  id: string;
  requestId: string;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

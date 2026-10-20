import type { S3Client } from "@aws-sdk/client-s3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { BlogEditor } from "@/components/plugins/blogs/types";

export type BlogsTransaction = Pick<PostgresJsDatabase, "execute">;
export interface BlogsDatabase extends BlogsTransaction {
  transaction<T>(action: (tx: BlogsTransaction) => Promise<T>): Promise<T>;
}
export type BlogsPermission =
  | "read"
  | "create"
  | "edit"
  | "publish"
  | "delete"
  | "upload"
  | "changeAuthor"
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

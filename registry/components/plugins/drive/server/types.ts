import type { S3Client } from "@aws-sdk/client-s3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type {
  DriveCapabilities,
  DrivePageResult,
  DriveScope,
  DriveSpace,
} from "@/components/plugins/drive/types";
// Structural methods accept Drizzle databases with or without a host schema.
export type DriveTransaction = Pick<
  PostgresJsDatabase,
  "execute" | "select" | "insert" | "update" | "delete"
>;
export interface DriveDatabase extends Pick<PostgresJsDatabase, "execute"> {
  transaction<T>(action: (tx: DriveTransaction) => Promise<T>): Promise<T>;
}
export interface DriveStorageOptions<Context> {
  db: DriveDatabase;
  s3: S3Client;
  bucket: string;
  keyPrefix?: string;
  maxFileBytes?: number;
  resolveScope: (context: Context, scope: DriveScope) => Promise<DriveSpace | null>;
  listScopes: (
    context: Context,
    query: { search: string; cursor?: string; limit: number },
  ) => Promise<DrivePageResult<DriveSpace>>;
}
export type DrivePermission = keyof DriveCapabilities;

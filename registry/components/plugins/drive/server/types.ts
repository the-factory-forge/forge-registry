import type { S3Client } from "@aws-sdk/client-s3";

import type {
  DriveCapabilities,
  DrivePageResult,
  DriveScope,
  DriveSort,
  DriveSpace,
} from "@/components/plugins/drive/types";
import type { DatabaseTransaction, PluginDatabase } from "@/components/utils/database";
export type DriveTransaction = DatabaseTransaction;
export type DriveDatabase = PluginDatabase;
export interface DriveStorageOptions<Context> {
  db: DriveDatabase;
  s3: S3Client;
  bucket: string;
  /** Required <SITE_NAME>/drive/ prefix; never a bucket-root default. */
  keyPrefix: string;
  maxFileBytes?: number;
  /** Enable trash with a default retention of 30 days. */
  trash?: { retentionDays?: number };
  resolveScope: (context: Context, scope: DriveScope) => Promise<DriveSpace | null>;
  listScopes: (
    context: Context,
    query: { search: string; cursor?: string; limit: number; sort: DriveSort },
  ) => Promise<DrivePageResult<DriveSpace>>;
  /** Optional host guard, called under the space lock before removing a file or folder. */
  canDelete?: (
    context: Context,
    scope: DriveScope,
    entryIds: string[],
    tx: DriveTransaction,
  ) => Promise<boolean>;
}
export type DrivePermission = keyof DriveCapabilities;

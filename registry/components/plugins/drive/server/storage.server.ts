import { createHash, randomUUID } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sql } from "drizzle-orm";

import type {
  DriveDatabase,
  DrivePermission,
  DriveStorageOptions,
  DriveTransaction,
} from "@/components/plugins/drive/server/types";
import type {
  DriveClient,
  DriveDeletePreview,
  DriveEntry,
  DriveScope,
  DriveSpace,
  DriveUploadInput,
} from "@/components/plugins/drive/types";
import {
  DEFAULT_MAX_FILE_BYTES,
  DriveError,
  scopeKey,
  validId,
  validName,
  validScope,
} from "@/components/plugins/drive/utils";

type QueryDb = Pick<DriveDatabase, "execute">;
type Entry = {
  id: string;
  space_id: string;
  parent_id: string | null;
  kind: "file" | "folder";
  name: string;
  size: number | string;
  content_type: string;
  state: "uploading" | "ready" | "deleting";
  storage_id: string | null;
  updated_at: Date | string;
  depth?: number;
};
type Upload = {
  id: string;
  space_id: string;
  entry_id: string;
  storage_id: string;
  input: { parentId: string | null; name: string; size: number; contentType: string };
  state: "active" | "completed" | "cancelled";
  expires_at: Date | string;
};
const pageSize = 50;
const uploadLifetime = 15 * 60_000;
function publicEntry(row: Entry): DriveEntry {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    size: Number(row.size),
    contentType: row.content_type,
    updatedAt: new Date(row.updated_at).toISOString(),
    state: row.state === "deleting" ? "deleting" : "ready",
  };
}
function storageError(error: unknown): never {
  if (error instanceof DriveError) throw error;
  if (error && typeof error === "object") {
    if ("code" in error && error.code === "23505") throw new DriveError("CONFLICT");
    if (
      "cause" in error &&
      error.cause &&
      typeof error.cause === "object" &&
      "code" in error.cause &&
      error.cause.code === "23505"
    )
      throw new DriveError("CONFLICT");
  }
  throw new DriveError("STORAGE");
}
function offsetFor(cursor?: string) {
  if (!cursor) return 0;
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw new DriveError("INVALID");
  return offset;
}

export function createDriveStorage<Context>(options: DriveStorageOptions<Context>) {
  const { db, s3, bucket } = options;
  const prefix = options.keyPrefix ?? "drive/";
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  if (
    !bucket ||
    !/^[a-zA-Z0-9_/-]+\/$/.test(prefix) ||
    prefix.includes("..") ||
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes < 1 ||
    maxFileBytes > 5_000_000_000
  )
    throw new DriveError("INVALID");
  const key = (spaceId: string, storageId: string, staging = false) =>
    `${prefix}${staging ? "staging" : "objects"}/${spaceId}/${storageId}`;
  let verified: Promise<void> | undefined;
  function verifyBucket() {
    verified ??= s3
      .send(new GetBucketVersioningCommand({ Bucket: bucket }))
      .then((result) => {
        // A dedicated unversioned bucket makes permanent deletion and cleanup explicit.
        if (result.Status) throw new DriveError("STORAGE");
      })
      .catch((error: unknown) => {
        verified = undefined;
        storageError(error);
      });
    return verified;
  }
  async function access(context: Context, scope: DriveScope, permission?: DrivePermission) {
    validScope(scope);
    const space = await options.resolveScope(context, scope);
    if (!space || scopeKey(space.scope) !== scopeKey(scope)) throw new DriveError("NOT_FOUND");
    if (permission && !space.capabilities[permission]) throw new DriveError("FORBIDDEN");
    return space;
  }
  async function locked<T>(
    scope: DriveScope,
    create: boolean,
    action: (tx: QueryDb, spaceId: string | undefined) => Promise<T>,
  ): Promise<T> {
    try {
      return await db.transaction(async (tx) => {
        // Serialize mutations and finalization within one space, including deletion races.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${scopeKey(scope)}, 0))`,
        );
        if (create)
          await tx.execute(
            sql`insert into drive_space (id, entity_type, entity_id) values (${randomUUID()}, ${scope.type}, ${scope.id}) on conflict (entity_type, entity_id) do nothing`,
          );
        const [space] = await tx.execute<{ id: string }>(
          sql`select id from drive_space where entity_type=${scope.type} and entity_id=${scope.id}`,
        );
        return action(tx, space?.id);
      });
    } catch (error) {
      storageError(error);
    }
  }
  async function authorized<T>(
    context: Context,
    scope: DriveScope,
    create: boolean,
    permission: DrivePermission | undefined,
    action: (tx: QueryDb, spaceId: string | undefined) => Promise<T>,
  ) {
    return locked(scope, create, async (tx, spaceId) => {
      // Recheck after acquiring the lock: an entity may have been removed while waiting.
      await access(context, scope, permission);
      return action(tx, spaceId);
    });
  }
  async function entry(tx: QueryDb, spaceId: string | undefined, id: string) {
    validId(id);
    const [row] = await tx.execute<Entry>(
      sql`select * from drive_entry where space_id=${spaceId ?? null} and id=${id}`,
    );
    if (!row) throw new DriveError("NOT_FOUND");
    return row;
  }
  async function parents(tx: QueryDb, spaceId: string | undefined, parentId: string | null) {
    if (parentId !== null) validId(parentId);
    const result: Entry[] = [];
    const visited = new Set<string>();
    let current = parentId;
    while (current) {
      if (visited.has(current) || result.length >= 100) throw new DriveError("INVALID");
      visited.add(current);
      const row = await entry(tx, spaceId, current);
      if (row.kind !== "folder" || row.state !== "ready") throw new DriveError("CONFLICT");
      result.unshift(row);
      current = row.parent_id;
    }
    return result;
  }
  async function subtree(tx: QueryDb, spaceId: string, id: string) {
    return tx.execute<Entry>(sql`with recursive tree as (
      select e.*, 0 as depth from drive_entry e where space_id=${spaceId} and id=${id}
      union all select e.*, tree.depth+1 from drive_entry e join tree on e.parent_id=tree.id and e.space_id=tree.space_id
    ) select * from tree order by depth desc, id`);
  }
  function preview(rows: readonly Entry[]): DriveDeletePreview {
    return {
      token: createHash("sha256")
        .update(JSON.stringify(rows.map((row) => [row.id, row.name, row.state, row.updated_at])))
        .digest("hex"),
      files: rows.filter((row) => row.kind === "file").length,
      folders: rows.filter((row) => row.kind === "folder").length,
    };
  }
  async function removeObjects(spaceId: string, storageId: string) {
    await verifyBucket();
    for (const staging of [false, true])
      await s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key(spaceId, storageId, staging) }),
      );
  }
  async function finishDeletes(scope: DriveScope, limit = 100) {
    return locked(scope, false, async (tx, spaceId) => {
      if (!spaceId) return { remaining: 0, failures: 0, processed: 0 };
      let failures = 0;
      const rows = await tx.execute<Entry>(
        sql`select e.* from drive_entry e where e.space_id=${spaceId} and e.state='deleting' and not exists(select 1 from drive_entry child where child.space_id=e.space_id and child.parent_id=e.id) order by e.id limit ${limit}`,
      );
      for (const row of rows) {
        try {
          if (row.storage_id) await removeObjects(spaceId, row.storage_id);
          await tx.execute(
            sql`update drive_upload set state='cancelled' where space_id=${spaceId} and entry_id=${row.id} and state='active'`,
          );
          await tx.execute(sql`delete from drive_entry where id=${row.id} and space_id=${spaceId}`);
        } catch {
          failures++;
        }
      }
      const [count] = await tx.execute<{ count: string }>(
        sql`select count(*)::text as count from drive_entry where space_id=${spaceId} and state='deleting'`,
      );
      return { remaining: Number(count.count), failures, processed: rows.length };
    });
  }
  async function reservation(tx: QueryDb, spaceId: string | undefined, id: string) {
    validId(id);
    const [upload] = await tx.execute<Upload>(
      sql`select * from drive_upload where space_id=${spaceId ?? null} and id=${id}`,
    );
    if (!upload) throw new DriveError("NOT_FOUND");
    return upload;
  }

  function client(context: Context): DriveClient {
    return {
      async listSpaces(query) {
        const page = await options.listScopes(context, {
          search: (query.search ?? "").slice(0, 255),
          cursor: query.cursor,
          limit: pageSize,
        });
        const items: DriveSpace[] = [];
        for (const item of page.items.slice(0, pageSize)) {
          try {
            items.push(await access(context, item.scope));
          } catch (error) {
            if (!(error instanceof DriveError) || error.code !== "NOT_FOUND") throw error;
          }
        }
        return { items, nextCursor: page.nextCursor };
      },
      async listEntries({ scope, parentId, search = "", cursor }) {
        const space = await access(context, scope);
        const offset = offsetFor(cursor);
        return authorized(context, scope, false, undefined, async (tx, spaceId) => {
          const breadcrumbs = (await parents(tx, spaceId, parentId)).map(({ id, name }) => ({
            id,
            name,
          }));
          const rows = await tx.execute<Entry>(
            sql`select * from drive_entry where space_id=${spaceId ?? null} and parent_id is not distinct from ${parentId}::uuid and state <> 'uploading' and strpos(lower(name), lower(${search.slice(0, 255)})) > 0 order by kind desc, name, id limit ${pageSize + 1} offset ${offset}`,
          );
          return {
            space,
            breadcrumbs,
            maxFileBytes,
            items: rows.slice(0, pageSize).map(publicEntry),
            nextCursor: rows.length > pageSize ? String(offset + pageSize) : undefined,
          };
        });
      },
      async createFolder({ scope, parentId, name }) {
        await access(context, scope, "createFolder");
        const normalized = validName(name);
        await authorized(context, scope, true, "createFolder", async (tx, spaceId) => {
          await parents(tx, spaceId, parentId);
          await tx.execute(
            sql`insert into drive_entry (id,space_id,parent_id,kind,name,state) values (${randomUUID()},${spaceId},${parentId},'folder',${normalized},'ready')`,
          );
        });
      },
      async rename({ scope, entryId, name }) {
        await access(context, scope, "rename");
        const normalized = validName(name);
        await authorized(context, scope, false, "rename", async (tx, spaceId) => {
          const row = await entry(tx, spaceId, entryId);
          if (row.state !== "ready") throw new DriveError("CONFLICT");
          await parents(tx, spaceId, row.parent_id);
          await tx.execute(
            sql`update drive_entry set name=${normalized},updated_at=now() where id=${row.id}`,
          );
        });
      },
      async previewDelete({ scope, entryId }) {
        await access(context, scope, "delete");
        return authorized(context, scope, false, "delete", async (tx, spaceId) => {
          await entry(tx, spaceId, entryId);
          return preview(await subtree(tx, spaceId!, entryId));
        });
      },
      async deleteEntry({ scope, entryId, token }) {
        await access(context, scope, "delete");
        validId(entryId);
        await authorized(context, scope, false, "delete", async (tx, spaceId) => {
          if (!spaceId) return;
          const rows = await subtree(tx, spaceId, entryId);
          if (!rows.length) return; // Repeating a confirmed deletion is harmless.
          const root = rows.find((row) => row.id === entryId)!;
          if (root.state !== "deleting" && preview(rows).token !== token)
            throw new DriveError("CONFLICT");
          await tx.execute(
            sql`update drive_entry set state='deleting',updated_at=now() where space_id=${spaceId} and id in (${sql.join(
              rows.map((row) => sql`${row.id}::uuid`),
              sql`,`,
            )})`,
          );
        });
        // Bounded request work; maintenance and explicit retries finish larger trees.
        for (let pass = 0; pass < 10; pass++) {
          const result = await finishDeletes(scope);
          if (!result.remaining) return;
          if (result.failures) break;
        }
        throw new DriveError("DELETE_PENDING");
      },
      async prepareUpload(input: DriveUploadInput) {
        const { scope, parentId, requestId, size } = input;
        await access(context, scope, "upload");
        validId(requestId);
        const name = validName(input.name);
        const contentType =
          typeof input.contentType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(input.contentType)
            ? input.contentType
            : "application/octet-stream";
        if (!Number.isSafeInteger(size) || size < 0 || size > maxFileBytes)
          throw new DriveError("INVALID");
        await verifyBucket();
        return authorized(context, scope, true, "upload", async (tx, spaceId) => {
          const [existing] = await tx.execute<Upload>(
            sql`select * from drive_upload where id=${requestId}`,
          );
          const fields = { parentId, name, size, contentType };
          let upload = existing;
          if (upload) {
            if (upload.space_id !== spaceId) throw new DriveError("NOT_FOUND");
            if (
              Object.entries(fields).some(
                ([field, value]) => upload.input[field as keyof typeof fields] !== value,
              )
            )
              throw new DriveError("CONFLICT");
            if (upload.state === "completed") return { id: requestId, completed: true };
            if (upload.state !== "active" || new Date(upload.expires_at).getTime() <= Date.now())
              throw new DriveError("EXPIRED");
          } else {
            await parents(tx, spaceId, parentId);
            const entryId = randomUUID(),
              storageId = randomUUID();
            const expiresAt = new Date(Date.now() + uploadLifetime);
            await tx.execute(
              sql`insert into drive_entry (id,space_id,parent_id,kind,name,size,content_type,state,storage_id) values (${entryId},${spaceId},${parentId},'file',${name},${size},${contentType},'uploading',${storageId})`,
            );
            const [created] = await tx.execute<Upload>(
              sql`insert into drive_upload (id,space_id,entry_id,storage_id,input,state,expires_at) values (${requestId},${spaceId},${entryId},${storageId},${JSON.stringify(fields)}::jsonb,'active',${expiresAt.toISOString()}) returning *`,
            );
            upload = created;
          }
          await parents(tx, spaceId, parentId);
          const row = await entry(tx, spaceId, upload.entry_id);
          if (row.state !== "uploading") throw new DriveError("CONFLICT");
          const expiresIn = Math.max(
            1,
            Math.min(600, Math.floor((new Date(upload.expires_at).getTime() - Date.now()) / 1000)),
          );
          const url = await getSignedUrl(
            s3,
            new PutObjectCommand({
              Bucket: bucket,
              Key: key(spaceId!, upload.storage_id, true),
              ContentLength: size,
              ContentType: contentType,
              IfNoneMatch: "*",
            }),
            {
              expiresIn,
              signableHeaders: new Set(["content-length", "content-type", "if-none-match"]),
            },
          );
          return {
            id: requestId,
            completed: false,
            url,
            headers: { "Content-Type": contentType, "If-None-Match": "*" },
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          };
        });
      },
      async completeUpload({ scope, uploadId }) {
        await access(context, scope, "upload");
        await verifyBucket();
        const completed = await authorized(context, scope, false, "upload", async (tx, spaceId) => {
          const upload = await reservation(tx, spaceId, uploadId);
          if (upload.state === "completed") return upload;
          if (upload.state !== "active" || new Date(upload.expires_at).getTime() <= Date.now())
            throw new DriveError("EXPIRED");
          const row = await entry(tx, spaceId, upload.entry_id);
          if (row.state !== "uploading") throw new DriveError("CONFLICT");
          await parents(tx, spaceId, row.parent_id);
          const stagingKey = key(spaceId!, upload.storage_id, true);
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: stagingKey }));
          if (
            head.ContentLength !== upload.input.size ||
            head.ContentLength > maxFileBytes ||
            head.ContentType !== upload.input.contentType ||
            !head.ETag
          )
            throw new DriveError("INVALID");
          await s3.send(
            new CopyObjectCommand({
              Bucket: bucket,
              Key: key(spaceId!, upload.storage_id),
              CopySource: `${encodeURIComponent(bucket)}/${stagingKey.split("/").map(encodeURIComponent).join("/")}`,
              CopySourceIfMatch: head.ETag,
              MetadataDirective: "REPLACE",
              ContentType: upload.input.contentType,
            }),
          );
          await tx.execute(
            sql`update drive_entry set state='ready',updated_at=now() where id=${row.id}`,
          );
          await tx.execute(sql`update drive_upload set state='completed' where id=${upload.id}`);
          return upload;
        });
        // Completion is committed before staging cleanup; lifecycle handles late URL replays.
        await s3
          .send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: key(completed.space_id, completed.storage_id, true),
            }),
          )
          .catch(() => undefined);
      },
      async cancelUpload({ scope, uploadId }) {
        await access(context, scope, "upload");
        await authorized(context, scope, false, "upload", async (tx, spaceId) => {
          const upload = await reservation(tx, spaceId, uploadId);
          if (upload.state === "completed") return;
          await tx.execute(sql`update drive_upload set state='cancelled' where id=${upload.id}`);
          await tx.execute(
            sql`update drive_entry set state='deleting' where id=${upload.entry_id} and state='uploading'`,
          );
        });
        const result = await finishDeletes(scope);
        if (result.failures || result.remaining) throw new DriveError("DELETE_PENDING");
      },
      async getDownload({ scope, entryId }) {
        await access(context, scope, "download");
        return authorized(context, scope, false, "download", async (tx, spaceId) => {
          const row = await entry(tx, spaceId, entryId);
          if (row.kind !== "file" || row.state !== "ready" || !row.storage_id)
            throw new DriveError("NOT_FOUND");
          await parents(tx, spaceId, row.parent_id);
          const filename = encodeURIComponent(row.name).replace(
            /[!'()*]/g,
            (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
          );
          const url = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: bucket,
              Key: key(spaceId!, row.storage_id),
              ResponseContentDisposition: `attachment; filename="download"; filename*=UTF-8''${filename}`,
              ResponseContentType: "application/octet-stream",
            }),
            { expiresIn: 300 },
          );
          return { url };
        });
      },
    };
  }

  return {
    client,
    verifyBucket,
    async assertSpaceEmpty(context: Context, scope: DriveScope) {
      await access(context, scope, "delete");
      await locked(scope, false, async (tx, spaceId) => {
        const rows = await tx.execute(
          sql`select id from drive_entry where space_id=${spaceId ?? null} limit 1`,
        );
        if (rows.length) throw new DriveError("CONFLICT");
      });
    },
    async deleteSpace(
      context: Context,
      scope: DriveScope,
      removeEntity?: (tx: DriveTransaction) => Promise<void>,
    ) {
      await access(context, scope, "delete");
      await db
        .transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${scopeKey(scope)}, 0))`,
          );
          await access(context, scope, "delete");
          const [space] = await tx.execute<{ id: string }>(
            sql`select id from drive_space where entity_type=${scope.type} and entity_id=${scope.id}`,
          );
          const spaceId = space?.id;
          const rows = await tx.execute(
            sql`select id from drive_entry where space_id=${spaceId ?? null} limit 1`,
          );
          if (rows.length) throw new DriveError("CONFLICT");
          // Expired staging keys are covered by the mandatory bucket lifecycle policy.
          await tx.execute(sql`delete from drive_upload where space_id=${spaceId ?? null}`);
          await tx.execute(sql`delete from drive_space where id=${spaceId ?? null}`);
          await removeEntity?.(tx);
        })
        .catch(storageError);
    },
    async maintenance({ limit = 100 }: { limit?: number } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new DriveError("INVALID");
      const spaces = await db.execute<{ entity_type: string; entity_id: string }>(
        sql`select s.entity_type,s.entity_id from drive_space s where exists(select 1 from drive_entry e where e.space_id=s.id and e.state='deleting') or exists(select 1 from drive_upload u where u.space_id=s.id and u.expires_at <= now()) order by s.id limit ${limit}`,
      );
      let failures = 0;
      let remaining = limit;
      let spacesProcessed = 0;
      for (const space of spaces) {
        if (!remaining) break;
        spacesProcessed++;
        const scope = { type: space.entity_type, id: space.entity_id };
        try {
          await locked(scope, false, async (tx, spaceId) => {
            const uploads = await tx.execute<Upload>(
              sql`select * from drive_upload where space_id=${spaceId} and expires_at <= now() order by expires_at limit ${remaining}`,
            );
            for (const upload of uploads) {
              remaining--;
              if (upload.state === "active") {
                await tx.execute(
                  sql`update drive_entry set state='deleting' where id=${upload.entry_id} and state='uploading'`,
                );
                await tx.execute(
                  sql`update drive_upload set state='cancelled' where id=${upload.id}`,
                );
              }
              await verifyBucket();
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: key(spaceId!, upload.storage_id, true),
                }),
              );
              // Retain idempotency tombstones, but avoid revisiting cleaned reservations.
              await tx.execute(
                sql`update drive_upload set expires_at='infinity' where id=${upload.id}`,
              );
            }
          });
          if (remaining) {
            const budget = remaining;
            remaining = 0;
            const result = await finishDeletes(scope, budget);
            failures += result.failures;
            remaining = budget - result.processed;
          }
        } catch {
          failures++;
        }
      }
      return { spacesProcessed, operations: limit - remaining, failures };
    },
  };
}

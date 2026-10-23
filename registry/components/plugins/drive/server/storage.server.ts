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
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notExists,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  driveEntries as entries,
  driveSpaces as spaces,
  driveUploads as uploads,
} from "@/components/plugins/drive/server/schema";
import type {
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
  DriveTrashEntry,
  DriveUploadInput,
} from "@/components/plugins/drive/types";
import {
  DEFAULT_MAX_FILE_BYTES,
  DriveError,
  scopeKey,
  folderUploadPath,
  validId,
  validName,
  validScope,
  validSort,
} from "@/components/plugins/drive/utils";
import { lockPlugin, containsPattern } from "@/components/utils/database";
import { storageFilename } from "@/components/utils/storage-filename";

type QueryDb = DriveTransaction;
type Entry = typeof entries.$inferSelect;
const child = alias(entries, "child");
const missingSpace = "00000000-0000-0000-0000-000000000000";
const inSpace = (spaceId: string | undefined) => eq(entries.spaceId, spaceId ?? missingSpace);
const atParent = (id: string | null) =>
  id === null ? isNull(entries.parentId) : eq(entries.parentId, id);
const pageSize = 50;
const uploadLifetime = 15 * 60_000;
function publicEntry(row: Entry): DriveEntry {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind,
    name: row.name,
    size: Number(row.size),
    contentType: row.contentType,
    updatedAt: new Date(row.updatedAt).toISOString(),
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
  const prefix = options.keyPrefix;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const retentionDays = options.trash?.retentionDays ?? 30;
  if (
    !bucket ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*\/drive\/$/.test(prefix) ||
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes < 1 ||
    maxFileBytes > 5_000_000_000 ||
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 365
  )
    throw new DriveError("INVALID");
  const key = (spaceId: string, storageId: string, storageName: string | null, staging = false) => {
    if (storageName !== null && !/^[a-z0-9]+(?:[_-][a-z0-9]+)*\.[a-z0-9]{1,16}$/.test(storageName))
      throw new DriveError("STORAGE");
    return `${prefix}${staging ? "staging" : "objects"}/${spaceId}/${storageId}${storageName ? `/${storageName}` : ""}`;
  };
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
        await lockPlugin(tx, `drive:${scopeKey(scope)}`);
        if (create)
          await tx
            .insert(spaces)
            .values({ id: randomUUID(), entityType: scope.type, entityId: scope.id })
            .onConflictDoNothing();
        const [space] = await tx
          .select({ id: spaces.id })
          .from(spaces)
          .where(and(eq(spaces.entityType, scope.type), eq(spaces.entityId, scope.id)));
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
    const [row] = await tx
      .select()
      .from(entries)
      .where(and(inSpace(spaceId), eq(entries.id, id)));
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
      current = row.parentId;
    }
    return result;
  }
  async function subtree(tx: QueryDb, spaceId: string, id: string) {
    let level = await tx
      .select()
      .from(entries)
      .where(and(inSpace(spaceId), eq(entries.id, id)));
    const result: (Entry & { depth: number })[] = [];
    const seen = new Set<string>();
    for (let depth = 0; level.length; depth++) {
      if (depth > 100 || level.some((row) => seen.has(row.id))) throw new DriveError("INVALID");
      for (const row of level) {
        seen.add(row.id);
        result.push({ ...row, depth });
      }
      const next: Entry[] = [];
      for (let offset = 0; offset < level.length; offset += 1000) {
        const parentIds = level.slice(offset, offset + 1000).map((row) => row.id);
        let after: string | undefined;
        for (;;) {
          const children: Entry[] = await tx
            .select()
            .from(entries)
            .where(
              and(
                inSpace(spaceId),
                inArray(entries.parentId, parentIds),
                after ? gt(entries.id, after) : undefined,
              ),
            )
            .orderBy(entries.id)
            .limit(1000);
          next.push(...children);
          if (children.length < 1000) break;
          after = children.at(-1)!.id;
        }
      }
      level = next;
    }
    return result.sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
  }
  function preview(rows: readonly Entry[]): DriveDeletePreview {
    return {
      token: createHash("sha256")
        .update(JSON.stringify(rows.map((row) => [row.id, row.name, row.state, row.updatedAt])))
        .digest("hex"),
      files: rows.filter((row) => row.kind === "file").length,
      folders: rows.filter((row) => row.kind === "folder").length,
    };
  }
  async function removeObjects(
    tx: QueryDb,
    spaceId: string,
    storageId: string,
    storageName: string | null,
    entryId: string,
  ) {
    // Copies share immutable bytes; only the last reference may remove them.
    const [reference] = await tx
      .select({ id: entries.id })
      .from(entries)
      .where(and(inSpace(spaceId), eq(entries.storageId, storageId), ne(entries.id, entryId)))
      .limit(1);
    if (reference) return;
    await verifyBucket();
    for (const staging of [false, true])
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key(spaceId, storageId, storageName, staging),
        }),
      );
  }
  async function finishDeletes(scope: DriveScope, limit = 100) {
    return locked(scope, false, async (tx, spaceId) => {
      if (!spaceId) return { remaining: 0, failures: 0, processed: 0 };
      let failures = 0;
      const rows = await tx
        .select()
        .from(entries)
        .where(
          and(
            inSpace(spaceId),
            inArray(entries.state, ["deleting", "purging"]),
            notExists(
              tx
                .select({ id: child.id })
                .from(child)
                .where(and(eq(child.spaceId, entries.spaceId), eq(child.parentId, entries.id))),
            ),
          ),
        )
        .orderBy(entries.id)
        .limit(limit);
      for (const row of rows) {
        try {
          if (row.storageId)
            await removeObjects(tx, spaceId, row.storageId, row.storageName, row.id);
          await tx
            .update(uploads)
            .set({ state: "cancelled" })
            .where(
              and(
                eq(uploads.spaceId, spaceId),
                eq(uploads.entryId, row.id),
                eq(uploads.state, "active"),
              ),
            );
          await tx.delete(entries).where(and(eq(entries.id, row.id), inSpace(spaceId)));
        } catch {
          failures++;
        }
      }
      const [remaining] = await tx
        .select({ count: count() })
        .from(entries)
        .where(and(inSpace(spaceId), inArray(entries.state, ["deleting", "purging"])));
      return { remaining: remaining.count, failures, processed: rows.length };
    });
  }
  async function reservation(tx: QueryDb, spaceId: string | undefined, id: string) {
    validId(id);
    const [upload] = await tx
      .select()
      .from(uploads)
      .where(and(eq(uploads.spaceId, spaceId ?? missingSpace), eq(uploads.id, id)));
    if (!upload) throw new DriveError("NOT_FOUND");
    return upload;
  }

  async function prepareUpload(context: Context, input: DriveUploadInput, relativePath?: string) {
    const { scope, parentId, requestId, size } = input;
    await access(context, scope, "upload");
    validId(requestId);
    const path =
      relativePath === undefined ? undefined : folderUploadPath(relativePath, input.name);
    const normalizedPath = path?.join("/");
    const name = validName(input.name);
    const contentType =
      typeof input.contentType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(input.contentType)
        ? input.contentType
        : "application/octet-stream";
    if (!Number.isSafeInteger(size) || size < 0 || size > maxFileBytes)
      throw new DriveError("INVALID");
    await verifyBucket();
    return authorized(context, scope, true, "upload", async (tx, spaceId) => {
      if (path) await access(context, scope, "createFolder");
      const [existing] = await tx.select().from(uploads).where(eq(uploads.id, requestId));
      const fields = { parentId, name, size, contentType, relativePath: normalizedPath };
      let upload = existing;
      if (upload) {
        if (upload.spaceId !== spaceId) throw new DriveError("NOT_FOUND");
        if (
          Object.entries(fields).some(
            ([field, value]) => upload.input[field as keyof typeof fields] !== value,
          )
        )
          throw new DriveError("CONFLICT");
        if (upload.state === "completed") return { id: requestId, completed: true };
        if (upload.state !== "active" || new Date(upload.expiresAt).getTime() <= Date.now())
          throw new DriveError("EXPIRED");
      } else {
        const ancestors = await parents(tx, spaceId, parentId);
        if (ancestors.length + (path?.length ?? 1) - 1 > 100) throw new DriveError("INVALID");
        let destination = parentId;
        for (const folderName of path?.slice(0, -1) ?? []) {
          const [folder] = await tx
            .select()
            .from(entries)
            .where(
              and(
                inSpace(spaceId),
                atParent(destination),
                eq(entries.name, folderName),
                isNull(entries.trashRootId),
              ),
            );
          if (folder) {
            if (folder.kind !== "folder" || folder.state !== "ready")
              throw new DriveError("CONFLICT");
            destination = folder.id;
          } else {
            const id = randomUUID();
            await tx.insert(entries).values({
              id,
              spaceId: spaceId!,
              parentId: destination,
              kind: "folder",
              name: folderName,
              state: "ready",
            });
            destination = id;
          }
        }
        const entryId = randomUUID(),
          storageId = randomUUID(),
          storageName = storageFilename(name, scope.type);
        const expiresAt = new Date(Date.now() + uploadLifetime);
        await tx.insert(entries).values({
          id: entryId,
          spaceId: spaceId!,
          parentId: destination,
          kind: "file",
          name,
          size,
          contentType,
          state: "uploading",
          storageId,
          storageName,
        });
        const [created] = await tx
          .insert(uploads)
          .values({
            id: requestId,
            spaceId: spaceId!,
            entryId,
            storageId,
            storageName,
            input: fields,
            state: "active",
            expiresAt: expiresAt.toISOString(),
          })
          .returning();
        upload = created;
      }
      const row = await entry(tx, spaceId, upload.entryId);
      await parents(tx, spaceId, row.parentId);
      if (row.state !== "uploading") throw new DriveError("CONFLICT");
      const expiresIn = Math.max(
        1,
        Math.min(600, Math.floor((new Date(upload.expiresAt).getTime() - Date.now()) / 1000)),
      );
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key(spaceId!, upload.storageId, upload.storageName, true),
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
  }

  function client(context: Context): DriveClient {
    return {
      ...(options.trash ? trashClient(context) : {}),
      async listSpaces(query) {
        const page = await options.listScopes(context, {
          search: (query.search ?? "").slice(0, 255),
          cursor: query.cursor,
          limit: pageSize,
          sort: validSort(query.sort),
        });
        const items: DriveSpace[] = [];
        for (const item of page.items.slice(0, pageSize)) {
          try {
            items.push({ ...item, ...(await access(context, item.scope)) });
          } catch (error) {
            if (!(error instanceof DriveError) || error.code !== "NOT_FOUND") throw error;
          }
        }
        return { items, nextCursor: page.nextCursor };
      },
      async listEntries({ scope, parentId, search = "", cursor, sort: inputSort }) {
        const sort = validSort(inputSort);
        const column = {
          name: entries.name,
          updatedAt: entries.updatedAt,
          size: entries.size,
          owner: entries.name,
        }[sort.field];
        // Every entry in a space belongs to the same customer.
        const direction = sort.direction === "desc" && sort.field !== "owner" ? desc : asc;
        const space = await access(context, scope);
        const offset = offsetFor(cursor);
        return authorized(context, scope, false, undefined, async (tx, spaceId) => {
          const breadcrumbs = (await parents(tx, spaceId, parentId)).map(({ id, name }) => ({
            id,
            name,
          }));
          const rows = await tx
            .select()
            .from(entries)
            .where(
              and(
                inSpace(spaceId),
                atParent(parentId),
                inArray(entries.state, ["ready", "deleting"]),
                ilike(entries.name, containsPattern(search.slice(0, 255))),
              ),
            )
            .orderBy(desc(entries.kind), direction(column), entries.name, entries.id)
            .limit(pageSize + 1)
            .offset(offset);
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
          await tx.insert(entries).values({
            id: randomUUID(),
            spaceId: spaceId!,
            parentId,
            kind: "folder",
            name: normalized,
            state: "ready",
          });
        });
      },
      async rename({ scope, entryId, name }) {
        await access(context, scope, "rename");
        const normalized = validName(name);
        await authorized(context, scope, false, "rename", async (tx, spaceId) => {
          const row = await entry(tx, spaceId, entryId);
          if (row.state !== "ready") throw new DriveError("CONFLICT");
          await parents(tx, spaceId, row.parentId);
          await tx
            .update(entries)
            .set({ name: normalized, updatedAt: new Date() })
            .where(eq(entries.id, row.id));
        });
      },
      async duplicateEntry({ scope, entryId, name }) {
        await access(context, scope, "upload");
        const normalized = validName(name);
        await authorized(context, scope, false, "upload", async (tx, spaceId) => {
          await access(context, scope, "download");
          await access(context, scope, "createFolder");
          const source = await entry(tx, spaceId, entryId);
          await parents(tx, spaceId, source.parentId);
          const rows = await subtree(tx, spaceId!, source.id);
          if (rows.some((row) => row.state !== "ready")) throw new DriveError("CONFLICT");
          const ids = new Map(rows.map((row) => [row.id, randomUUID()]));
          for (const row of rows.toReversed()) {
            await tx.insert(entries).values({
              id: ids.get(row.id)!,
              spaceId: spaceId!,
              parentId: row.id === entryId ? row.parentId : ids.get(row.parentId!)!,
              kind: row.kind,
              name: row.id === entryId ? normalized : row.name,
              size: row.size,
              contentType: row.contentType,
              state: "ready",
              storageId: row.storageId,
              storageName: row.storageName,
            });
          }
        });
      },
      async previewDelete({ scope, entryId }) {
        await access(context, scope, "delete");
        return authorized(context, scope, false, "delete", async (tx, spaceId) => {
          const row = await entry(tx, spaceId, entryId);
          if (row.trashRootId && row.trashRootId !== entryId) throw new DriveError("NOT_FOUND");
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
          if (root.trashRootId && root.trashRootId !== entryId) throw new DriveError("NOT_FOUND");
          if (!["deleting", "purging"].includes(root.state) && preview(rows).token !== token)
            throw new DriveError("CONFLICT");
          if (
            options.canDelete &&
            !(await options.canDelete(
              context,
              scope,
              rows.map((row) => row.id),
              tx,
            ))
          )
            throw new DriveError("CONFLICT");
          const updatedAt = new Date();
          for (let offset = 0; offset < rows.length; offset += 1000) {
            await tx
              .update(entries)
              .set({ state: root.trashRootId ? "purging" : "deleting", updatedAt })
              .where(
                and(
                  inSpace(spaceId),
                  inArray(
                    entries.id,
                    rows.slice(offset, offset + 1000).map((row) => row.id),
                  ),
                ),
              );
          }
        });
        // Bounded request work; maintenance and explicit retries finish larger trees.
        for (let pass = 0; pass < 10; pass++) {
          const result = await finishDeletes(scope);
          if (!result.remaining) return;
          if (result.failures) break;
        }
        throw new DriveError("DELETE_PENDING");
      },
      prepareUpload: (input) => prepareUpload(context, input),
      prepareFolderUpload: async (input) => {
        folderUploadPath(input.relativePath, input.name);
        return prepareUpload(context, input, input.relativePath);
      },
      async completeUpload({ scope, uploadId }) {
        await access(context, scope, "upload");
        await verifyBucket();
        const completed = await authorized(context, scope, false, "upload", async (tx, spaceId) => {
          const upload = await reservation(tx, spaceId, uploadId);
          if (upload.state === "completed") return upload;
          if (upload.state !== "active" || new Date(upload.expiresAt).getTime() <= Date.now())
            throw new DriveError("EXPIRED");
          const row = await entry(tx, spaceId, upload.entryId);
          if (row.state !== "uploading") throw new DriveError("CONFLICT");
          await parents(tx, spaceId, row.parentId);
          const stagingKey = key(spaceId!, upload.storageId, upload.storageName, true);
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
              Key: key(spaceId!, upload.storageId, upload.storageName),
              CopySource: `${encodeURIComponent(bucket)}/${stagingKey.split("/").map(encodeURIComponent).join("/")}`,
              CopySourceIfMatch: head.ETag,
              MetadataDirective: "REPLACE",
              ContentType: upload.input.contentType,
            }),
          );
          await tx
            .update(entries)
            .set({ state: "ready", updatedAt: new Date() })
            .where(eq(entries.id, row.id));
          await tx.update(uploads).set({ state: "completed" }).where(eq(uploads.id, upload.id));
          return upload;
        });
        // Completion is committed before staging cleanup; lifecycle handles late URL replays.
        await s3
          .send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: key(completed.spaceId, completed.storageId, completed.storageName, true),
            }),
          )
          .catch(() => undefined);
      },
      async cancelUpload({ scope, uploadId }) {
        await access(context, scope, "upload");
        await authorized(context, scope, false, "upload", async (tx, spaceId) => {
          const upload = await reservation(tx, spaceId, uploadId);
          if (upload.state === "completed") return;
          await tx.update(uploads).set({ state: "cancelled" }).where(eq(uploads.id, upload.id));
          await tx
            .update(entries)
            .set({ state: "deleting" })
            .where(and(eq(entries.id, upload.entryId), eq(entries.state, "uploading")));
        });
        const result = await finishDeletes(scope);
        if (result.failures || result.remaining) throw new DriveError("DELETE_PENDING");
      },
      async getDownload({ scope, entryId }) {
        await access(context, scope, "download");
        return authorized(context, scope, false, "download", async (tx, spaceId) => {
          const row = await entry(tx, spaceId, entryId);
          if (row.kind !== "file" || row.state !== "ready" || !row.storageId)
            throw new DriveError("NOT_FOUND");
          await parents(tx, spaceId, row.parentId);
          const filename = encodeURIComponent(row.name).replace(
            /[!'()*]/g,
            (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
          );
          const url = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: bucket,
              Key: key(spaceId!, row.storageId, row.storageName),
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

  function trashClient(
    context: Context,
  ): Pick<DriveClient, "listTrash" | "trashEntry" | "restoreEntry"> {
    return {
      async listTrash({ scope, search = "", cursor }) {
        const space = await access(context, scope);
        const offset = offsetFor(cursor);
        return authorized(context, scope, false, undefined, async (tx, spaceId) => {
          const rows = await tx
            .select()
            .from(entries)
            .where(
              and(
                inSpace(spaceId),
                eq(entries.id, entries.trashRootId),
                inArray(entries.state, ["trashed", "purging"]),
                ilike(entries.name, containsPattern(search.slice(0, 255))),
              ),
            )
            .orderBy(desc(entries.deletedAt), entries.id)
            .limit(pageSize + 1)
            .offset(offset);
          return {
            space,
            items: rows.slice(0, pageSize).map((row): DriveTrashEntry => ({
              ...publicEntry(row),
              state: row.state === "purging" ? "deleting" : "trashed",
              originalParentId: row.originalParentId ?? null,
              originalPath: row.originalPath!,
              deletedAt: new Date(row.deletedAt!).toISOString(),
              expiresAt: new Date(row.expiresAt!).toISOString(),
            })),
            nextCursor: rows.length > pageSize ? String(offset + pageSize) : undefined,
          };
        });
      },
      async trashEntry({ scope, entryId, token }) {
        await access(context, scope, "delete");
        await authorized(context, scope, false, "delete", async (tx, spaceId) => {
          const root = await entry(tx, spaceId, entryId);
          if (root.state === "trashed" && root.trashRootId === root.id) return;
          const rows = await subtree(tx, spaceId!, entryId);
          if (rows.some((row) => row.state !== "ready") || preview(rows).token !== token)
            throw new DriveError("CONFLICT");
          const ancestors = await parents(tx, spaceId, root.parentId);
          if (
            options.canDelete &&
            !(await options.canDelete(
              context,
              scope,
              rows.map((row) => row.id),
              tx,
            ))
          )
            throw new DriveError("CONFLICT");
          // Detach only the root. Descendant IDs, relationships and immutable bytes survive.
          const deletedAt = new Date();
          const expiresAt = new Date(deletedAt.getTime() + retentionDays * 86400000);
          for (let offset = 0; offset < rows.length; offset += 1000) {
            await tx
              .update(entries)
              .set({
                state: "trashed",
                trashRootId: entryId,
                originalParentId: entries.parentId,
                originalPath: ancestors.map((row) => row.name).join("/"),
                deletedAt,
                expiresAt,
                updatedAt: deletedAt,
              })
              .where(
                and(
                  inSpace(spaceId),
                  inArray(
                    entries.id,
                    rows.slice(offset, offset + 1000).map((row) => row.id),
                  ),
                ),
              );
          }
          await tx
            .update(entries)
            .set({ parentId: null })
            .where(and(inSpace(spaceId), eq(entries.id, entryId)));
        });
      },
      async restoreEntry({ scope, entryId, parentId, name }) {
        await access(context, scope, "restore");
        await authorized(context, scope, false, "restore", async (tx, spaceId) => {
          const root = await entry(tx, spaceId, entryId);
          if (root.state !== "trashed" || root.trashRootId !== root.id)
            throw new DriveError("NOT_FOUND");
          if (new Date(root.expiresAt!).getTime() <= Date.now()) throw new DriveError("NOT_FOUND");
          const normalized = name === undefined ? root.name : validName(name);
          if (normalized !== root.name) await access(context, scope, "rename");
          const destination = parentId === undefined ? (root.originalParentId ?? null) : parentId;
          let ancestors: Entry[];
          try {
            ancestors = await parents(tx, spaceId, destination);
          } catch (error) {
            if (error instanceof DriveError && ["NOT_FOUND", "CONFLICT"].includes(error.code))
              throw new DriveError("RESTORE_CONFLICT");
            throw error;
          }
          const rows = await subtree(tx, spaceId!, entryId);
          if (rows.some((row) => row.state !== "trashed" || row.trashRootId !== entryId))
            throw new DriveError("CONFLICT");
          if (
            ancestors.length +
              rows.reduce(
                (depth, row) => Math.max(depth, (row.depth ?? 0) + (row.kind === "folder" ? 1 : 0)),
                0,
              ) >
            100
          )
            throw new DriveError("INVALID");
          const conflicts = await tx
            .select({ id: entries.id })
            .from(entries)
            .where(
              and(
                inSpace(spaceId),
                atParent(destination),
                eq(entries.name, normalized),
                isNull(entries.trashRootId),
              ),
            )
            .limit(1);
          if (conflicts.length) throw new DriveError("RESTORE_CONFLICT");
          await tx
            .update(entries)
            .set({ parentId: destination, name: normalized })
            .where(and(inSpace(spaceId), eq(entries.id, entryId)));
          await tx
            .update(entries)
            .set({
              state: "ready",
              trashRootId: null,
              originalParentId: null,
              originalPath: null,
              deletedAt: null,
              expiresAt: null,
              updatedAt: new Date(),
            })
            .where(and(inSpace(spaceId), eq(entries.trashRootId, entryId)));
        });
      },
    };
  }

  return {
    client,
    verifyBucket,
    /** Trusted server callers must authorize the reference before invoking this method. */
    async readTrustedFile(scope: DriveScope, entryId: string, maxBytes: number) {
      validScope(scope);
      validId(entryId);
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > maxFileBytes)
        throw new DriveError("INVALID");
      const file = await locked(scope, false, async (tx, spaceId) => {
        const row = await entry(tx, spaceId, entryId);
        if (row.kind !== "file" || row.state !== "ready" || !row.storageId)
          throw new DriveError("NOT_FOUND");
        if (Number(row.size) > maxBytes) throw new DriveError("INVALID");
        return {
          key: key(spaceId!, row.storageId, row.storageName),
          contentType: row.contentType,
        };
      });
      try {
        const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: file.key }));
        if (object.ContentLength && object.ContentLength > maxBytes)
          throw new DriveError("INVALID");
        const bytes = await object.Body?.transformToByteArray();
        if (!bytes || bytes.length > maxBytes) throw new DriveError("INVALID");
        return { bytes, contentType: file.contentType };
      } catch (error) {
        storageError(error);
      }
    },
    async assertSpaceEmpty(context: Context, scope: DriveScope) {
      await access(context, scope, "delete");
      await locked(scope, false, async (tx, spaceId) => {
        const rows = await tx
          .select({ id: entries.id })
          .from(entries)
          .where(inSpace(spaceId))
          .limit(1);
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
          await lockPlugin(tx, `drive:${scopeKey(scope)}`);
          await access(context, scope, "delete");
          const [space] = await tx
            .select({ id: spaces.id })
            .from(spaces)
            .where(and(eq(spaces.entityType, scope.type), eq(spaces.entityId, scope.id)));
          const spaceId = space?.id;
          const rows = await tx
            .select({ id: entries.id })
            .from(entries)
            .where(inSpace(spaceId))
            .limit(1);
          if (rows.length) throw new DriveError("CONFLICT");
          // Expired staging keys are covered by the mandatory bucket lifecycle policy.
          await tx.delete(uploads).where(eq(uploads.spaceId, spaceId ?? missingSpace));
          await tx.delete(spaces).where(eq(spaces.id, spaceId ?? missingSpace));
          await removeEntity?.(tx);
        })
        .catch(storageError);
    },
    async maintenance({ limit = 100 }: { limit?: number } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new DriveError("INVALID");
      const pendingSpaces = await db
        .select({ entityType: spaces.entityType, entityId: spaces.entityId })
        .from(spaces)
        .where(
          or(
            exists(
              db
                .select({ id: entries.id })
                .from(entries)
                .where(
                  and(
                    eq(entries.spaceId, spaces.id),
                    inArray(entries.state, ["deleting", "purging"]),
                  ),
                ),
            ),
            options.trash
              ? exists(
                  db
                    .select({ id: entries.id })
                    .from(entries)
                    .where(
                      and(
                        eq(entries.spaceId, spaces.id),
                        eq(entries.state, "trashed"),
                        lte(entries.expiresAt, new Date()),
                      ),
                    ),
                )
              : undefined,
            exists(
              db
                .select({ id: uploads.id })
                .from(uploads)
                .where(
                  and(
                    eq(uploads.spaceId, spaces.id),
                    lte(uploads.expiresAt, new Date().toISOString()),
                  ),
                ),
            ),
          ),
        )
        .orderBy(spaces.id)
        .limit(limit);
      let failures = 0;
      let remaining = limit;
      let spacesProcessed = 0;
      for (const space of pendingSpaces) {
        if (!remaining) break;
        spacesProcessed++;
        const scope = { type: space.entityType, id: space.entityId };
        try {
          await locked(scope, false, async (tx, spaceId) => {
            if (options.trash) {
              const expired = await tx
                .select({ id: entries.id })
                .from(entries)
                .where(
                  and(
                    inSpace(spaceId),
                    eq(entries.id, entries.trashRootId),
                    eq(entries.state, "trashed"),
                    lte(entries.expiresAt, new Date()),
                  ),
                )
                .orderBy(entries.expiresAt, entries.id)
                .limit(remaining);
              for (const root of expired) {
                remaining--;
                await tx
                  .update(entries)
                  .set({ state: "purging", updatedAt: new Date() })
                  .where(
                    and(
                      inSpace(spaceId),
                      eq(entries.trashRootId, root.id),
                      eq(entries.state, "trashed"),
                    ),
                  );
              }
            }
            if (!remaining) return;
            const expiredUploads = await tx
              .select()
              .from(uploads)
              .where(
                and(
                  eq(uploads.spaceId, spaceId ?? missingSpace),
                  lte(uploads.expiresAt, new Date().toISOString()),
                ),
              )
              .orderBy(uploads.expiresAt)
              .limit(remaining);
            for (const upload of expiredUploads) {
              remaining--;
              if (upload.state === "active") {
                await tx
                  .update(entries)
                  .set({ state: "deleting" })
                  .where(and(eq(entries.id, upload.entryId), eq(entries.state, "uploading")));
                await tx
                  .update(uploads)
                  .set({ state: "cancelled" })
                  .where(eq(uploads.id, upload.id));
              }
              await verifyBucket();
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: key(spaceId!, upload.storageId, upload.storageName, true),
                }),
              );
              // Retain idempotency tombstones, but avoid revisiting cleaned reservations.
              await tx
                .update(uploads)
                .set({ expiresAt: "infinity" })
                .where(eq(uploads.id, upload.id));
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

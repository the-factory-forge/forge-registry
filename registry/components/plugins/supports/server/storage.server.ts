import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, asc, count, desc, eq, ilike, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { z } from "zod";

import {
  SUPPORT_MAX_IMAGE_BYTES,
  SUPPORT_PAGE_SIZE,
  SupportsError,
  supportCommentSchema,
  supportCreateSchema,
  supportIdSchema,
  supportImageType,
  supportQuerySchema,
  supportStatusSchema,
} from "@/components/plugins/supports/schema";
import {
  supportsTickets as tickets,
  supportsActivity as activity,
  supportsAttachments as attachments,
  supportsMutations as mutations,
  type SupportAttachmentRecord,
  type SupportTicketRecord,
} from "@/components/plugins/supports/server/schema";
import type {
  SupportAuthor,
  SupportCreateInput,
  SupportCommentInput,
  SupportDetail,
  SupportQuery,
  SupportTicket,
  SupportAttachment,
} from "@/components/plugins/supports/types";
import {
  containsPattern,
  lockPlugin,
  type DatabaseTransaction,
  type PluginDatabase,
} from "@/components/utils/database";
import { storageFilename } from "@/components/utils/storage-filename";

type Permission = "read" | "create" | "comment" | "status" | "upload";
export interface SupportsStorageOptions<Context> {
  db: PluginDatabase;
  s3?: S3Client;
  bucket?: string;
  /** Required <site>/supports/ namespace. Invalid configuration blocks object access only. */
  keyPrefix: string;
  /** Resolve fresh membership, not merely the admin/user role. Anonymous returns null. */
  resolveActor(context: Context): Promise<(SupportAuthor & { kind: "staff" | "customer" }) | null>;
  authorize(context: Context, permission: Permission, ticketId?: string): Promise<boolean>;
}
export interface SupportUploadInput {
  requestId: string;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}
const day = 24 * 60 * 60 * 1000;
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const asset = ({ id, name, contentType, size }: SupportAttachmentRecord): SupportAttachment => ({
  id,
  name,
  contentType,
  size,
});
const ticket = (
  row: SupportTicketRecord,
  files: SupportAttachmentRecord[] = [],
): SupportTicket => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  attachments: files.map(asset),
});

export function createSupportsStorage<Context>(options: SupportsStorageOptions<Context>) {
  const { db } = options;
  async function guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SupportsError) throw error;
      if (error instanceof z.ZodError) throw new SupportsError("INVALID");
      throw new SupportsError("STORAGE");
    }
  }
  async function permit(
    context: Context,
    permission: Permission,
    id?: string,
  ): Promise<SupportAuthor> {
    const actor = await options.resolveActor(context);
    if (
      !actor ||
      actor.kind !== "staff" ||
      !actor.id ||
      !actor.name.trim() ||
      !(await options.authorize(context, permission, id))
    )
      throw new SupportsError("FORBIDDEN");
    return { id: actor.id, name: actor.name };
  }
  function objectStorage() {
    const { s3, bucket, keyPrefix } = options;
    if (!s3 || !bucket?.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*\/supports\/$/.test(keyPrefix))
      throw new SupportsError("STORAGE_NOT_CONFIGURED");
    return { s3, bucket, keyPrefix };
  }
  function objectKey(key: string) {
    const storage = objectStorage();
    if (!key.startsWith(storage.keyPrefix) || key.includes(".."))
      throw new SupportsError("INVALID");
    return storage;
  }
  async function record(tx: DatabaseTransaction, id: string, lock = false) {
    supportIdSchema.parse(id);
    const query = tx.select().from(tickets).where(eq(tickets.id, id));
    const [row] = await (lock ? query.for("update") : query);
    if (!row) throw new SupportsError("NOT_FOUND");
    return row;
  }
  async function claim(
    tx: DatabaseTransaction,
    actorId: string,
    ids: string[],
    ticketId: string,
    activityId: string | null,
  ) {
    for (const id of [...ids].sort()) {
      const [row] = await tx.select().from(attachments).where(eq(attachments.id, id)).for("update");
      if (!row || row.actorId !== actorId) throw new SupportsError("FORBIDDEN");
      if (row.state !== "ready" || row.ticketId || row.expiresAt <= new Date())
        throw new SupportsError("CONFLICT");
      await tx
        .update(attachments)
        .set({ state: "attached", ticketId, activityId, updatedAt: new Date() })
        .where(eq(attachments.id, id));
    }
  }
  async function write(
    context: Context,
    action: "create" | "comment",
    input: SupportCreateInput | SupportCommentInput,
  ) {
    const ticketId = "id" in input ? input.id : undefined;
    const actor = await permit(context, action, ticketId);
    const key = fingerprint([actor.id, input.requestId]);
    const hash = fingerprint([action, input]);
    return db.transaction(async (tx) => {
      await lockPlugin(tx, `supports:mutation:${key}`);
      const [previous] = await tx.select().from(mutations).where(eq(mutations.key, key));
      if (previous) {
        if (previous.fingerprint !== hash) throw new SupportsError("CONFLICT");
        await permit(context, action, previous.ticketId);
        return previous.ticketId;
      }
      let now = new Date();
      let id: string;
      let activityId: string | null = null;
      if ("id" in input) {
        id = input.id;
        const row = await record(tx, id, true);
        await permit(context, "comment", id);
        // Preserve transaction order even when writes share a millisecond or a host clock drifts.
        now = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
        activityId = randomUUID();
        await tx.insert(activity).values({
          id: activityId,
          ticketId: id,
          kind: "comment",
          body: input.body,
          author: actor,
          createdAt: now,
        });
        await tx.update(tickets).set({ updatedAt: now }).where(eq(tickets.id, id));
      } else {
        id = randomUUID();
        await tx.insert(tickets).values({
          id,
          title: input.title,
          description: input.description,
          type: input.type,
          author: actor,
          createdAt: now,
          updatedAt: now,
        });
      }
      await claim(tx, actor.id, input.attachmentIds, id, activityId);
      await tx.insert(mutations).values({ key, fingerprint: hash, ticketId: id });
      return id;
    });
  }
  async function removeObject(id: string) {
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(attachments).where(eq(attachments.id, id)).for("update");
      if (!row || row.ticketId || row.state === "attached" || row.state === "deleted") return;
      if (row.state !== "cleanup" && row.expiresAt > new Date()) return;
      const { s3, bucket } = objectKey(row.key);
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.key }));
      // Keep the reservation tombstone so a late upload retry cannot recreate deleted bytes.
      await tx
        .update(attachments)
        .set({ state: "deleted", updatedAt: new Date() })
        .where(eq(attachments.id, id));
    });
  }
  async function upload(context: Context, raw: SupportUploadInput): Promise<SupportAttachment> {
    return guard(async () => {
      const actor = await permit(context, "upload");
      const { requestId, name, contentType } = z
        .object({
          requestId: supportIdSchema,
          name: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .refine(
              (value) => !Array.from(value).some((character) => character.charCodeAt(0) < 32),
            ),
          contentType: z.string(),
        })
        .parse(raw);
      if (
        !(raw.bytes instanceof Uint8Array) ||
        !raw.bytes.length ||
        raw.bytes.length > SUPPORT_MAX_IMAGE_BYTES ||
        supportImageType(raw.bytes) !== contentType
      )
        throw new SupportsError("INVALID");
      const { s3, bucket, keyPrefix } = objectStorage();
      const hash = fingerprint([
        name,
        contentType,
        createHash("sha256").update(raw.bytes).digest("hex"),
      ]);
      const id = await db.transaction(async (tx) => {
        await lockPlugin(tx, `supports:upload:${fingerprint([actor.id, requestId])}`);
        const [existing] = await tx
          .select()
          .from(attachments)
          .where(and(eq(attachments.actorId, actor.id), eq(attachments.requestId, requestId)));
        if (existing) {
          if (existing.fingerprint !== hash) throw new SupportsError("CONFLICT");
          return existing.id;
        }
        const id = randomUUID();
        await tx.insert(attachments).values({
          id,
          actorId: actor.id,
          requestId,
          fingerprint: hash,
          name,
          contentType,
          size: raw.bytes.length,
          key: `${keyPrefix}${id}/${storageFilename(name, "support", contentType === "image/jpeg" ? "jpg" : contentType.slice(6))}`,
          state: "uploading",
          expiresAt: new Date(Date.now() + day),
        });
        return id;
      });
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(attachments)
          .where(eq(attachments.id, id))
          .for("update");
        if (row.state === "attached" || (row.state === "ready" && row.expiresAt > new Date()))
          return asset(row);
        if (row.state !== "uploading" || row.expiresAt <= new Date())
          throw new SupportsError("CONFLICT");
        await permit(context, "upload");
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: row.key,
            Body: raw.bytes,
            ContentType: contentType,
          }),
        );
        await tx
          .update(attachments)
          .set({ state: "ready", updatedAt: new Date() })
          .where(eq(attachments.id, id));
        return asset(row);
      });
    });
  }
  function client(context: Context) {
    return {
      list: (input: SupportQuery = {}) =>
        guard(async () => {
          await permit(context, "read");
          const { search, page } = supportQuerySchema.parse(input);
          const pattern = containsPattern(search);
          const where = or(ilike(tickets.title, pattern), ilike(tickets.description, pattern));
          const [rows, totals] = await Promise.all([
            db
              .select()
              .from(tickets)
              .where(where)
              .orderBy(desc(tickets.updatedAt), desc(tickets.id))
              .limit(SUPPORT_PAGE_SIZE)
              .offset((page - 1) * SUPPORT_PAGE_SIZE),
            db.select({ total: count() }).from(tickets).where(where),
          ]);
          // Supports is a site-wide staff directory; hosts must authorize read consistently.
          for (const row of rows) await permit(context, "read", row.id);
          return { items: rows.map((row) => ticket(row)), total: totals[0].total };
        }),
      get: (id: string, cursor = "0"): Promise<SupportDetail> =>
        guard(async () => {
          await permit(context, "read", id);
          const offset = z
            .string()
            .regex(/^\d{1,7}$/)
            .transform(Number)
            .parse(cursor);
          const row = await record(db, id);
          const entries = await db
            .select()
            .from(activity)
            .where(eq(activity.ticketId, id))
            .orderBy(asc(activity.createdAt), asc(activity.id))
            .limit(51)
            .offset(offset);
          const page = entries.slice(0, 50);
          const files = await db
            .select()
            .from(attachments)
            .where(
              and(
                eq(attachments.ticketId, id),
                eq(attachments.state, "attached"),
                page.length
                  ? or(
                      isNull(attachments.activityId),
                      inArray(
                        attachments.activityId,
                        page.map((entry) => entry.id),
                      ),
                    )
                  : isNull(attachments.activityId),
              ),
            );
          return {
            ticket: ticket(
              row,
              files.filter((file) => !file.activityId),
            ),
            activity: page.map((entry) => ({
              ...entry,
              createdAt: entry.createdAt.toISOString(),
              attachments: files.filter((file) => file.activityId === entry.id).map(asset),
            })),
            nextCursor: entries.length > 50 ? String(offset + 50) : undefined,
          };
        }),
      create: (input: SupportCreateInput) =>
        guard(async () => {
          const id = await write(context, "create", supportCreateSchema.parse(input));
          return (await client(context).get(id)).ticket;
        }),
      comment: (input: SupportCommentInput) =>
        guard(async () => {
          await write(context, "comment", supportCommentSchema.parse(input));
        }),
      setStatus: (id: string, input: unknown) =>
        guard(async () => {
          const actor = await permit(context, "status", id);
          const status = supportStatusSchema.parse(input);
          await db.transaction(async (tx) => {
            const row = await record(tx, id, true);
            await permit(context, "status", id);
            if (row.status === status) return;
            const now = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
            await tx.update(tickets).set({ status, updatedAt: now }).where(eq(tickets.id, id));
            await tx.insert(activity).values({
              id: randomUUID(),
              ticketId: id,
              kind: "status",
              status,
              author: actor,
              createdAt: now,
            });
          });
        }),
      upload: async ({ requestId, file }: { requestId: string; file: File }) => {
        await permit(context, "upload");
        if (file.size > SUPPORT_MAX_IMAGE_BYTES) throw new SupportsError("INVALID");
        return upload(context, {
          requestId,
          name: file.name,
          contentType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
      },
      cancelUpload: (id: string) =>
        guard(async () => {
          const actor = await permit(context, "upload");
          supportIdSchema.parse(id);
          await db.transaction(async (tx) => {
            const [row] = await tx
              .select()
              .from(attachments)
              .where(eq(attachments.id, id))
              .for("update");
            if (!row || row.actorId !== actor.id) throw new SupportsError("FORBIDDEN");
            if (row.ticketId || row.state === "attached") throw new SupportsError("CONFLICT");
            if (row.state !== "deleted")
              await tx
                .update(attachments)
                .set({ state: "cleanup", updatedAt: new Date() })
                .where(eq(attachments.id, id));
          });
          await removeObject(id);
        }),
      getAttachment: (id: string) =>
        guard(async () => {
          const actor = await permit(context, "read");
          supportIdSchema.parse(id);
          const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
          if (!row) throw new SupportsError("NOT_FOUND");
          if (row.state === "attached" && row.ticketId) await permit(context, "read", row.ticketId);
          else if (row.actorId !== actor.id || row.state !== "ready" || row.expiresAt <= new Date())
            throw new SupportsError("FORBIDDEN");
          const { s3, bucket } = objectKey(row.key);
          return {
            url: await getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket: bucket,
                Key: row.key,
                ResponseContentType: row.contentType,
                ResponseCacheControl: "private, no-store",
                ResponseContentDisposition: "inline",
              }),
              { expiresIn: 300 },
            ),
          };
        }),
    };
  }
  /** Trusted host scheduler only. No browser transport; final attachments never expire. */
  async function maintenance() {
    return guard(async () => {
      objectStorage();
      const rows = await db
        .select()
        .from(attachments)
        .where(
          and(
            isNull(attachments.ticketId),
            ne(attachments.state, "deleted"),
            or(eq(attachments.state, "cleanup"), lt(attachments.expiresAt, new Date())),
          ),
        )
        .orderBy(asc(attachments.updatedAt), asc(attachments.id))
        .limit(50);
      let failed = 0;
      for (const row of rows) {
        try {
          await removeObject(row.id);
        } catch {
          failed++;
          // Rotate failed records so an unavailable object cannot starve later cleanup.
          await db
            .update(attachments)
            .set({ updatedAt: new Date() })
            .where(eq(attachments.id, row.id));
        }
      }
      return { examined: rows.length, failed };
    });
  }
  return { client, upload, maintenance };
}

import { randomUUID } from "node:crypto";

import { and, arrayContains, eq, inArray, notExists } from "drizzle-orm";

import { driveEntries, driveSpaces } from "@/components/plugins/drive/server/schema";
import type { DriveDatabase, DriveTransaction } from "@/components/plugins/drive/server/types";
import type { DriveScope } from "@/components/plugins/drive/types";
import { scopeKey, validId } from "@/components/plugins/drive/utils";
import {
  buildMenu,
  MenuError,
  reorderMenuItems,
  validateCategory,
  validateItem,
  validateLabel,
} from "@/components/plugins/menus/model";
import { menuItems, menuCategories, menuLabels } from "@/components/plugins/menus/server/schema";
import type {
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
} from "@/components/plugins/menus/types";
import { databaseErrorCode } from "@/components/utils/database";
import { lockPlugin } from "@/components/utils/database";

export type MenusDatabase = DriveDatabase;
export interface MenusDrive<Context> {
  readTrustedFile(
    scope: DriveScope,
    entryId: string,
    maxBytes: number,
  ): Promise<{ bytes: Uint8Array; contentType: string }>;
  deleteSpace(
    context: Context,
    scope: DriveScope,
    removeEntity?: (tx: DriveTransaction) => Promise<void>,
  ): Promise<void>;
}
export type MenuAction = "read" | "create" | "edit" | "delete" | "manageTaxonomy";
export interface MenusServiceOptions<Context> {
  db: MenusDatabase;
  drive: MenusDrive<Context>;
  baseLocale: string;
  /** Recheck authorization using the host's fresh server session for each call. */
  authorize: (context: Context, action: MenuAction) => Promise<boolean>;
}

type QueryDb = DriveTransaction;
type ItemRow = typeof menuItems.$inferSelect;
const imageLimit = 10_000_000;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const menuScope = (id: string): DriveScope => ({ type: "menu-item", id });
const itemFromRow = (row: ItemRow): MenuItem => row;

async function allItems(db: QueryDb) {
  const rows = await db.select().from(menuItems).orderBy(menuItems.position, menuItems.id);
  return rows.map(itemFromRow);
}
async function allCategories(db: QueryDb): Promise<MenuCategory[]> {
  return db.select().from(menuCategories).orderBy(menuCategories.position, menuCategories.id);
}
async function allLabels(db: QueryDb): Promise<MenuLabel[]> {
  return db.select().from(menuLabels).orderBy(menuLabels.position, menuLabels.id);
}
async function itemById(db: QueryDb, id: string) {
  validId(id);
  const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id));
  if (!row) throw new MenuError("NOT_FOUND");
  return itemFromRow(row);
}
async function checkReferences(db: QueryDb, input: MenuItemInput) {
  const [category] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(eq(menuCategories.id, input.categoryId));
  if (!category) throw new MenuError("INVALID");
  if (input.labelIds.length) {
    const rows = await db
      .select({ id: menuLabels.id })
      .from(menuLabels)
      .where(inArray(menuLabels.id, input.labelIds));
    if (rows.length !== input.labelIds.length) throw new MenuError("INVALID");
  }
}
function imageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
async function safe<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof MenuError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "INVALID") throw new MenuError("INVALID");
      if (error.code === "NOT_FOUND") throw new MenuError("NOT_FOUND");
      if (error.code === "FORBIDDEN") throw new MenuError("FORBIDDEN");
      if (error.code === "CONFLICT") throw new MenuError("IN_USE");
    }
    if (databaseErrorCode(error) === "23503") throw new MenuError("IN_USE");
    throw new MenuError("STORAGE");
  }
}

/** Wire this into Drive's canDelete option to protect selected menu images. */
export async function menuImageDeleteGuard(
  _context: unknown,
  scope: DriveScope,
  entryIds: string[],
  tx: DriveTransaction,
) {
  if (scope.type !== "menu-item" || !entryIds.length) return true;
  const rows = await tx
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.id, scope.id), inArray(menuItems.imageEntryId, entryIds)))
    .limit(1);
  return rows.length === 0;
}

export function createMenusService<Context>({
  db,
  drive,
  baseLocale,
  authorize,
}: MenusServiceOptions<Context>) {
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(baseLocale)) throw new MenuError("INVALID");
  async function permit(context: Context, action: MenuAction) {
    if (!(await authorize(context, action))) throw new MenuError("FORBIDDEN");
  }
  async function verifyImage(id: string, imageEntryId: string) {
    validId(imageEntryId);
    const file = await drive.readTrustedFile(menuScope(id), imageEntryId, imageLimit);
    if (!imageTypes.includes(file.contentType) || imageType(file.bytes) !== file.contentType)
      throw new MenuError("INVALID");
  }
  async function taxonomyLock(tx: QueryDb) {
    await lockPlugin(tx, "menu-taxonomy");
  }
  function client(context: Context): MenusClient {
    return {
      list: () =>
        safe(async () => {
          await permit(context, "read");
          return allItems(db);
        }),
      get: (id) =>
        safe(async () => {
          await permit(context, "read");
          return itemById(db, id);
        }),
      categories: () =>
        safe(async () => {
          await permit(context, "read");
          return allCategories(db);
        }),
      labels: () =>
        safe(async () => {
          await permit(context, "read");
          return allLabels(db);
        }),
      create: (input) =>
        safe(async () => {
          await permit(context, "create");
          const value = validateItem(input, baseLocale);
          if (value.visible || value.imageEntryId) throw new MenuError("INVALID");
          const id = randomUUID();
          await db.transaction(async (tx) => {
            await taxonomyLock(tx);
            await checkReferences(tx, value);
            await tx
              .insert(menuItems)
              .values({ ...value, id, version: 1, visible: false, imageEntryId: null });
          });
          return itemById(db, id);
        }),
      save: (id, version, input) =>
        safe(async () => {
          await permit(context, "edit");
          validId(id);
          const value = validateItem(input, baseLocale);
          const preserveSpiceLevel = input.spiceLevel === undefined;
          const preserveSizes = input.sizes === undefined;
          if (value.imageEntryId) await verifyImage(id, value.imageEntryId);
          return db.transaction(async (tx) => {
            await lockPlugin(tx, `drive:${scopeKey(menuScope(id))}`);
            await taxonomyLock(tx);
            const current = await itemById(tx, id);
            if (current.version !== version) throw new MenuError("CONFLICT");
            await checkReferences(tx, value);
            if (value.imageEntryId) {
              const [entry] = await tx
                .select({ id: driveEntries.id })
                .from(driveEntries)
                .innerJoin(driveSpaces, eq(driveSpaces.id, driveEntries.spaceId))
                .where(
                  and(
                    eq(driveSpaces.entityType, "menu-item"),
                    eq(driveSpaces.entityId, id),
                    eq(driveEntries.id, value.imageEntryId),
                    eq(driveEntries.kind, "file"),
                    eq(driveEntries.state, "ready"),
                  ),
                );
              if (!entry) throw new MenuError("INVALID");
            }
            const sizes = preserveSizes ? (current.sizes ?? []) : value.sizes;
            await tx
              .update(menuItems)
              .set({
                ...value,
                version: current.version + 1,
                priceMinor: sizes[0]?.priceMinor ?? value.priceMinor,
                sizes,
                spiceLevel: preserveSpiceLevel ? (current.spiceLevel ?? 0) : value.spiceLevel,
              })
              .where(eq(menuItems.id, id));
            return itemById(tx, id);
          });
        }),
      reorder: (order) =>
        safe(async () => {
          await permit(context, "edit");
          return db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const rows = await tx.select().from(menuItems).orderBy(menuItems.id).for("update");
            const items = rows.map(itemFromRow);
            const ordered = reorderMenuItems(items, order);
            const versions = new Map(items.map((item) => [item.id, item.version]));
            for (const item of ordered) {
              if (item.version !== versions.get(item.id)) {
                await tx
                  .update(menuItems)
                  .set({ position: item.position, version: item.version })
                  .where(eq(menuItems.id, item.id));
              }
            }
            return ordered;
          });
        }),
      remove: (id) =>
        safe(async () => {
          await permit(context, "delete");
          validId(id);
          await itemById(db, id);
          await drive.deleteSpace(context, menuScope(id), async (tx) => {
            await tx.delete(menuItems).where(eq(menuItems.id, id));
          });
        }),
      saveCategory: (input) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          const value = validateCategory(input, baseLocale);
          const id = input.id ?? randomUUID();
          validId(id);
          if (input.id) {
            const rows = await db
              .update(menuCategories)
              .set(value)
              .where(eq(menuCategories.id, id))
              .returning({ id: menuCategories.id });
            if (!rows.length) throw new MenuError("NOT_FOUND");
          } else await db.insert(menuCategories).values({ ...value, id });
          const [row] = await db.select().from(menuCategories).where(eq(menuCategories.id, id));
          return row;
        }),
      removeCategory: (id) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          validId(id);
          const rows = await db
            .delete(menuCategories)
            .where(
              and(
                eq(menuCategories.id, id),
                notExists(
                  db
                    .select({ id: menuItems.id })
                    .from(menuItems)
                    .where(eq(menuItems.categoryId, id)),
                ),
              ),
            )
            .returning({ id: menuCategories.id });
          if (!rows.length) {
            const existing = await db
              .select({ id: menuCategories.id })
              .from(menuCategories)
              .where(eq(menuCategories.id, id));
            throw new MenuError(existing.length ? "IN_USE" : "NOT_FOUND");
          }
        }),
      saveLabel: (input) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          const value = validateLabel(input, baseLocale);
          const id = input.id ?? randomUUID();
          validId(id);
          if (input.id) {
            const rows = await db
              .update(menuLabels)
              .set({ ...value, icon: input.icon === undefined ? undefined : value.icon })
              .where(eq(menuLabels.id, id))
              .returning({ id: menuLabels.id });
            if (!rows.length) throw new MenuError("NOT_FOUND");
          } else await db.insert(menuLabels).values({ ...value, id });
          const [row] = await db.select().from(menuLabels).where(eq(menuLabels.id, id));
          return row;
        }),
      removeLabel: (id) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          validId(id);
          await db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const rows = await tx
              .delete(menuLabels)
              .where(
                and(
                  eq(menuLabels.id, id),
                  notExists(
                    tx
                      .select({ id: menuItems.id })
                      .from(menuItems)
                      .where(arrayContains(menuItems.labelIds, [id])),
                  ),
                ),
              )
              .returning({ id: menuLabels.id });
            if (!rows.length) {
              const existing = await tx
                .select({ id: menuLabels.id })
                .from(menuLabels)
                .where(eq(menuLabels.id, id));
              throw new MenuError(existing.length ? "IN_USE" : "NOT_FOUND");
            }
          });
        }),
    };
  }
  return {
    client,
    publicMenu: (locale: string) =>
      safe(async () =>
        buildMenu(
          await allItems(db),
          await allCategories(db),
          await allLabels(db),
          locale,
          baseLocale,
        ),
      ),
    readPublicImage: (id: string) =>
      safe(async () => {
        const item = await itemById(db, id);
        if (!item.visible || !item.imageEntryId) throw new MenuError("NOT_FOUND");
        const file = await drive.readTrustedFile(menuScope(id), item.imageEntryId, imageLimit);
        if (!imageTypes.includes(file.contentType) || imageType(file.bytes) !== file.contentType)
          throw new MenuError("NOT_FOUND");
        return new Response(new Uint8Array(file.bytes), {
          headers: {
            "Content-Type": file.contentType,
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          },
        });
      }),
  };
}

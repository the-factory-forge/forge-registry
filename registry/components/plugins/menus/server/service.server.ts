import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type { DriveDatabase, DriveTransaction } from "@/components/plugins/drive/server/types";
import type { DriveScope } from "@/components/plugins/drive/types";
import { scopeKey, validId } from "@/components/plugins/drive/utils";
import {
  buildMenu,
  MenuError,
  validateCategory,
  validateItem,
  validateLabel,
} from "@/components/plugins/menus/model";
import type {
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
} from "@/components/plugins/menus/types";

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

type QueryDb = Pick<MenusDatabase, "execute">;
type ItemRow = {
  id: string;
  version: number;
  category_id: string;
  price_minor: number;
  position: number;
  visible: boolean;
  sold_out: boolean;
  image_entry_id: string | null;
  label_ids: string[];
  translations: MenuItem["translations"];
};
type CategoryRow = { id: string; position: number; translations: MenuCategory["translations"] };
type LabelRow = {
  id: string;
  kind: MenuLabel["kind"];
  position: number;
  translations: MenuLabel["translations"];
};
const imageLimit = 10_000_000;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const menuScope = (id: string): DriveScope => ({ type: "menu-item", id });
const itemFromRow = (row: ItemRow): MenuItem => ({
  id: row.id,
  version: row.version,
  categoryId: row.category_id,
  priceMinor: row.price_minor,
  position: row.position,
  visible: row.visible,
  soldOut: row.sold_out,
  imageEntryId: row.image_entry_id,
  labelIds: row.label_ids,
  translations: row.translations,
});

async function allItems(db: QueryDb) {
  const rows = await db.execute<ItemRow>(sql`select * from menu_item order by position,id`);
  return rows.map(itemFromRow);
}
async function allCategories(db: QueryDb): Promise<MenuCategory[]> {
  return db.execute<CategoryRow>(sql`select * from menu_category order by position,id`);
}
async function allLabels(db: QueryDb): Promise<MenuLabel[]> {
  return db.execute<LabelRow>(sql`select * from menu_label order by position,id`);
}
async function itemById(db: QueryDb, id: string) {
  validId(id);
  const [row] = await db.execute<ItemRow>(sql`select * from menu_item where id=${id}`);
  if (!row) throw new MenuError("NOT_FOUND");
  return itemFromRow(row);
}
async function checkReferences(db: QueryDb, input: MenuItemInput) {
  const [category] = await db.execute(
    sql`select id from menu_category where id=${input.categoryId}`,
  );
  if (!category) throw new MenuError("INVALID");
  if (input.labelIds.length) {
    const rows = await db.execute<{ id: string }>(
      sql`select id from menu_label where id in (${sql.join(
        input.labelIds.map((id) => sql`${id}`),
        sql`,`,
      )})`,
    );
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
    if (error && typeof error === "object" && "code" in error && error.code === "23503")
      throw new MenuError("IN_USE");
    throw new MenuError("STORAGE");
  }
}

/** Wire this into Drive's canDelete option to protect selected menu images. */
export async function menuImageDeleteGuard(
  _context: unknown,
  scope: DriveScope,
  entryIds: string[],
  tx: Pick<DriveTransaction, "execute">,
) {
  if (scope.type !== "menu-item" || !entryIds.length) return true;
  const rows = await tx.execute(
    sql`select id from menu_item where id=${scope.id} and image_entry_id in (${sql.join(
      entryIds.map((id) => sql`${id}`),
      sql`,`,
    )}) limit 1`,
  );
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('menu-taxonomy',0))`);
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
            await tx.execute(sql`insert into menu_item (id,version,category_id,price_minor,position,visible,sold_out,image_entry_id,label_ids,translations)
            values (${id},1,${value.categoryId},${value.priceMinor},${value.position},false,${value.soldOut},null,${JSON.stringify(value.labelIds)}::jsonb,${JSON.stringify(value.translations)}::jsonb)`);
          });
          return itemById(db, id);
        }),
      save: (id, version, input) =>
        safe(async () => {
          await permit(context, "edit");
          validId(id);
          const value = validateItem(input, baseLocale);
          if (value.imageEntryId) await verifyImage(id, value.imageEntryId);
          return db.transaction(async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${scopeKey(menuScope(id))},0))`,
            );
            await taxonomyLock(tx);
            const current = await itemById(tx, id);
            if (current.version !== version) throw new MenuError("CONFLICT");
            await checkReferences(tx, value);
            if (value.imageEntryId) {
              const [entry] =
                await tx.execute(sql`select e.id from drive_entry e join drive_space s on s.id=e.space_id
              where s.entity_type='menu-item' and s.entity_id=${id} and e.id=${value.imageEntryId} and e.kind='file' and e.state='ready'`);
              if (!entry) throw new MenuError("INVALID");
            }
            await tx.execute(sql`update menu_item set version=version+1,category_id=${value.categoryId},price_minor=${value.priceMinor},
            position=${value.position},visible=${value.visible},sold_out=${value.soldOut},image_entry_id=${value.imageEntryId},
            label_ids=${JSON.stringify(value.labelIds)}::jsonb,translations=${JSON.stringify(value.translations)}::jsonb where id=${id}`);
            return itemById(tx, id);
          });
        }),
      remove: (id) =>
        safe(async () => {
          await permit(context, "delete");
          validId(id);
          await itemById(db, id);
          await drive.deleteSpace(context, menuScope(id), async (tx) => {
            await tx.execute(sql`delete from menu_item where id=${id}`);
          });
        }),
      saveCategory: (input) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          const value = validateCategory(input, baseLocale);
          const id = input.id ?? randomUUID();
          validId(id);
          if (input.id) {
            const rows = await db.execute(
              sql`update menu_category set position=${value.position},translations=${JSON.stringify(value.translations)}::jsonb where id=${id} returning id`,
            );
            if (!rows.length) throw new MenuError("NOT_FOUND");
          } else
            await db.execute(
              sql`insert into menu_category (id,position,translations) values (${id},${value.position},${JSON.stringify(value.translations)}::jsonb)`,
            );
          const [row] = await db.execute<CategoryRow>(
            sql`select * from menu_category where id=${id}`,
          );
          return row;
        }),
      removeCategory: (id) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          validId(id);
          const rows = await db.execute(
            sql`delete from menu_category where id=${id} and not exists (select 1 from menu_item where category_id=${id}) returning id`,
          );
          if (!rows.length) {
            const existing = await db.execute(sql`select id from menu_category where id=${id}`);
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
            const rows = await db.execute(
              sql`update menu_label set kind=${value.kind},position=${value.position},translations=${JSON.stringify(value.translations)}::jsonb where id=${id} returning id`,
            );
            if (!rows.length) throw new MenuError("NOT_FOUND");
          } else
            await db.execute(
              sql`insert into menu_label (id,kind,position,translations) values (${id},${value.kind},${value.position},${JSON.stringify(value.translations)}::jsonb)`,
            );
          const [row] = await db.execute<LabelRow>(sql`select * from menu_label where id=${id}`);
          return row;
        }),
      removeLabel: (id) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          validId(id);
          await db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const rows = await tx.execute(
              sql`delete from menu_label where id=${id} and not exists (select 1 from menu_item where label_ids ? ${id}) returning id`,
            );
            if (!rows.length) {
              const existing = await tx.execute(sql`select id from menu_label where id=${id}`);
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

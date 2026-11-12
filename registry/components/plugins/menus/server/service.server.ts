import { randomUUID } from "node:crypto";

import { and, arrayContains, eq, inArray, isNull, notExists } from "drizzle-orm";
import { z } from "zod";

import { driveEntries, driveSpaces } from "@/components/plugins/drive/server/schema";
import type { DriveDatabase, DriveTransaction } from "@/components/plugins/drive/server/types";
import type { DriveScope } from "@/components/plugins/drive/types";
import { scopeKey } from "@/components/plugins/drive/utils";
import {
  buildMenu,
  buildMenuCard,
  isMenuCardPublic,
  menuCardInputSchema,
  menuItemGroupOrderSchema,
  nextWeekDates,
  placeMenuItems,
  validateTranslations,
  MenuError,
  menuCategoryInputSchema,
  menuLabelInputSchema,
  menuOrderSchema,
  parseMenuInput,
  reorderMenuItems,
  validateCategory,
  validateItem,
  validateLabel,
  visibleMenuCategoryIds,
  weeklyCourses,
} from "@/components/plugins/menus/model";
import {
  menuCards,
  menuCardSections,
  menuItems,
  menuCategories,
  menuLabels,
} from "@/components/plugins/menus/server/schema";
import type {
  MenuCard,
  MenuCardsClient,
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
  WeeklySection,
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
  /** Required only when deleting a category together with its dishes. */
  deleteSpaces?(
    context: Context,
    scopes: DriveScope[],
    removeEntities?: (tx: DriveTransaction) => Promise<void>,
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

const idSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const versionSchema = z.number().int().positive();
const cardVersionSchema = z.object({ id: idSchema, version: versionSchema });
const removalScopeSchema = z.union([
  z.object({ categoryId: z.null(), version: versionSchema }),
  z.object({ menuId: idSchema, version: versionSchema }),
]);
const categoryRemovalSchema = z.object({
  deleteItems: z.boolean().default(false),
  items: z.array(cardVersionSchema).max(1500).optional(),
});
const categorySchema = menuCategoryInputSchema
  .extend({
    id: idSchema.optional(),
    version: versionSchema.optional(),
    menu: cardVersionSchema.optional(),
  })
  .refine(({ id, version, menu }) => (id ? !menu : version === undefined));
const labelSchema = menuLabelInputSchema.extend({ id: idSchema.optional() });
const validId = (id: unknown) => parseMenuInput(idSchema, id);

type QueryDb = DriveTransaction;
type ItemRow = typeof menuItems.$inferSelect;
const imageLimit = 10_000_000;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const menuScope = (id: string): DriveScope => ({ type: "menu-item", id });
const itemFromRow = (row: ItemRow): MenuItem => row;
const weeklyCourseNames = { starter: "Starters", main: "Main courses", dessert: "Desserts" };

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
async function allCards(db: QueryDb, id?: string): Promise<MenuCard[]> {
  const rows = await db
    .select({ card: menuCards, categoryId: menuCardSections.categoryId })
    .from(menuCards)
    .leftJoin(menuCardSections, eq(menuCardSections.menuId, menuCards.id))
    .where(id ? eq(menuCards.id, id) : undefined)
    .orderBy(menuCards.position, menuCards.id, menuCardSections.position);
  const cards = new Map<string, MenuCard>();
  for (const { card: record, categoryId } of rows) {
    const { copyRequestId: _request, copySourceId: _source, currencyLabel, ...card } = record;
    let menu = cards.get(card.id);
    if (!menu) {
      menu = { ...card, ...(currencyLabel && { currencyLabel }), categoryIds: [] };
      cards.set(card.id, menu);
    }
    if (categoryId) menu.categoryIds.push(categoryId);
  }
  return [...cards.values()];
}

async function cardById(db: QueryDb, id: string) {
  validId(id);
  const [card] = await allCards(db, id);
  if (!card) throw new MenuError("NOT_FOUND");
  return card;
}

async function replaceSections(tx: QueryDb, id: string, categoryIds: string[]) {
  await tx.delete(menuCardSections).where(eq(menuCardSections.menuId, id));
  if (categoryIds.length)
    await tx
      .insert(menuCardSections)
      .values(categoryIds.map((categoryId, position) => ({ menuId: id, categoryId, position })));
}

async function hasMenuSections(db: QueryDb) {
  try {
    await db.select({ menuId: menuCardSections.menuId }).from(menuCardSections).limit(0);
    return true;
  } catch (error) {
    if (databaseErrorCode(error) === "42P01") return false;
    throw error;
  }
}

function validateWeeklySections(categoryIds: string[], sections: WeeklySection[]) {
  if (
    categoryIds.length !== sections.length ||
    new Set(sections.map(({ categoryId }) => categoryId)).size !== sections.length ||
    new Set(sections.map(({ day, course }) => `${day}:${course}`)).size !== sections.length ||
    sections.some(({ categoryId }) => !categoryIds.includes(categoryId))
  )
    throw new MenuError("INVALID");
}

async function itemById(db: QueryDb, id: string) {
  validId(id);
  const [row] = await db.select().from(menuItems).where(eq(menuItems.id, id));
  if (!row) throw new MenuError("NOT_FOUND");
  return itemFromRow(row);
}
async function checkReferences(db: QueryDb, input: MenuItemInput) {
  if (input.categoryId !== null) {
    const [category] = await db
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(eq(menuCategories.id, input.categoryId));
    if (!category) throw new MenuError("INVALID");
  }
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
      listUnassigned: () =>
        safe(async () => {
          await permit(context, "read");
          return db
            .select()
            .from(menuItems)
            .where(isNull(menuItems.categoryId))
            .orderBy(menuItems.position, menuItems.id);
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
      create: (input, createOptions) =>
        safe(async () => {
          await permit(context, "create");
          const value = validateItem(input, baseLocale);
          if (value.imageEntryId || (value.visible && createOptions?.visibleOnCreate !== true))
            throw new MenuError("INVALID");
          if (value.visible) await permit(context, "edit");
          const id = randomUUID();
          await db.transaction(async (tx) => {
            await taxonomyLock(tx);
            await checkReferences(tx, value);
            await tx.insert(menuItems).values({ ...value, id, version: 1 });
          });
          return itemById(db, id);
        }),
      save: (id, version, input) =>
        safe(async () => {
          validId(id);
          parseMenuInput(z.number().int().positive(), version);
          await permit(context, "edit");
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
          order = parseMenuInput(menuOrderSchema, order);
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
      remove: (id, inputScope) =>
        safe(async () => {
          await permit(context, "delete");
          validId(id);
          const scope =
            inputScope === undefined ? undefined : parseMenuInput(removalScopeSchema, inputScope);
          await itemById(db, id);
          let domainError: unknown;
          try {
            await drive.deleteSpace(context, menuScope(id), async (tx) => {
              try {
                if (scope) {
                  await taxonomyLock(tx);
                  const item = await itemById(tx, id);
                  if (item.version !== scope.version) throw new MenuError("CONFLICT");
                  if ("menuId" in scope) {
                    if (item.categoryId === null) throw new MenuError("CONFLICT");
                    const uses = await tx
                      .select({ menuId: menuCardSections.menuId })
                      .from(menuCardSections)
                      .where(eq(menuCardSections.categoryId, item.categoryId));
                    if (uses.length !== 1 || uses[0].menuId !== scope.menuId)
                      throw new MenuError("CONFLICT");
                  } else if (item.categoryId !== null) throw new MenuError("CONFLICT");
                }
                await tx.delete(menuItems).where(eq(menuItems.id, id));
              } catch (error) {
                domainError = error;
                throw error;
              }
            });
          } catch (error) {
            throw domainError ?? error;
          }
        }),
      saveCategory: (input) =>
        safe(async () => {
          input = parseMenuInput(categorySchema, input);
          await permit(context, "manageTaxonomy");
          const value = validateCategory(input, baseLocale);
          const id = input.id ?? randomUUID();
          // A missing optional table must be detected before opening the write transaction.
          const checkSharing =
            !!input.id && input.version === undefined && (await hasMenuSections(db));
          return db.transaction(async (tx) => {
            await taxonomyLock(tx);
            if (input.id) {
              const [current] = await tx
                .select()
                .from(menuCategories)
                .where(eq(menuCategories.id, id));
              if (!current) throw new MenuError("NOT_FOUND");
              if (input.version !== undefined && current.version !== input.version)
                throw new MenuError("CONFLICT");
              if (checkSharing) {
                const links = await tx
                  .select({ menuId: menuCardSections.menuId })
                  .from(menuCardSections)
                  .where(eq(menuCardSections.categoryId, id))
                  .limit(2);
                if (links.length > 1) throw new MenuError("CONFLICT");
              }
              const [saved] = await tx
                .update(menuCategories)
                .set({ ...value, version: current.version + 1 })
                .where(eq(menuCategories.id, id))
                .returning();
              return saved;
            }
            const menu = input.menu ? await cardById(tx, input.menu.id) : undefined;
            if (menu && menu.version !== input.menu?.version) throw new MenuError("CONFLICT");
            if (menu?.kind === "weekly" || (menu?.categoryIds.length ?? 0) >= 500)
              throw new MenuError("INVALID");
            const [saved] = await tx
              .insert(menuCategories)
              .values({ ...value, id })
              .returning();
            if (menu) {
              await replaceSections(tx, menu.id, [...menu.categoryIds, id]);
              await tx
                .update(menuCards)
                .set({ version: menu.version + 1 })
                .where(eq(menuCards.id, menu.id));
            }
            return saved;
          });
        }),
      removeCategory: (id, cardVersion, options) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          validId(id);
          const menu =
            cardVersion === undefined ? undefined : parseMenuInput(cardVersionSchema, cardVersion);
          const removal = parseMenuInput(
            categoryRemovalSchema,
            options === undefined ? {} : options,
          );
          if (
            removal.items &&
            new Set(removal.items.map((item) => item.id)).size !== removal.items.length
          )
            throw new MenuError("INVALID");
          if (removal.items?.length) await permit(context, removal.deleteItems ? "delete" : "edit");
          // Flat clients can still use Menus without the optional composition tables.
          const checkSharing = await hasMenuSections(db);
          const remove = async (tx: QueryDb) => {
            await taxonomyLock(tx);
            const [category] = await tx
              .select({ id: menuCategories.id })
              .from(menuCategories)
              .where(eq(menuCategories.id, id));
            if (!category) throw new MenuError("NOT_FOUND");
            if (checkSharing) {
              const uses = await tx
                .select({ menuId: menuCardSections.menuId })
                .from(menuCardSections)
                .where(eq(menuCardSections.categoryId, id));
              if (uses.some((use) => use.menuId !== menu?.id)) throw new MenuError("IN_USE");
            }
            if (menu) {
              const current = await cardById(tx, menu.id);
              if (current.version !== menu.version || !current.categoryIds.includes(id))
                throw new MenuError("CONFLICT");
              if (current.kind === "weekly") throw new MenuError("IN_USE");
            }
            const dishes = await tx
              .select()
              .from(menuItems)
              .where(eq(menuItems.categoryId, id))
              .for("update");
            if (!removal.items && dishes.length) throw new MenuError("IN_USE");
            const versions = new Map(removal.items?.map((item) => [item.id, item.version]));
            if (
              removal.items &&
              (dishes.length !== removal.items.length ||
                dishes.some((dish) => versions.get(dish.id) !== dish.version))
            )
              throw new MenuError("CONFLICT");
            if (removal.deleteItems) await tx.delete(menuItems).where(eq(menuItems.categoryId, id));
            else
              for (const dish of dishes) {
                await tx
                  .update(menuItems)
                  .set({ categoryId: null, version: dish.version + 1 })
                  .where(eq(menuItems.id, dish.id));
              }
            if (menu) {
              await tx
                .delete(menuCardSections)
                .where(
                  and(eq(menuCardSections.menuId, menu.id), eq(menuCardSections.categoryId, id)),
                );
              await tx
                .update(menuCards)
                .set({ version: menu.version + 1 })
                .where(eq(menuCards.id, menu.id));
            }
            await tx.delete(menuCategories).where(eq(menuCategories.id, id));
          };
          if (removal.deleteItems && removal.items?.length) {
            // Older adapters remain usable, but cannot perform non-atomic batch deletion.
            if (!drive.deleteSpaces) throw new MenuError("STORAGE");
            let domainError: unknown;
            try {
              await drive.deleteSpaces(
                context,
                removal.items.map((item) => menuScope(item.id)),
                async (tx) => {
                  try {
                    await remove(tx);
                  } catch (error) {
                    domainError = error;
                    throw error;
                  }
                },
              );
            } catch (error) {
              throw domainError ?? error;
            }
          } else await db.transaction(remove);
        }),
      saveLabel: (input) =>
        safe(async () => {
          input = parseMenuInput(labelSchema, input);
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
  function cardsClient(context: Context): MenuCardsClient {
    return {
      listCards: () =>
        safe(async () => {
          await permit(context, "read");
          return allCards(db);
        }),
      listItems: (id) =>
        safe(async () => {
          await permit(context, "read");
          const card = await cardById(db, id);
          if (!card.categoryIds.length) return [];
          return db
            .select()
            .from(menuItems)
            .where(inArray(menuItems.categoryId, card.categoryIds))
            .orderBy(menuItems.position, menuItems.id);
        }),
      saveCard: (input) =>
        safe(async () => {
          await permit(context, "manageTaxonomy");
          const {
            id: inputId,
            version,
            categoryIds: submittedCategories,
            ...card
          } = parseMenuInput(menuCardInputSchema, input);
          validateTranslations(card.translations, baseLocale, true);
          return db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const id = inputId ?? randomUUID();
            const current = inputId ? await cardById(tx, inputId) : undefined;
            if (current && current.version !== version) throw new MenuError("CONFLICT");
            const kind = card.kind ?? current?.kind ?? "standard";
            if (current && current.kind !== kind) throw new MenuError("INVALID");
            const categoryIds = [...submittedCategories];
            const weekdays = [...(card.weekdays ?? current?.weekdays ?? [])].sort((a, b) => a - b);
            const weeklySections = [...(card.weeklySections ?? current?.weeklySections ?? [])];
            if (kind === "weekly") {
              if (!card.startDate || !card.endDate || !weekdays.length)
                throw new MenuError("INVALID");
              validateWeeklySections(categoryIds, weeklySections);
              // Weekday changes retain existing course categories and their dishes.
              for (const section of current?.weeklySections ?? []) {
                if (
                  !weeklySections.some(
                    ({ categoryId, day, course }) =>
                      categoryId === section.categoryId &&
                      day === section.day &&
                      course === section.course,
                  )
                )
                  throw new MenuError("INVALID");
              }
              const categories = [];
              for (const day of weekdays) {
                for (const course of weeklyCourses) {
                  if (
                    weeklySections.some(
                      (section) => section.day === day && section.course === course,
                    )
                  )
                    continue;
                  const categoryId = randomUUID();
                  categories.push({
                    id: categoryId,
                    position: categoryIds.length,
                    translations: { [baseLocale]: weeklyCourseNames[course] },
                  });
                  categoryIds.push(categoryId);
                  weeklySections.push({ categoryId, day, course });
                }
              }
              if (categories.length) await tx.insert(menuCategories).values(categories);
            } else if (weekdays.length || weeklySections.length) {
              throw new MenuError("INVALID");
            }
            if (categoryIds.length) {
              const linked = await tx
                .select({ id: menuCategories.id })
                .from(menuCategories)
                .where(inArray(menuCategories.id, categoryIds));
              if (linked.length !== categoryIds.length) throw new MenuError("INVALID");
              const uses = await tx
                .select({ menuId: menuCardSections.menuId, kind: menuCards.kind })
                .from(menuCardSections)
                .innerJoin(menuCards, eq(menuCards.id, menuCardSections.menuId))
                .where(inArray(menuCardSections.categoryId, categoryIds));
              if (
                uses.some(
                  (use) => use.menuId !== id && (kind === "weekly" || use.kind === "weekly"),
                )
              )
                throw new MenuError("INVALID");
            }
            const values = { ...card, kind, weekdays, weeklySections };
            if (current)
              await tx
                .update(menuCards)
                .set({ ...values, version: current.version + 1 })
                .where(eq(menuCards.id, id));
            else await tx.insert(menuCards).values({ ...values, id });
            await replaceSections(tx, id, categoryIds);
            return cardById(tx, id);
          });
        }),
      removeCard: (id, version) =>
        safe(async () => {
          await permit(context, "delete");
          parseMenuInput(z.number().int().positive(), version);
          await db.transaction(async (tx) => {
            await taxonomyLock(tx);
            if ((await cardById(tx, id)).version !== version) throw new MenuError("CONFLICT");
            await tx.delete(menuCards).where(eq(menuCards.id, id));
          });
        }),
      placeItems: (input) =>
        safe(async () => {
          await permit(context, "edit");
          const groups = parseMenuInput(menuItemGroupOrderSchema, input);
          const ids = groups.map(({ categoryId }) => validId(categoryId));
          return db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const categories = await tx
              .select({ id: menuCategories.id })
              .from(menuCategories)
              .where(inArray(menuCategories.id, ids));
            if (categories.length !== ids.length) throw new MenuError("INVALID");
            const before = await tx
              .select()
              .from(menuItems)
              .where(inArray(menuItems.categoryId, ids))
              .orderBy(menuItems.id)
              .for("update");
            const after = placeMenuItems(before, groups);
            const versions = new Map(before.map(({ id, version }) => [id, version]));
            for (const { id, version, position, categoryId } of after) {
              if (versions.get(id) !== version)
                await tx
                  .update(menuItems)
                  .set({ categoryId, position, version })
                  .where(eq(menuItems.id, id));
            }
            return after;
          });
        }),
      nextWeek: (id, version, requestId) =>
        safe(async () => {
          await permit(context, "create");
          validId(id);
          validId(requestId);
          parseMenuInput(versionSchema, version);
          return db.transaction(async (tx) => {
            await taxonomyLock(tx);
            const [existing] = await tx
              .select({ id: menuCards.id, sourceId: menuCards.copySourceId })
              .from(menuCards)
              .where(eq(menuCards.copyRequestId, requestId));
            if (existing) {
              if (existing.sourceId !== id) throw new MenuError("CONFLICT");
              return cardById(tx, existing.id);
            }
            const source = await cardById(tx, id);
            if (source.version !== version) throw new MenuError("CONFLICT");
            if (source.kind !== "weekly" || !source.endDate || !source.weekdays?.length)
              throw new MenuError("INVALID");
            const categories = await tx
              .select()
              .from(menuCategories)
              .where(inArray(menuCategories.id, source.categoryIds));
            const mapping = new Map<string, string>();
            const copies = categories.map((category) => {
              const newId = randomUUID();
              mapping.set(category.id, newId);
              return { ...category, id: newId, version: 1 };
            });
            const idOfCopy = (categoryId: string) => {
              const copy = mapping.get(categoryId);
              if (!copy) throw new MenuError("CONFLICT");
              return copy;
            };
            if (copies.length) await tx.insert(menuCategories).values(copies);
            const copyId = randomUUID();
            const cards = await allCards(tx);
            await tx.insert(menuCards).values({
              id: copyId,
              position: Math.max(-1, ...cards.map(({ position }) => position)) + 1,
              translations: source.translations,
              published: false,
              displayMode: source.displayMode,
              ...nextWeekDates(source.endDate, source.weekdays),
              kind: "weekly",
              currencyLabel: source.currencyLabel,
              weekdays: source.weekdays,
              weeklySections: source.weeklySections?.map((section) => ({
                ...section,
                categoryId: idOfCopy(section.categoryId),
              })),
              copyRequestId: requestId,
              copySourceId: id,
            });
            await replaceSections(tx, copyId, source.categoryIds.map(idOfCopy));
            return cardById(tx, copyId);
          });
        }),
    };
  }

  async function readVisibleImage(item: MenuItem) {
    if (item.categoryId === null || !item.visible || !item.imageEntryId)
      throw new MenuError("NOT_FOUND");
    const file = await drive.readTrustedFile(menuScope(item.id), item.imageEntryId, imageLimit);
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
  }

  return {
    client,
    cardsClient,
    publicCards: (locale: string, date: string) =>
      safe(async () => {
        parseMenuInput(z.iso.date(), date);
        const [cards, items, categories, labels] = await Promise.all([
          allCards(db),
          allItems(db),
          allCategories(db),
          allLabels(db),
        ]);
        return cards
          .filter((card) => isMenuCardPublic(card, date))
          .map((card) => buildMenuCard(card, items, categories, labels, locale, baseLocale));
      }),
    previewCard: (context: Context, id: string, locale: string) =>
      safe(async () => {
        await permit(context, "read");
        const [card, items, categories, labels] = await Promise.all([
          cardById(db, id),
          allItems(db),
          allCategories(db),
          allLabels(db),
        ]);
        return buildMenuCard(card, items, categories, labels, locale, baseLocale);
      }),
    readPublicCardImage: (id: string, date: string) =>
      safe(async () => {
        parseMenuInput(z.iso.date(), date);
        const [item, cards] = await Promise.all([itemById(db, id), allCards(db)]);
        const categoryId = item.categoryId;
        if (
          categoryId === null ||
          !cards.some(
            (card) =>
              isMenuCardPublic(card, date) && visibleMenuCategoryIds(card).includes(categoryId),
          )
        )
          throw new MenuError("NOT_FOUND");
        return readVisibleImage(item);
      }),
    publicMenu: (locale: string) =>
      safe(async () => {
        locale = parseMenuInput(z.string(), locale);
        return buildMenu(
          await allItems(db),
          await allCategories(db),
          await allLabels(db),
          locale,
          baseLocale,
        );
      }),
    readPublicImage: (id: string) => safe(async () => readVisibleImage(await itemById(db, id))),
  };
}

import { and, asc, desc, eq, ilike, isNull, exists, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  catalogProduct,
  defaultProductSort,
  productInputSchema,
  productLocaleSchema,
  productCategorySelection,
  validateProductCategory,
  ProductsError,
  type ProductCategoriesClient,
  type ProductInput,
  productSortFields,
  type CatalogProduct,
  type ProductPage,
  type ProductPageQuery,
  type ProductsClient,
} from "@/components/plugins/products/model";
import {
  products,
  productCategories,
  productCategoryAssignments as assignments,
} from "@/components/plugins/products/server/schema";
import {
  containsPattern,
  databaseErrorCode,
  directoryQuerySchema,
  type PluginDatabase,
  type DatabaseTransaction,
  lockPlugin,
} from "@/components/utils/database";
import { resolvePublicIdentifier } from "@/components/utils/public-identifier";

export { ProductsError } from "@/components/plugins/products/model";

export type ProductAction = "read" | "create" | "edit" | "publish" | "delete" | "manageCategories";
export interface ProductsServiceOptions<Context> {
  db: PluginDatabase;
  authorize: (context: Context, action: ProductAction) => Promise<boolean>;
}

function handleWriteError(error: unknown): never {
  if (databaseErrorCode(error) === "23505") throw new ProductsError("SLUG_TAKEN");
  throw error;
}

const pageQuery = directoryQuerySchema.pick({ cursor: true, pageSize: true });
const staffQuery = directoryQuerySchema.extend({
  sort: z
    .object({ field: z.enum(productSortFields), direction: z.enum(["asc", "desc"]) })
    .default(defaultProductSort),
});
const idSchema = z.uuid();
const versionSchema = z.number().int().positive();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ProductsError("INVALID");
  return result.data;
}

function page<T>(rows: T[], offset: number, size: number): ProductPage<T> {
  return {
    items: rows.slice(0, size),
    nextCursor: rows.length > size ? String(offset + size) : null,
  };
}

const catalogFields = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  description: products.description,
  characteristics: products.characteristics,
  priceMinor: products.priceMinor,
  media: products.media,
};
const translatedFields = { ...catalogFields, translations: products.translations };
const staffFields = {
  ...translatedFields,
  published: products.published,
  version: products.version,
};

function collectProducts<T extends { id: string }>(
  rows: { product: T; categoryId: string | null }[],
) {
  const byId = new Map<string, T & { categoryIds: string[] }>();
  for (const { product, categoryId } of rows) {
    let item = byId.get(product.id);
    if (!item) {
      item = { ...product, categoryIds: [] };
      byId.set(product.id, item);
    }
    if (categoryId) item.categoryIds.push(categoryId);
  }
  return [...byId.values()];
}

async function assignedProduct<T extends { id: string }>(tx: DatabaseTransaction, product: T) {
  const rows = await tx
    .select({ id: assignments.categoryId })
    .from(assignments)
    .where(eq(assignments.productId, product.id));
  return { ...product, categoryIds: rows.map((row) => row.id) };
}

export function createProductsService<Context>({ db, authorize }: ProductsServiceOptions<Context>) {
  async function requireAccess(context: Context, action: ProductAction) {
    if (!(await authorize(context, action))) throw new ProductsError("FORBIDDEN");
  }

  async function update(
    tx: DatabaseTransaction,
    id: string,
    version: number,
    values: Partial<z.output<typeof productInputSchema>> | { published: boolean },
  ) {
    const [row] = await tx
      .update(products)
      .set({ ...values, version: parse(versionSchema, version) + 1 })
      .where(and(eq(products.id, parse(idSchema, id)), eq(products.version, version)))
      .returning(staffFields)
      .catch(handleWriteError);
    if (!row) throw new ProductsError("CONFLICT");
    return row;
  }

  const publicRows = () =>
    db
      .select({ product: translatedFields, categoryId: assignments.categoryId })
      .from(products)
      .leftJoin(assignments, eq(assignments.productId, products.id));
  const staffRows = () =>
    db
      .select({ product: staffFields, categoryId: assignments.categoryId })
      .from(products)
      .leftJoin(assignments, eq(assignments.productId, products.id));

  const listCategories = (tx: DatabaseTransaction) =>
    tx
      .select()
      .from(productCategories)
      .orderBy(asc(productCategories.name), asc(productCategories.id));

  async function writeProduct(input: ProductInput, current?: { id: string; version: number }) {
    const { categoryIds, ...values } = parse(productInputSchema, input);
    return db.transaction(async (tx) => {
      const selected = categoryIds?.length
        ? productCategorySelection(
            categoryIds,
            await tx
              .select({ id: productCategories.id, parentId: productCategories.parentId })
              .from(productCategories)
              .where(inArray(productCategories.id, categoryIds))
              .orderBy(asc(productCategories.id))
              .for("share"),
          )
        : categoryIds;
      const row = current
        ? await update(tx, current.id, current.version, values)
        : (
            await tx.insert(products).values(values).returning(staffFields).catch(handleWriteError)
          )[0];
      if (selected === undefined)
        return current ? assignedProduct(tx, row) : { ...row, categoryIds: [] };
      if (current) await tx.delete(assignments).where(eq(assignments.productId, row.id));
      if (selected.length)
        await tx
          .insert(assignments)
          .values(selected.map((categoryId) => ({ productId: row.id, categoryId })));
      return { ...row, categoryIds: selected };
    });
  }

  return {
    async publicList(
      query: ProductPageQuery & { locale?: string; categoryId?: string } = {},
    ): Promise<ProductPage<CatalogProduct>> {
      const { cursor, pageSize, locale, categoryId } = parse(
        pageQuery.extend({
          locale: productLocaleSchema.optional(),
          categoryId: idSchema.optional(),
        }),
        query,
      );
      const order = [asc(products.sortName), asc(products.id)];
      // Page product IDs first so multiple assignments never consume extra places.
      const ids = db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.published, true),
            categoryId
              ? exists(
                  db
                    .select({ id: assignments.productId })
                    .from(assignments)
                    .where(
                      and(
                        eq(assignments.productId, products.id),
                        eq(assignments.categoryId, categoryId),
                      ),
                    ),
                )
              : undefined,
          ),
        )
        .orderBy(...order)
        .offset(cursor)
        .limit(pageSize + 1);
      const rows = await publicRows()
        .where(inArray(products.id, ids))
        .orderBy(...order);
      return page(
        collectProducts(rows).map((row) => catalogProduct(row, locale)),
        cursor,
        pageSize,
      );
    },
    publicCategories() {
      return db
        .select()
        .from(productCategories)
        .where(
          exists(
            db
              .select({ id: assignments.productId })
              .from(assignments)
              .innerJoin(products, eq(products.id, assignments.productId))
              .where(
                and(eq(assignments.categoryId, productCategories.id), eq(products.published, true)),
              ),
          ),
        )
        .orderBy(asc(productCategories.name), asc(productCategories.id));
    },
    async publicGet(identifier: string, locale?: string): Promise<CatalogProduct> {
      const language = parse(productLocaleSchema.optional(), locale);
      if (typeof identifier !== "string" || identifier.length > 200)
        throw new ProductsError("NOT_FOUND");
      const row = await resolvePublicIdentifier(identifier, async (field, value) => {
        const rows = await publicRows().where(
          and(eq(products.published, true), eq(products[field], value)),
        );
        return collectProducts(rows)[0];
      });
      if (!row) throw new ProductsError("NOT_FOUND");
      return catalogProduct(row, language);
    },
    client(context: Context): ProductsClient & ProductCategoriesClient {
      return {
        async list(query = {}) {
          await requireAccess(context, "read");
          const { search, cursor, pageSize, sort } = parse(staffQuery, query);
          const column = sort.field === "name" ? products.sortName : products[sort.field];
          const order = [
            ...(sort.field === "priceMinor" ? [asc(isNull(products.priceMinor))] : []),
            sort.direction === "asc" ? asc(column) : desc(column),
            asc(products.id),
          ];
          const ids = db
            .select({ id: products.id })
            .from(products)
            .where(search ? ilike(products.name, containsPattern(search)) : undefined)
            .orderBy(...order)
            .offset(cursor)
            .limit(pageSize + 1);
          const rows = await staffRows()
            .where(inArray(products.id, ids))
            .orderBy(...order);
          return page(collectProducts(rows), cursor, pageSize);
        },
        async get(id) {
          await requireAccess(context, "read");
          const rows = await staffRows().where(eq(products.id, parse(idSchema, id)));
          const [row] = collectProducts(rows);
          if (!row) throw new ProductsError("NOT_FOUND");
          return row;
        },
        async create(input) {
          await requireAccess(context, "create");
          return writeProduct(input);
        },
        async save(id, version, input) {
          await requireAccess(context, "edit");
          return writeProduct(input, { id, version });
        },
        async setPublished(id, version, published) {
          await requireAccess(context, "publish");
          return db.transaction(async (tx) =>
            assignedProduct(
              tx,
              await update(tx, id, version, { published: parse(z.boolean(), published) }),
            ),
          );
        },
        async categories() {
          await requireAccess(context, "read");
          return listCategories(db);
        },
        async saveCategory(input, current) {
          await requireAccess(context, "manageCategories");
          if (current !== undefined)
            parse(z.object({ id: idSchema, version: versionSchema }), current);
          return db.transaction(async (tx) => {
            await lockPlugin(tx, "products:categories");
            let assigned = false;
            if (current) {
              // Synchronize moves with product writers holding a share lock on this category.
              await tx
                .select({ id: productCategories.id })
                .from(productCategories)
                .where(eq(productCategories.id, current.id))
                .for("update");
              const [usage] = await tx
                .select({ id: assignments.productId })
                .from(assignments)
                .where(eq(assignments.categoryId, current.id))
                .limit(1);
              assigned = !!usage;
            }
            const value = validateProductCategory(
              input,
              await listCategories(tx),
              current,
              assigned,
            );
            const [row] = current
              ? await tx
                  .update(productCategories)
                  .set({ ...value, version: current.version + 1 })
                  .where(eq(productCategories.id, current.id))
                  .returning()
              : await tx.insert(productCategories).values(value).returning();
            return row;
          });
        },
        async deleteCategory(id, version) {
          await requireAccess(context, "manageCategories");
          await db.transaction(async (tx) => {
            await lockPlugin(tx, "products:categories");
            const [row] = await tx
              .delete(productCategories)
              .where(
                and(
                  eq(productCategories.id, parse(idSchema, id)),
                  eq(productCategories.version, parse(versionSchema, version)),
                ),
              )
              .returning({ id: productCategories.id })
              .catch((error: unknown) => {
                if (databaseErrorCode(error) === "23503")
                  throw new ProductsError("CATEGORY_IN_USE");
                throw error;
              });
            if (!row) throw new ProductsError("CONFLICT");
          });
        },
        async delete(id, version) {
          await requireAccess(context, "delete");
          const [row] = await db
            .delete(products)
            .where(
              and(
                eq(products.id, parse(idSchema, id)),
                eq(products.version, parse(versionSchema, version)),
              ),
            )
            .returning({ id: products.id });
          if (!row) throw new ProductsError("CONFLICT");
        },
      };
    },
  };
}

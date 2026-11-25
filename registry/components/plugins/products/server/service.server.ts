import { and, asc, desc, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  catalogProduct,
  defaultProductSort,
  productInputSchema,
  productLocaleSchema,
  productSortFields,
  type CatalogProduct,
  type ProductPage,
  type ProductPageQuery,
  type ProductsClient,
} from "@/components/plugins/products/model";
import { products } from "@/components/plugins/products/server/schema";
import {
  containsPattern,
  databaseErrorCode,
  directoryQuerySchema,
  type PluginDatabase,
} from "@/components/utils/database";
import { resolvePublicIdentifier } from "@/components/utils/public-identifier";

export type ProductAction = "read" | "create" | "edit" | "publish" | "delete";
export interface ProductsServiceOptions<Context> {
  db: PluginDatabase;
  authorize: (context: Context, action: ProductAction) => Promise<boolean>;
}

export class ProductsError extends Error {
  readonly code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SLUG_TAKEN";
  constructor(code: ProductsError["code"]) {
    super(code);
    this.code = code;
  }
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

export function createProductsService<Context>({ db, authorize }: ProductsServiceOptions<Context>) {
  async function requireAccess(context: Context, action: ProductAction) {
    if (!(await authorize(context, action))) throw new ProductsError("FORBIDDEN");
  }

  async function update(
    id: string,
    version: number,
    values: Partial<z.output<typeof productInputSchema>> | { published: boolean },
  ) {
    const [row] = await db
      .update(products)
      .set({ ...values, version: parse(versionSchema, version) + 1 })
      .where(and(eq(products.id, parse(idSchema, id)), eq(products.version, version)))
      .returning(staffFields)
      .catch(handleWriteError);
    if (!row) throw new ProductsError("CONFLICT");
    return row;
  }

  return {
    async publicList(
      query: ProductPageQuery & { locale?: string } = {},
    ): Promise<ProductPage<CatalogProduct>> {
      const { cursor, pageSize, locale } = parse(
        pageQuery.extend({ locale: productLocaleSchema.optional() }),
        query,
      );
      const rows = await db
        .select(translatedFields)
        .from(products)
        .where(eq(products.published, true))
        .orderBy(asc(products.sortName), asc(products.id))
        .offset(cursor)
        .limit(pageSize + 1);
      return page(
        rows.map((row) => catalogProduct(row, locale)),
        cursor,
        pageSize,
      );
    },
    async publicGet(identifier: string, locale?: string): Promise<CatalogProduct> {
      const language = parse(productLocaleSchema.optional(), locale);
      if (typeof identifier !== "string" || identifier.length > 200)
        throw new ProductsError("NOT_FOUND");
      const row = await resolvePublicIdentifier(identifier, async (field, value) => {
        const [match] = await db
          .select(translatedFields)
          .from(products)
          .where(and(eq(products.published, true), eq(products[field], value)))
          .limit(1);
        return match;
      });
      if (!row) throw new ProductsError("NOT_FOUND");
      return catalogProduct(row, language);
    },
    client(context: Context): ProductsClient {
      return {
        async list(query = {}) {
          await requireAccess(context, "read");
          const { search, cursor, pageSize, sort } = parse(staffQuery, query);
          const column = sort.field === "name" ? products.sortName : products[sort.field];
          const order = sort.direction === "asc" ? asc(column) : desc(column);
          const rows = await db
            .select(staffFields)
            .from(products)
            .where(search ? ilike(products.name, containsPattern(search)) : undefined)
            .orderBy(
              ...(sort.field === "priceMinor" ? [asc(isNull(products.priceMinor))] : []),
              order,
              asc(products.id),
            )
            .offset(cursor)
            .limit(pageSize + 1);
          return page(rows, cursor, pageSize);
        },
        async get(id) {
          await requireAccess(context, "read");
          const [row] = await db
            .select(staffFields)
            .from(products)
            .where(eq(products.id, parse(idSchema, id)));
          if (!row) throw new ProductsError("NOT_FOUND");
          return row;
        },
        async create(input) {
          await requireAccess(context, "create");
          const [row] = await db
            .insert(products)
            .values(parse(productInputSchema, input))
            .returning(staffFields)
            .catch(handleWriteError);
          return row;
        },
        async save(id, version, input) {
          await requireAccess(context, "edit");
          return update(id, version, parse(productInputSchema, input));
        },
        async setPublished(id, version, published) {
          await requireAccess(context, "publish");
          return update(id, version, { published: parse(z.boolean(), published) });
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

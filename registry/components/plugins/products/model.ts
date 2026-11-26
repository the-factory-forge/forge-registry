import { z } from "zod";

import { publicSlugPattern } from "@/components/utils/public-identifier";
import type { TableSort } from "@/components/utils/table-sort-state";

const productText = z.string().trim();
const productContentSchema = z.object({
  name: productText.min(1).max(200),
  description: productText.max(10000).default(""),
  characteristics: z
    .array(
      z.object({
        label: productText.min(1).max(200),
        value: productText.min(1).max(1000),
      }),
    )
    .max(100)
    .default([]),
});
export const productLocaleSchema = z
  .string()
  .max(64)
  .regex(/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i);
const productTranslationsSchema = z.record(productLocaleSchema, productContentSchema);
export const productSlugSchema = z
  .string()
  .max(200)
  .regex(publicSlugPattern)
  .refine((value) => !z.uuid().safeParse(value).success);
export const productImageSource = productText.max(2048).refine((src) => {
  if (!src || /[\\\s]/.test(src)) return false;
  if (src.startsWith("/")) return !src.startsWith("//");
  const url = URL.parse(src);
  return url?.protocol === "https:" && !url.username && !url.password;
});
const productPhotoSchema = z.object({
  src: productImageSource,
  alt: productText.max(500).default(""),
});
export const maxProductPhotos = 24;
const productMediaSchema = z.object({
  banner: productPhotoSchema.optional(),
  thumbnail: productPhotoSchema.optional(),
  gallery: z.array(productPhotoSchema).max(maxProductPhotos).optional(),
});
export type ProductPhoto = z.output<typeof productPhotoSchema>;
export type ProductMedia = z.output<typeof productMediaSchema>;

export const productInputSchema = productContentSchema.extend({
  categoryIds: z.array(z.uuid()).optional(),
  media: productMediaSchema.optional(),
  slug: productSlugSchema.nullish(),
  translations: productTranslationsSchema.optional(),
  priceMinor: z.number().int().nonnegative().max(2147483647).nullable().default(null),
});
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductContent = z.output<typeof productContentSchema>;
export type CatalogProduct = ProductContent & {
  id: string;
  slug?: string | null;
  media?: ProductMedia;
  categoryIds?: string[];
  priceMinor: number | null;
};
export interface Product extends CatalogProduct {
  translations?: z.output<typeof productTranslationsSchema>;
  published: boolean;
  version: number;
}

export const productCategoryInputSchema = z.object({
  name: productText.min(1).max(150),
  translations: z.record(productLocaleSchema, productText.min(1).max(150)).default({}),
  parentId: z.uuid().nullable(),
});
export type ProductCategoryInput = z.input<typeof productCategoryInputSchema>;
export type ProductCategory = z.output<typeof productCategoryInputSchema> & {
  id: string;
  version: number;
};
export type CategoryRevision = Pick<ProductCategory, "id" | "version">;
export interface ProductCategoriesClient {
  categories(): Promise<ProductCategory[]>;
  saveCategory(input: ProductCategoryInput, current?: CategoryRevision): Promise<ProductCategory>;
  deleteCategory(id: string, version: number): Promise<void>;
}

export class ProductsError extends Error {
  readonly code:
    | "INVALID"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "SLUG_TAKEN"
    | "CATEGORY_IN_USE"
    | "CATEGORY_NAME_TAKEN";
  constructor(code: ProductsError["code"]) {
    super(code);
    this.code = code;
  }
}

export function productCategoryName(category: ProductCategory, locale: string) {
  return category.translations[locale] ?? category.name;
}

export function productCategoryNames(
  product: CatalogProduct,
  categories: readonly ProductCategory[],
  locale: string,
) {
  return categories
    .filter((c) => product.categoryIds?.includes(c.id))
    .map((c) => productCategoryName(c, locale));
}

export function productCategorySelection(
  ids: readonly string[],
  categories: readonly Pick<ProductCategory, "id" | "parentId">[],
) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const selected = new Set<string>();
  for (const id of ids) {
    const category = byId.get(id);
    if (!category) throw new ProductsError("INVALID");
    if (category.parentId) selected.add(category.parentId);
    selected.add(id);
  }
  return [...selected];
}

export function validateProductCategory(
  input: ProductCategoryInput,
  categories: readonly ProductCategory[],
  current?: CategoryRevision,
  assigned = false,
) {
  const parsed = productCategoryInputSchema.safeParse(input);
  if (!parsed.success) throw new ProductsError("INVALID");
  const value = parsed.data;
  const previous = current && categories.find((c) => c.id === current.id);
  if (current && previous?.version !== current.version) throw new ProductsError("CONFLICT");
  if (previous && previous.parentId !== value.parentId && assigned)
    throw new ProductsError("CATEGORY_IN_USE");
  if (
    value.parentId &&
    (value.parentId === current?.id ||
      !categories.some((c) => c.id === value.parentId && c.parentId === null) ||
      categories.some((c) => c.parentId === current?.id))
  )
    throw new ProductsError("INVALID");
  if (
    categories.some(
      (c) =>
        c.id !== current?.id &&
        c.parentId === value.parentId &&
        c.name.toLowerCase() === value.name.toLowerCase(),
    )
  )
    throw new ProductsError("CATEGORY_NAME_TAKEN");
  return value;
}

export const productSortFields = ["name", "priceMinor", "published"] as const;
export type ProductSort = TableSort<(typeof productSortFields)[number]>;
export const defaultProductSort: ProductSort = { field: "name", direction: "asc" };
export interface ProductPageQuery {
  cursor?: string;
  pageSize?: number;
}
export function catalogProduct(
  product: CatalogProduct & Pick<Product, "translations">,
  locale?: string,
): CatalogProduct {
  const translations = product.translations;
  const content =
    locale && translations && Object.hasOwn(translations, locale) ? translations[locale] : product;
  const { id, priceMinor } = product;
  const { name, description, characteristics } = content;
  return {
    id,
    ...(product.media && Object.keys(product.media).length > 0 && { media: product.media }),
    ...(product.slug && { slug: product.slug }),
    ...(product.categoryIds?.length && { categoryIds: product.categoryIds }),
    name,
    description,
    characteristics,
    priceMinor,
  };
}

export interface ProductPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface ProductsClient {
  list(
    query?: ProductPageQuery & { search?: string; sort?: ProductSort },
  ): Promise<ProductPage<Product>>;
  get(id: string): Promise<Product>;
  create(input: ProductInput): Promise<Product>;
  save(id: string, version: number, input: ProductInput): Promise<Product>;
  setPublished(id: string, version: number, published: boolean): Promise<Product>;
  delete(id: string, version: number): Promise<void>;
}

export function productPriceFormat(currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency });
}

function priceDigits(format: Intl.NumberFormat) {
  return format.resolvedOptions().maximumFractionDigits ?? 0;
}

export function formatProductPrice(minor: number, format: Intl.NumberFormat) {
  return format.format(minor / 10 ** priceDigits(format));
}

export function editableProductPrice(minor: number | null, format: Intl.NumberFormat) {
  return minor === null ? "" : (minor / 10 ** priceDigits(format)).toFixed(priceDigits(format));
}

/** Convert decimal input to minor units without rounding away excess precision. */
export function parseProductPrice(input: string, format: Intl.NumberFormat) {
  if (!input.trim()) return null;
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(input.trim());
  const digits = priceDigits(format);
  if (!match || (match[2]?.length ?? 0) > digits) return undefined;
  const minor = Number(match[1] + (match[2] ?? "").padEnd(digits, "0"));
  return minor <= 2147483647 ? minor : undefined;
}

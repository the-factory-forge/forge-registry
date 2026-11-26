import { Link as RouterLink, notFound, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  ProductCatalog,
  ProductDirectory,
  ProductCategoriesPage,
  productCategorySelection,
  validateProductCategory,
  ProductsError,
  type ProductCategory,
  type ProductCategoriesClient,
  ProductForm,
  catalogProduct,
  defaultProductSort,
  productInputSchema,
  productSortFields,
  type Product,
  type ProductsClient,
} from "@/components/plugins/products";
import { TablePagination } from "@/components/table-pagination";
import { publicRecordPath } from "@/components/utils/public-identifier";
import { sortTableRows } from "@/components/utils/table-sort-state";
import { isLocale } from "@/lib/i18n/config";
import { PreviewLanguageSwitcher } from "@/showroom/preview-language-switcher";
import {
  ShowroomLink,
  useShowroomParams,
  useShowroomQuery,
  useShowroomTablePage,
  useShowroomTableSort,
} from "@/showroom/routing";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const productLocales = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];
const cover = {
  src: "/showroom/products/linen-notebook.jpg",
  alt: "Closed notebook with a natural linen cover",
};
const spread = {
  src: "/showroom/products/linen-notebook-open.jpg",
  alt: "Open notebook showing blank pages and a stitched binding",
};
const uploadedPhotos = new Map<string, string>();
export function previewProductImageUrl(src: string) {
  return uploadedPhotos.get(src) ?? src;
}
async function uploadPreviewPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  bitmap.close();
  const src = "/showroom/products/uploads/" + crypto.randomUUID();
  uploadedPhotos.set(src, URL.createObjectURL(file));
  return src;
}
const stationery = "00000000-0000-4000-8000-000000000001";
const notebooks = "00000000-0000-4000-8000-000000000002";
const sampleCategories: ProductCategory[] = [
  {
    id: stationery,
    version: 1,
    parentId: null,
    name: "Stationery",
    translations: { fr: "Papeterie" },
  },
  {
    id: notebooks,
    version: 1,
    parentId: stationery,
    name: "Notebooks",
    translations: { fr: "Carnets" },
  },
];
const samples: Product[] = [
  {
    id: "a44eec85-9fed-4455-a2e4-ae84fef3bd72",
    version: 1,
    name: "Linen notebook",
    categoryIds: [stationery, notebooks],
    slug: "linen-notebook",
    media: { thumbnail: cover, banner: cover, gallery: [spread, cover] },
    description: "A clothbound notebook with unlined pages.",
    characteristics: [
      { label: "Format", value: "A5" },
      { label: "Pages", value: "120" },
    ],
    translations: {
      fr: {
        name: "Carnet en lin",
        description: "Un carnet relié en toile aux pages sans lignes.",
        characteristics: [
          { label: "Format", value: "A5" },
          { label: "Pages", value: "120" },
        ],
      },
    },
    priceMinor: 1800,
    published: true,
  },
  {
    id: "bc6d89e3-0747-462d-9bc7-aae0d3969120",
    version: 1,
    name: "Pencil case",
    description: "",
    characteristics: [],
    priceMinor: null,
    published: false,
  },
];
const browserStore = { rows: samples, categories: sampleCategories };
export function getProductsPreviewStore() {
  return typeof window === "undefined"
    ? { rows: samples, categories: sampleCategories }
    : browserStore;
}

type PreviewClient = Pick<ProductsClient, "create" | "save" | "setPublished" | "delete"> &
  Pick<ProductCategoriesClient, "saveCategory" | "deleteCategory">;
const ProductsContext = createContext<{
  products: Product[];
  categories: ProductCategory[];
  client: PreviewClient;
  fail: boolean;
  setFail: (value: boolean) => void;
} | null>(null);

export function ProductsPreviewProvider({ children }: { children: ReactNode }) {
  const [productsStore] = useState(getProductsPreviewStore);
  const [products, setProducts] = useState(productsStore.rows);
  const [categories, setCategories] = useState(productsStore.categories);
  const [fail, setFail] = useState(false);
  const [store] = useState(() => {
    let reject = false;
    function commit(next: Product) {
      if (reject) throw new Error("Sample write rejected");
      if (
        next.slug &&
        productsStore.rows.some((row) => row.id !== next.id && row.slug === next.slug)
      )
        throw Object.assign(new Error("Slug already in use"), { code: "SLUG_TAKEN" });
      if (next.categoryIds)
        next = {
          ...next,
          categoryIds: productCategorySelection(next.categoryIds, productsStore.categories),
        };
      productsStore.rows = [...productsStore.rows.filter((p) => p.id !== next.id), next];
      setProducts(productsStore.rows);
      return next;
    }
    function current(id: string, version: number) {
      const row = productsStore.rows.find((p) => p.id === id);
      if (row?.version !== version)
        throw Object.assign(new Error("Product changed"), { code: "CONFLICT" });
      return row;
    }
    const client: PreviewClient = {
      async saveCategory(input, current) {
        if (reject) throw new Error("Sample write rejected");
        const assigned =
          !!current && productsStore.rows.some((p) => p.categoryIds?.includes(current.id));
        const value = validateProductCategory(input, productsStore.categories, current, assigned);
        const category = {
          ...value,
          id: current?.id ?? crypto.randomUUID(),
          version: (current?.version ?? 0) + 1,
        };
        productsStore.categories = [
          ...productsStore.categories.filter((c) => c.id !== category.id),
          category,
        ];
        setCategories(productsStore.categories);
        return category;
      },
      async deleteCategory(id, version) {
        if (reject) throw new Error("Sample write rejected");
        if (productsStore.categories.find((c) => c.id === id)?.version !== version)
          throw new ProductsError("CONFLICT");
        if (
          productsStore.categories.some((c) => c.parentId === id) ||
          productsStore.rows.some((p) => p.categoryIds?.includes(id))
        )
          throw new ProductsError("CATEGORY_IN_USE");
        productsStore.categories = productsStore.categories.filter((c) => c.id !== id);
        setCategories(productsStore.categories);
      },
      async create(input) {
        return commit({
          ...productInputSchema.parse(input),
          id: crypto.randomUUID(),
          version: 1,
          published: false,
        });
      },
      async save(id, version, input) {
        return commit({
          ...current(id, version),
          ...productInputSchema.parse(input),
          version: version + 1,
        });
      },
      async setPublished(id, version, published) {
        return commit({ ...current(id, version), published, version: version + 1 });
      },
      async delete(id, version) {
        current(id, version);
        if (reject) throw new Error("Sample write rejected");
        productsStore.rows = productsStore.rows.filter((p) => p.id !== id);
        setProducts(productsStore.rows);
      },
    };
    return {
      client,
      setFail: (value: boolean) => {
        reject = value;
        setFail(value);
      },
    };
  });
  return (
    <ProductsContext.Provider
      value={{ products, categories, client: store.client, fail, setFail: store.setFail }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function ProductsPreviewNavigation() {
  const { locale, segments } = useShowroomParams();
  const root = `/${locale}/admin/products`;
  return (
    <>
      <ShowroomLink href={`/${locale}/products`}>Public catalog</ShowroomLink>
      <RouterLink
        to="/$locale/admin/products/$"
        params={{ locale, _splat: "" }}
        activeOptions={{ exact: segments[0] === "categories" }}
      >
        Staff directory
      </RouterLink>
      <ShowroomLink href={root + "/categories"}>Categories</ShowroomLink>
    </>
  );
}

export function ProductsPreview({ staff = false }: { staff?: boolean }) {
  const state = useContext(ProductsContext);
  if (!state) throw new Error("Products preview provider required");
  const { products, categories, client, fail, setFail } = state;
  const { locale, segments } = useShowroomParams();
  const navigate = useNavigate();
  const { query, update } = useShowroomQuery();
  const sorting = useShowroomTableSort("products", productSortFields);
  const { page, setPage, search, setSearch } = useShowroomTablePage(staff ? "products" : "catalog");
  const [view, setView] = useState("ready");
  if (!isLocale(locale) || segments.length > 1) throw notFound();
  const publicHref = "/" + locale + "/products";
  const adminHref = "/" + locale + "/admin/products";
  const id = segments[0];
  const record = products.find((p) => p.id === id);
  const isCategories = staff && id === "categories";
  if (id && id !== "new" && !isCategories && !record) throw notFound();
  const isEditor = staff && Boolean(id);
  const publishedIds = new Set(
    products.filter((p) => p.published).flatMap((p) => p.categoryIds ?? []),
  );
  const publicCategories = categories.filter((c) => publishedIds.has(c.id));
  const categoryId = publicCategories.find((c) => c.id === query.category)?.id;
  const searchText = search.trim().toLocaleLowerCase(locale);
  const rows = sortTableRows(
    view === "empty"
      ? []
      : products.filter((p) =>
          staff
            ? p.name.toLocaleLowerCase(locale).includes(searchText)
            : p.published && (!categoryId || p.categoryIds?.includes(categoryId)),
        ),
    staff ? (sorting.sort ?? defaultProductSort) : defaultProductSort,
    (p, field) => (field === "published" ? Number(p.published) : p[field]),
    (p) => p.id,
    locale,
  );
  const size = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const pageNumber = Math.min(page, pageCount);
  const list = {
    products: rows.slice((pageNumber - 1) * size, pageNumber * size),
    currency: "CHF",
    locale,
    loading: view === "loading",
    error: view === "error",
    onRetry: () => setView("ready"),
    pagination: (staff || pageCount > 1) && (
      <TablePagination
        summary={
          staff && view !== "error" && view !== "loading"
            ? rows.length + (rows.length === 1 ? " product" : " products")
            : undefined
        }
        disabled={view === "loading" || view === "error"}
        page={pageNumber}
        pageCount={pageCount}
        previousLabel={staff ? "Previous" : undefined}
        nextLabel={staff ? "Next" : undefined}
        previousDisabled={pageNumber === 1}
        nextDisabled={pageNumber === pageCount}
        onPrevious={() => setPage(pageNumber - 1)}
        onNext={() => setPage(pageNumber + 1)}
      />
    ),
  };
  return (
    <ShowroomPreview
      notice={previewDataNotice}
      navigation={<ProductsPreviewNavigation />}
      controls={
        <div className="grid gap-4">
          <PreviewLanguageSwitcher />
          {!isEditor && (
            <label className="grid gap-1">
              List state
              <select
                className="rounded-lg border bg-background p-2"
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="ready">Ready</option>
                <option value="loading">Loading</option>
                <option value="empty">Empty</option>
                <option value="error">Error</option>
              </select>
            </label>
          )}
          {staff && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
              Simulate a failed save
            </label>
          )}
          <p>
            Install <code>@forge/products</code> for the catalog and staff tools.{" "}
            <code>@forge/products-storage</code> adds PostgreSQL persistence.
          </p>
        </div>
      }
    >
      {isCategories ? (
        <ProductCategoriesPage
          categories={categories}
          locales={productLocales}
          locale={locale}
          backHref={adminHref}
          linkComponent={ShowroomLink}
          onSave={client.saveCategory}
          onDelete={client.deleteCategory}
        />
      ) : isEditor ? (
        <ProductForm
          categories={categories}
          product={record}
          currency="CHF"
          locale={locale}
          locales={productLocales}
          uploadImage={uploadPreviewPhoto}
          imageUrl={previewProductImageUrl}
          client={client}
          backHref={adminHref}
          linkComponent={ShowroomLink}
          onSaved={() => void navigate({ to: adminHref })}
        />
      ) : staff ? (
        <ProductDirectory
          className="showroom-page"
          {...list}
          {...sorting}
          search={search}
          onSearchChange={setSearch}
          linkComponent={ShowroomLink}
          categories={categories}
          categoriesHref={adminHref + "/categories"}
          createHref={adminHref + "/new"}
          getEditHref={(id) => adminHref + "/" + id}
          onSetPublished={client.setPublished}
          onDelete={client.delete}
        />
      ) : (
        <ProductCatalog
          categories={publicCategories}
          categoryId={categoryId}
          onCategoryChange={(id) => update({ category: id, catalogPage: undefined })}
          imageUrl={previewProductImageUrl}
          {...list}
          products={list.products.map((p) => catalogProduct(p, locale))}
          getProductHref={(p) => publicRecordPath(publicHref, p)}
          linkComponent={ShowroomLink}
        />
      )}
    </ShowroomPreview>
  );
}

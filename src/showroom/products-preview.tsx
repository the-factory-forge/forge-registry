import { notFound, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  ProductCatalog,
  ProductDirectory,
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
const samples: Product[] = [
  {
    id: "a44eec85-9fed-4455-a2e4-ae84fef3bd72",
    version: 1,
    name: "Linen notebook",
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
const browserStore = { rows: samples };
export function getProductsPreviewStore() {
  return typeof window === "undefined" ? { rows: samples } : browserStore;
}

type PreviewClient = Pick<ProductsClient, "create" | "save" | "setPublished" | "delete">;
const ProductsContext = createContext<{
  products: Product[];
  client: PreviewClient;
  fail: boolean;
  setFail: (value: boolean) => void;
} | null>(null);

export function ProductsPreviewProvider({ children }: { children: ReactNode }) {
  const [productsStore] = useState(getProductsPreviewStore);
  const [products, setProducts] = useState(productsStore.rows);
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
      value={{ products, client: store.client, fail, setFail: store.setFail }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function ProductsPreview({ staff = false }: { staff?: boolean }) {
  const state = useContext(ProductsContext);
  if (!state) throw new Error("Products preview provider required");
  const { products, client, fail, setFail } = state;
  const { locale, segments } = useShowroomParams();
  const navigate = useNavigate();
  const sorting = useShowroomTableSort("products", productSortFields);
  const { page, setPage, search, setSearch } = useShowroomTablePage(staff ? "products" : "catalog");
  const [view, setView] = useState("ready");
  if (!isLocale(locale) || segments.length > 1) throw notFound();
  const publicHref = "/" + locale + "/products";
  const adminHref = "/" + locale + "/admin/products";
  const id = segments[0];
  const record = products.find((p) => p.id === id);
  if (id && id !== "new" && !record) throw notFound();
  const isEditor = staff && Boolean(id);
  const searchText = search.trim().toLocaleLowerCase(locale);
  const rows = sortTableRows(
    view === "empty"
      ? []
      : products.filter((p) =>
          staff ? p.name.toLocaleLowerCase(locale).includes(searchText) : p.published,
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
      navigation={
        <>
          <ShowroomLink href={publicHref} aria-current={!staff ? "page" : undefined}>
            Public catalog
          </ShowroomLink>
          <ShowroomLink href={adminHref} aria-current={staff && !isEditor ? "page" : undefined}>
            Staff directory
          </ShowroomLink>
        </>
      }
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
      {isEditor ? (
        <ProductForm
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
          createHref={adminHref + "/new"}
          getEditHref={(id) => adminHref + "/" + id}
          onSetPublished={client.setPublished}
          onDelete={client.delete}
        />
      ) : (
        <ProductCatalog
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

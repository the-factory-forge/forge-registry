"use client";

import { PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import {
  Fragment,
  useRef,
  type ComponentType,
  type MouseEventHandler,
  type ReactNode,
} from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import { Link, type LinkProps } from "@/components/link";
import { LoadingBadge, useLoadingActivity } from "@/components/loading-indicator";
import { NativeSelect } from "@/components/native-select";
import {
  productCategoryName,
  productCategoryNames,
  type ProductCategory,
  defaultProductSort,
  productPriceFormat,
  productSortFields,
  formatProductPrice,
  type CatalogProduct,
  type Product,
  type ProductsClient,
  type ProductSort,
} from "@/components/plugins/products/model";
import {
  productButtonClass,
  productsLabels,
  type ProductListProps,
} from "@/components/plugins/products/presentation";
import { ProductGallery } from "@/components/plugins/products/product-media";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { StatusToggle } from "@/components/status-toggle";
import { TableSearch } from "@/components/table-search";
import { TableSortHeader, useTableSort, type TableSortProps } from "@/components/table-sort";
import { cn } from "@/components/utils/cn";
import { iconButtonClass, primaryClass } from "@/components/utils/table-controls";
import {
  tableClass,
  tableCellClass,
  tableHeaderClass,
  tableRowClass,
  tableActionCellClass,
  tableActionsClass,
  tableActionHeaderClass,
  tablePanelClass,
  tablePageClass,
} from "@/components/utils/table-styles";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

function ListState({
  loading,
  error,
  onRetry,
  labels,
}: Pick<ProductListProps, "loading" | "error" | "onRetry"> & { labels: typeof productsLabels }) {
  if (error)
    return (
      <div role="alert" className="flex items-center gap-2 text-destructive">
        {labels.readError}
        {onRetry && (
          <IconTooltip label={labels.retry}>
            <button
              type="button"
              className={iconButtonClass}
              onClick={onRetry}
              aria-label={labels.retry}
            >
              <RefreshCwIcon aria-hidden="true" className="shrink-0" />
            </button>
          </IconTooltip>
        )}
      </div>
    );
  return loading ? <LoadingBadge label={labels.loading} /> : null;
}

function ProductOverview({
  product,
  format,
  heading,
}: {
  product: CatalogProduct;
  format: Intl.NumberFormat;
  heading: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {heading}
        {product.priceMinor !== null && (
          <span className="font-medium tabular-nums">
            {formatProductPrice(product.priceMinor, format)}
          </span>
        )}
      </div>
      {product.description && (
        <p className="wrap-anywhere whitespace-pre-line text-muted-foreground">
          {product.description}
        </p>
      )}
      {product.characteristics.length > 0 && (
        <dl className="divide-y divide-border text-sm">
          {product.characteristics.map((pair, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 py-2 wrap-anywhere">
              <dt className="text-muted-foreground">{pair.label}</dt>
              <dd>{pair.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export interface ProductDetailProps extends Pick<
  ProductListProps,
  "currency" | "locale" | "labels" | "className" | "imageUrl"
> {
  product: CatalogProduct;
  categoryNames?: readonly string[];
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
}

export function ProductDetail({
  product,
  categoryNames,
  currency,
  locale = "en",
  labels,
  imageUrl,
  className,
  backHref,
  linkComponent,
}: ProductDetailProps) {
  const gallery = product.media?.gallery ?? [];
  return (
    <article className={cn("mx-auto max-w-2xl space-y-5", className)}>
      <BackLink href={backHref} linkComponent={linkComponent}>
        {labels?.back ?? productsLabels.back}
      </BackLink>
      {product.media?.banner && (
        <Image
          src={imageUrl?.(product.media.banner.src) ?? product.media.banner.src}
          alt={product.media.banner.alt}
          width={1200}
          height={600}
          priority
          className="aspect-2/1 w-full rounded-xl object-cover"
        />
      )}
      <ProductOverview
        product={product}
        format={productPriceFormat(currency, locale)}
        heading={
          <h1 className="min-w-0 text-3xl font-semibold tracking-tight wrap-anywhere">
            {product.name}
          </h1>
        }
      />
      {!!categoryNames?.length && (
        <dl className="text-sm">
          <dt className="font-medium">{labels?.categories ?? productsLabels.categories}</dt>
          <dd>{categoryNames.join(", ")}</dd>
        </dl>
      )}
      {gallery.length > 0 && (
        <ProductGallery
          key={product.id}
          photos={gallery}
          name={product.name}
          imageUrl={imageUrl}
          labels={{ ...productsLabels, ...labels }}
        />
      )}
    </article>
  );
}

export interface ProductCatalogProps extends ProductListProps {
  categories?: readonly ProductCategory[];
  categoryId?: string;
  onCategoryChange?: (id: string | undefined) => void;
  products: readonly CatalogProduct[];
  getProductHref?: (product: CatalogProduct) => string;
  linkComponent?: ComponentType<LinkProps>;
}
export function ProductCatalog({
  categories,
  categoryId,
  onCategoryChange,
  products,
  getProductHref,
  imageUrl,
  linkComponent: HostLink = Link,
  currency,
  locale = "en",
  labels: overrides,
  loading,
  error,
  onRetry,
  pagination,
  className,
}: ProductCatalogProps) {
  const labels = { ...productsLabels, ...overrides };
  const format = productPriceFormat(currency, locale);
  useLoadingActivity(Boolean(loading));
  return (
    <section className={cn("min-w-0 space-y-5", className)}>
      <h1 className="text-3xl font-semibold tracking-tight">{labels.catalog}</h1>
      {onCategoryChange && !!categories?.length && (
        <label className="grid max-w-md gap-1 text-sm font-medium">
          {labels.categories}
          <NativeSelect
            className="min-h-10 rounded-lg border border-input bg-background px-3"
            value={categoryId ?? ""}
            onChange={(e) => onCategoryChange(e.target.value || undefined)}
          >
            <option value="">{labels.allCategories}</option>
            {categories
              .filter((c) => !c.parentId)
              .map((parent) => (
                <Fragment key={parent.id}>
                  <option value={parent.id}>{productCategoryName(parent, locale)}</option>
                  {categories
                    .filter((c) => c.parentId === parent.id)
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        {productCategoryName(parent, locale)} / {productCategoryName(child, locale)}
                      </option>
                    ))}
                </Fragment>
              ))}
          </NativeSelect>
        </label>
      )}
      <ListState {...{ loading, error, onRetry, labels }} />
      {!error &&
        !loading &&
        (products.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="relative min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5 text-card-foreground"
              >
                {p.media?.thumbnail && (
                  <Image
                    src={imageUrl?.(p.media.thumbnail.src) ?? p.media.thumbnail.src}
                    alt={p.media.thumbnail.alt}
                    width={600}
                    height={400}
                    className="aspect-3/2 w-full rounded-lg object-cover"
                  />
                )}
                <ProductOverview
                  product={p}
                  format={format}
                  heading={
                    <h2 className="min-w-0 text-xl font-semibold wrap-anywhere">
                      {getProductHref ? (
                        <HostLink
                          href={getProductHref(p)}
                          className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {p.name}
                        </HostLink>
                      ) : (
                        p.name
                      )}
                    </h2>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p>{labels.catalogEmpty}</p>
        ))}
      {!error && !loading && pagination}
    </section>
  );
}

export interface ProductDirectoryProps
  extends ProductListProps, TableSortProps<ProductSort["field"]> {
  products: readonly Product[];
  onSortChange: NonNullable<TableSortProps<ProductSort["field"]>["onSortChange"]>;
  search?: string;
  onSearchChange?: (value: string) => void;
  categories?: readonly ProductCategory[];
  categoriesHref?: string;
  createHref?: string;
  getEditHref?: (id: string) => string;
  onSetPublished?: ProductsClient["setPublished"];
  onDelete?: ProductsClient["delete"];
  linkComponent?: ComponentType<LinkProps>;
}

function ProductRow({
  categoryNames,
  product,
  format,
  labels,
  HostLink,
  editHref,
  loading,
  onSetPublished,
  onDelete,
}: {
  categoryNames?: string;
  product: Product;
  format: Intl.NumberFormat;
  labels: typeof productsLabels;
  HostLink: ComponentType<LinkProps>;
  editHref?: string;
  loading: boolean;
  onSetPublished?: ProductsClient["setPublished"];
  onDelete?: MouseEventHandler<HTMLButtonElement>;
}) {
  const action = useOptimisticAction(product, onSetPublished);
  const notify = useActionToast();
  const changeVisibility = async (next: boolean) => {
    if (!onSetPublished || action.pending || loading) return;
    try {
      await action.run(
        (current) => ({ ...current, published: next }),
        () => onSetPublished(product.id, product.version, next),
        () => notify(next ? labels.publishedNotice : labels.hiddenNotice),
      );
    } catch {
      /* The mutation owns the inline error and rollback. */
    }
  };
  const published = action.value.published;
  const status = published ? labels.published : labels.private;
  const statusClass = published
    ? "bg-status-success text-status-success-foreground"
    : "bg-status-not-started text-status-not-started-foreground";
  return (
    <tr className={tableRowClass}>
      <th scope="row" className={cn(tableCellClass, "text-left font-medium wrap-anywhere")}>
        {editHref ? (
          <HostLink
            href={editHref}
            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {product.name}
          </HostLink>
        ) : (
          product.name
        )}
        {Boolean(action.error) && (
          <span role="alert" className="block text-sm text-destructive">
            {labels.visibilityError}
          </span>
        )}
      </th>
      {categoryNames !== undefined && (
        <td className={tableCellClass}>
          <p className="max-w-48 truncate" title={categoryNames}>
            {categoryNames || "—"}
          </p>
        </td>
      )}
      <td className={tableCellClass}>
        {product.priceMinor === null ? "—" : formatProductPrice(product.priceMinor, format)}
      </td>
      <td className={tableCellClass}>
        {onSetPublished ? (
          <StatusToggle
            label={labels.publicationStatus}
            pressed={published}
            onPressedChange={(next) => void changeVisibility(next)}
            disabled={action.pending || loading}
            className={cn("min-h-10 md:min-h-6", statusClass)}
          >
            {status}
          </StatusToggle>
        ) : (
          <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusClass)}>
            {status}
          </span>
        )}
      </td>
      <td className={tableActionCellClass}>
        <div className={tableActionsClass}>
          {editHref && (
            <IconTooltip label={labels.edit}>
              <HostLink href={editHref} className={iconButtonClass} aria-label={labels.edit}>
                <PencilIcon aria-hidden="true" className="shrink-0" />
              </HostLink>
            </IconTooltip>
          )}
          {onDelete && (
            <RecordDeleteButton
              label={labels.deleteProduct}
              disabled={action.pending || loading}
              onClick={onDelete}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

export function ProductDirectory(props: ProductDirectoryProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.close ?? productsLabels.close}>
      <ProductDirectoryContent {...props} />
    </ActionToastProvider>
  );
}

function ProductDirectoryContent({
  products,
  currency,
  locale = "en",
  labels: overrides,
  loading,
  error,
  onRetry,
  pagination,
  className,
  categories,
  categoriesHref,
  createHref,
  getEditHref,
  onSetPublished,
  onDelete,
  linkComponent: HostLink = Link,
  search = "",
  onSearchChange,
  ...sortProps
}: ProductDirectoryProps) {
  const labels = { ...productsLabels, ...overrides };
  const headers = useTableSort(sortProps, defaultProductSort, undefined, {
    owner: "products",
    key: "directory",
    fields: productSortFields,
  });
  const format = productPriceFormat(currency, locale);
  useLoadingActivity(Boolean(loading));
  const root = useRef<HTMLElement>(null);
  const deletion = useRecordDeletion({
    items: products,
    getName: (product) => product.name,
    onDelete:
      onDelete &&
      (async (id) => {
        const product = products.find((row) => row.id === id);
        if (!product) throw new Error("Product is unavailable");
        await onDelete(id, product.version);
      }),
    label: labels.deleteProduct,
    labels: {
      deleteDescription: labels.deleteDescription,
      cancel: labels.cancel,
      close: labels.close,
      confirmDelete: labels.confirmDelete,
      pending: labels.deleting,
      deleted: labels.deleted,
      actionError: labels.deleteError,
    },
    disabled: loading || error,
    returnFocus: root,
  });
  return (
    <section ref={root} tabIndex={-1} className={cn(tablePageClass, className)}>
      <div className={cn(tablePanelClass, "space-y-5")}>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-sans text-base font-semibold">{labels.products}</h1>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            {onSearchChange && (
              <TableSearch
                value={search}
                onValueChange={onSearchChange}
                maxLength={250}
                label={labels.search}
                clearLabel={labels.clearSearch}
              />
            )}
            {categoriesHref && (
              <HostLink href={categoriesHref} className={productButtonClass}>
                {labels.categories}
              </HostLink>
            )}
            {createHref && (
              <HostLink className={primaryClass} href={createHref}>
                <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
                {overrides?.createAction ??
                  overrides?.product ??
                  overrides?.add ??
                  productsLabels.createAction}
              </HostLink>
            )}
          </div>
        </header>
        <div className="relative overflow-x-auto">
          <table className={tableClass} aria-busy={Boolean(loading)}>
            {loading && deletion.items.length > 0 && (
              <caption className="sr-only">
                <output>{labels.loading}</output>
              </caption>
            )}
            <thead>
              <tr className={tableRowClass}>
                <TableSortHeader {...headers} field="name" label={labels.name} />
                {categories && (
                  <th scope="col" className={tableHeaderClass}>
                    {labels.categories}
                  </th>
                )}
                <TableSortHeader {...headers} field="priceMinor" label={labels.price} />
                <TableSortHeader {...headers} field="published" label={labels.status} />
                <th scope="col" className={tableActionHeaderClass}>
                  <span className="sr-only">{labels.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {(error || !deletion.items.length) && (
                <tr>
                  <td colSpan={categories ? 5 : 4} className={cn(tableCellClass, "py-8")}>
                    {error || loading ? (
                      <ListState {...{ loading, error, onRetry, labels }} />
                    ) : (
                      <p className="text-muted-foreground">
                        {search.trim() ? labels.searchEmpty : labels.empty}
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {!error &&
                deletion.items.map((product) => (
                  <ProductRow
                    key={product.id}
                    categoryNames={
                      categories && productCategoryNames(product, categories, locale).join(", ")
                    }
                    {...{ product, format, labels, HostLink, onSetPublished }}
                    loading={Boolean(loading)}
                    editHref={getEditHref?.(product.id)}
                    onDelete={
                      onDelete && ((event) => deletion.open(product.id, event.currentTarget))
                    }
                  />
                ))}
            </tbody>
          </table>
        </div>
        {pagination}
      </div>
      {deletion.dialog}
    </section>
  );
}

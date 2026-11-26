"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import type { LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import {
  productCategoryName,
  type ProductCategoriesClient,
  type ProductCategory,
} from "@/components/plugins/products/model";
import {
  productButtonClass,
  productPrimaryClass,
  productsLabels,
  type ProductsLabels,
} from "@/components/plugins/products/presentation";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { submitFormOnShortcut } from "@/components/utils/dialog-submit";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

export function ProductCategoryTree({
  categories,
  render,
}: {
  categories: readonly ProductCategory[];
  render: (category: ProductCategory) => ReactNode;
}) {
  const children = new Map<string | null, ProductCategory[]>();
  for (const category of categories) {
    const group = children.get(category.parentId);
    if (group) group.push(category);
    else children.set(category.parentId, [category]);
  }
  return (
    <ul className="space-y-2">
      {children.get(null)?.map((parent) => (
        <li key={parent.id}>
          {render(parent)}
          {children.has(parent.id) && (
            <ul className="ms-3 mt-1 space-y-1 border-s ps-4">
              {children.get(parent.id)?.map((child) => (
                <li key={child.id}>{render(child)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface ProductCategoriesPageProps {
  categories: readonly ProductCategory[];
  locale?: string;
  /** The first language is the primary name and fallback. */
  locales: readonly { code: string; name: string }[];
  labels?: ProductsLabels;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  /** Supply callbacks that update host data only to authorized category managers. */
  onSave?: ProductCategoriesClient["saveCategory"];
  onDelete?: ProductCategoriesClient["deleteCategory"];
}

export function ProductCategoriesPage(props: ProductCategoriesPageProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <Categories {...props} />
    </ActionToastProvider>
  );
}

function Categories({
  categories,
  locale = "en",
  locales,
  backHref,
  linkComponent,
  labels: overrides,
  onSave,
  onDelete,
}: ProductCategoriesPageProps) {
  const labels = { ...productsLabels, ...overrides };
  const [editing, setEditing] = useState<ProductCategory | "new" | null>(null);
  const root = useRef<HTMLElement>(null);
  const deletion = useRecordDeletion({
    items: categories,
    getName: (c) => productCategoryName(c, locale),
    onDelete:
      onDelete &&
      (async (id) => {
        const category = categories.find((c) => c.id === id);
        if (!category) return;
        await onDelete(id, category.version);
      }),
    label: labels.deleteCategory,
    returnFocus: root,
    labels: {
      deleteDescription: labels.deleteDescription,
      cancel: labels.cancel,
      close: labels.close,
      confirmDelete: labels.confirmDelete,
      pending: labels.deleting,
      deleted: labels.categoryDeleted,
      actionError: labels.categoryDeleteError,
    },
  });
  const edit = (category: ProductCategory) => (
    <div className="flex items-center justify-between gap-3">
      {onSave ? (
        <button
          type="button"
          className="min-h-10 cursor-pointer rounded-sm text-start font-medium underline underline-offset-4 focus-visible:outline-ring"
          onClick={() => setEditing(category)}
        >
          {productCategoryName(category, locale)}
        </button>
      ) : (
        <span>{productCategoryName(category, locale)}</span>
      )}
      {onDelete && (
        <RecordDeleteButton
          disabled={deletion.pending || categories.some((c) => c.parentId === category.id)}
          label={labels.deleteCategory}
          onClick={(e) => deletion.open(category.id, e.currentTarget)}
        />
      )}
    </div>
  );
  return (
    <section ref={root} tabIndex={-1} className="mx-auto max-w-2xl space-y-5">
      <BackLink href={backHref} linkComponent={linkComponent}>
        {labels.back}
      </BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{labels.categories}</h1>
        {onSave && (
          <button type="button" className={productPrimaryClass} onClick={() => setEditing("new")}>
            <PlusIcon className="size-4" aria-hidden="true" />
            {labels.createAction}
          </button>
        )}
      </header>
      {deletion.items.length ? (
        <ProductCategoryTree categories={deletion.items} render={edit} />
      ) : (
        <p>{labels.noCategories}</p>
      )}
      {editing && onSave && (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.id}
          current={editing === "new" ? undefined : editing}
          {...{ categories, locales, labels, onSave }}
          onClose={() => setEditing(null)}
        />
      )}
      {deletion.dialog}
    </section>
  );
}

function CategoryDialog({
  current,
  categories,
  locales,
  labels,
  onSave,
  onClose,
}: {
  current?: ProductCategory;
  categories: readonly ProductCategory[];
  locales: ProductCategoriesPageProps["locales"];
  labels: typeof productsLabels;
  onSave: ProductCategoriesClient["saveCategory"];
  onClose: () => void;
}) {
  const [name, setName] = useState(current?.name ?? "");
  const [translations, setTranslations] = useState(current?.translations ?? {});
  const [parentId, setParentId] = useState(current?.parentId ?? "");
  const action = useMutationAction(onSave);
  const notify = useActionToast();
  const code =
    action.error && typeof action.error === "object" && "code" in action.error
      ? action.error.code
      : undefined;
  const inputClass =
    "min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-ring";
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !action.pending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">
              {current ? labels.editCategory : labels.newCategory}
            </Dialog.Title>
            <IconTooltip label={labels.close}>
              <Dialog.Close
                disabled={action.pending}
                className={productButtonClass}
                aria-label={labels.close}
              >
                <XIcon aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <form
            onKeyDownCapture={submitFormOnShortcut}
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                () =>
                  onSave(
                    {
                      name,
                      parentId: parentId || null,
                      translations: Object.fromEntries(
                        Object.entries(translations).filter(([, v]) => v.trim()),
                      ),
                    },
                    current && { id: current.id, version: current.version },
                  ),
                () => {
                  notify(labels.categorySaved);
                  onClose();
                },
              );
            }}
          >
            <fieldset disabled={action.pending} className="space-y-4">
              <label className="grid gap-1">
                {labels.parentCategory}
                <NativeSelect
                  className={inputClass}
                  value={parentId}
                  disabled={!!current && categories.some((c) => c.parentId === current.id)}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">{labels.mainCategory}</option>
                  {categories
                    .filter((c) => !c.parentId && c.id !== current?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <label className="grid gap-1">
                {labels.name}
                {locales[0] && ` (${locales[0].name})`}
                <input
                  className={inputClass}
                  required
                  maxLength={150}
                  lang={locales[0]?.code}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {locales.slice(1).map((l) => (
                <label key={l.code} className="grid gap-1">
                  {labels.name} ({l.name})
                  <input
                    className={inputClass}
                    maxLength={150}
                    lang={l.code}
                    value={translations[l.code] ?? ""}
                    onChange={(e) => setTranslations({ ...translations, [l.code]: e.target.value })}
                  />
                </label>
              ))}
              {Boolean(action.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {code === "CATEGORY_IN_USE"
                    ? labels.categoryInUse
                    : code === "CATEGORY_NAME_TAKEN"
                      ? labels.categoryNameTaken
                      : code === "CONFLICT"
                        ? labels.categoryConflict
                        : labels.saveError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Dialog.Close className={productButtonClass}>{labels.cancel}</Dialog.Close>
                <button type="submit" className={productPrimaryClass}>
                  <SaveIcon className="size-4" aria-hidden="true" />
                  {labels.save}
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

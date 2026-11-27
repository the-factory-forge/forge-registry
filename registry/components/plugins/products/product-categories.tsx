"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import {
  CategoryEditorForm,
  CategoryLanguageFields,
  CategoryManager,
  categoryInputClass,
} from "@/components/category-manager";
import type { LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import {
  productCategoryName,
  type ProductCategoriesClient,
  type ProductCategory,
  type ProductCategoryInput,
} from "@/components/plugins/products/model";
import { productsLabels, type ProductsLabels } from "@/components/plugins/products/presentation";
import { RecordDeleteButton, useRecordDeletion } from "@/components/record-deletion";
import { buttonClass, primaryClass } from "@/components/utils/table-controls";
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
  className?: string;
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
  className,
  labels: overrides,
  onSave,
  onDelete,
}: ProductCategoriesPageProps) {
  const labels = { ...productsLabels, ...overrides };
  const [editor, setEditor] = useState<{ key: number; category?: ProductCategory }>({ key: 0 });
  const current = editor.category;
  const notify = useActionToast();
  const save = useMutationAction(useMemo(() => ({ onSave, editor }), [onSave, editor]));
  function select(category?: ProductCategory) {
    setEditor(({ key }) => ({ key: key + 1, category }));
  }
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (editor.key) heading.current?.focus();
  }, [editor.key]);
  const deletion = useRecordDeletion({
    items: categories,
    getName: (c) => productCategoryName(c, locale),
    onDelete:
      onDelete &&
      (async (id) => {
        const category = categories.find((c) => c.id === id);
        if (!category) return;
        await onDelete(id, category.version);
        select();
      }),
    label: labels.deleteCategory,
    returnFocus: root,
    disabled: save.pending,
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
  const pending = save.pending || deletion.pending;
  const selectCurrent = (id: string) => {
    if (current?.id !== id) select(deletion.items.find((category) => category.id === id));
  };
  return (
    <CategoryManager
      rootRef={root}
      className={className}
      categories={deletion.items.map((category) => ({
        id: category.id,
        parentId: category.parentId,
        name: productCategoryName(category, locale),
      }))}
      selectedId={current?.id}
      onSelect={selectCurrent}
      title={labels.categories}
      backLabel={labels.back}
      backHref={backHref}
      linkComponent={linkComponent}
      onCreate={onSave ? () => select() : undefined}
      createLabel={labels.createAction}
      emptyLabel={labels.noCategories}
      disabled={pending}
    >
      <ProductCategoryEditor
        key={editor.key}
        {...{ current, categories, locales, labels, pending }}
        headingRef={heading}
        error={save.error}
        onCancel={() => select()}
        onSave={
          onSave &&
          ((input) =>
            void save.run(
              () => onSave(input, current && { id: current.id, version: current.version }),
              (result) => {
                notify(labels.categorySaved);
                select(result);
              },
            ))
        }
        actions={
          current &&
          onDelete && (
            <RecordDeleteButton
              disabled={pending || categories.some((category) => category.parentId === current.id)}
              label={labels.deleteCategory}
              onClick={(event) => deletion.open(current.id, event.currentTarget)}
            />
          )
        }
      />
      {deletion.dialog}
    </CategoryManager>
  );
}

function ProductCategoryEditor({
  current,
  categories,
  locales,
  labels,
  pending,
  error,
  onSave,
  onCancel,
  actions,
  headingRef,
}: {
  current?: ProductCategory;
  categories: readonly ProductCategory[];
  locales: ProductCategoriesPageProps["locales"];
  labels: typeof productsLabels;
  pending: boolean;
  error: unknown;
  onSave?: (input: ProductCategoryInput) => void;
  onCancel: () => void;
  actions?: ReactNode;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const [name, setName] = useState(current?.name ?? "");
  const [translations, setTranslations] = useState(current?.translations ?? {});
  const [parentId, setParentId] = useState(current?.parentId ?? "");
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const [primary, ...secondary] = locales;
  const primaryField = (
    <label className="grid min-w-0 gap-1 text-sm sm:col-span-2">
      {labels.name}
      <input
        aria-label={primary ? `${labels.name} (${primary.name})` : undefined}
        className={categoryInputClass}
        required
        maxLength={150}
        lang={primary?.code}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </label>
  );
  return (
    <CategoryEditorForm
      title={current ? labels.editCategory : labels.newCategory}
      headingRef={headingRef}
      disabled={!onSave || pending}
      actions={actions}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        onSave?.({
          name,
          parentId: parentId || null,
          translations: Object.fromEntries(
            Object.entries(translations).filter(([, value]) => value.trim()),
          ),
        });
      }}
      feedback={
        Boolean(error) && (
          <p role="alert" className="text-sm text-destructive">
            {code === "CATEGORY_IN_USE"
              ? labels.categoryInUse
              : code === "CATEGORY_NAME_TAKEN"
                ? labels.categoryNameTaken
                : code === "CONFLICT"
                  ? labels.categoryConflict
                  : labels.saveError}
          </p>
        )
      }
    >
      <label className="grid gap-1 text-sm">
        {labels.parentCategory}
        <NativeSelect
          className={categoryInputClass}
          value={parentId}
          disabled={!!current && categories.some((category) => category.parentId === current.id)}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">{labels.mainCategory}</option>
          {categories
            .filter((category) => !category.parentId && category.id !== current?.id)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </NativeSelect>
      </label>
      {primary ? (
        <CategoryLanguageFields name={primary.name}>{primaryField}</CategoryLanguageFields>
      ) : (
        primaryField
      )}
      {secondary.map(({ code, name }) => (
        <CategoryLanguageFields key={code} name={name}>
          <label className="grid min-w-0 gap-1 text-sm sm:col-span-2">
            {labels.name}
            <input
              aria-label={`${labels.name} (${name})`}
              className={categoryInputClass}
              maxLength={150}
              lang={code}
              value={translations[code] ?? ""}
              onChange={(event) => setTranslations({ ...translations, [code]: event.target.value })}
            />
          </label>
        </CategoryLanguageFields>
      ))}
      {onSave && (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryClass}>
            {labels.save}
          </button>
          {(current || name || parentId || Object.values(translations).some(Boolean)) && (
            <button type="button" className={buttonClass} onClick={onCancel}>
              {labels.cancel}
            </button>
          )}
        </div>
      )}
    </CategoryEditorForm>
  );
}

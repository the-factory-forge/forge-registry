"use client";

import { Tabs } from "@base-ui/react/tabs";
import { PlusIcon, RefreshCwIcon, SettingsIcon, PencilIcon } from "lucide-react";
import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import { BlogCategoryEditor, type BlogEditPageProps } from "@/components/plugins/blogs/editor";
import { useHistoryPublication } from "@/components/plugins/blogs/history";
import { blogsLabels } from "@/components/plugins/blogs/labels";
import type {
  BlogArticle,
  BlogCapabilities,
  BlogCategory,
  BlogListItem,
  BlogLocale,
  BlogPage,
  BlogsAppearanceProps,
  BlogsClient,
} from "@/components/plugins/blogs/types";
import {
  BlogEditorClient,
  buttonClass,
  cardClass,
  ConfirmDelete,
  errorMessage,
  Feedback,
  iconButtonClass,
  inputClass,
  outlineButtonClass,
  pageClass,
  Pagination,
  primaryClass,
  useBlogAction,
} from "@/components/plugins/blogs/ui";
import {
  languageTabClass,
  blogStatusClass,
  publicationToggleClass,
} from "@/components/plugins/blogs/ui";
import { hasUnpublishedChanges } from "@/components/plugins/blogs/utils";
import { TableSearch } from "@/components/table-search";
import {
  TableBulkDelete,
  TableSelectionCheckbox,
  useTableSelection,
} from "@/components/table-selection";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableActionsClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems, useOptimisticAction } from "@/components/utils/use-optimistic-action";
export { BlogEditPage, type BlogEditPageProps } from "@/components/plugins/blogs/editor";

export interface BlogsPageProps extends BlogsAppearanceProps {
  data: BlogPage<BlogListItem>;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  editHref: (id: string) => string;
  newHref: string;
  categoriesHref: string;
  capabilities: BlogCapabilities;
  capabilitiesForArticle?: (article: BlogListItem) => BlogCapabilities;
  onDelete?: (id: string, requestId: string) => Promise<void>;
  client?: BlogsClient;
  onSetPublished?: (
    id: string,
    locale: string,
    published: boolean,
    requestId: string,
  ) => Promise<void>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}
function BlogsPageContent({
  data: suppliedData,
  search,
  onSearchChange,
  onPageChange,
  editHref,
  newHref,
  categoriesHref,
  capabilities,
  capabilitiesForArticle,
  onDelete,
  onSetPublished,
  client,
  loading,
  error: loadError,
  onRetry,
  labels: overrides,
  linkComponent: BlogLink = Link,
  formatDate = (iso) => new Date(iso).toISOString().slice(0, 10),
  className,
}: BlogsPageProps) {
  useLoadingActivity(!!loading);
  const labels = { ...blogsLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedData, useContext(BlogEditorClient));
  const toggleAction = useBlogAction(labels);
  const historyPublication = useHistoryPublication(client, labels, (result) => {
    void optimistic.run(
      (page) => ({
        ...page,
        items: page.items.map((post) =>
          post.id === result.id
            ? {
                ...post,
                translations: post.translations.map((translation) => ({
                  ...translation,
                  status: !result.translations[translation.locale]?.published
                    ? "draft"
                    : hasUnpublishedChanges(result, translation.locale)
                      ? "changed"
                      : "published",
                })),
              }
            : post,
        ),
      }),
      async () => {},
    );
  });
  const publishing = historyPublication.publishing;
  const data = publishing
    ? {
        ...optimistic.value,
        items: optimistic.value.items.map((post) =>
          post.id === publishing.id
            ? {
                ...post,
                translations: post.translations.map((translation) =>
                  translation.locale === publishing.locale
                    ? { ...translation, status: "published" as const }
                    : translation,
                ),
              }
            : post,
        ),
      }
    : optimistic.value;
  const error =
    loadError || (optimistic.error ? errorMessage(optimistic.error, labels) : undefined);
  const articleCapabilities = (post: BlogListItem) =>
    capabilitiesForArticle?.(post) ?? capabilities;
  const showDelete = !!onDelete && (capabilities.delete || !!capabilitiesForArticle);
  const selectable = showDelete
    ? data.items.filter((post) => articleCapabilities(post).delete)
    : [];
  const selection = useTableSelection(selectable, `${search}:${suppliedData.page}`);
  const selectionDisabled =
    loading ||
    !!loadError ||
    optimistic.pending ||
    selection.pending ||
    toggleAction.pending ||
    historyPublication.pending;
  function togglePublication(post: BlogListItem, locale: string, published: boolean) {
    if (!articleCapabilities(post).publish || !onSetPublished || selectionDisabled) return;
    if (published && client?.history) {
      void toggleAction.run(JSON.stringify(["history-target", post.id, locale]), async () => {
        const article = await client.get(post.id),
          versionId = article.translations[locale]?.history?.currentId;
        if (!toggleAction.isCurrent()) return;
        if (versionId)
          await historyPublication.prepare({
            id: post.id,
            version: article.version,
            locale,
            versionId,
          });
        else await onSetPublished(post.id, locale, published, crypto.randomUUID());
        return true;
      });
      return;
    }
    void toggleAction.run(
      JSON.stringify([post.id, locale, published]),
      (requestId) =>
        optimistic.run(
          (page) => ({
            ...page,
            items: page.items.map((row) =>
              row.id === post.id
                ? {
                    ...row,
                    translations: row.translations.map((translation) =>
                      translation.locale === locale
                        ? { ...translation, status: published ? "published" : "draft" }
                        : translation,
                    ),
                  }
                : row,
            ),
          }),
          () => onSetPublished(post.id, locale, published, requestId),
        ),
      published ? labels.publishedSuccess : labels.unpublishedSuccess,
    );
  }
  return (
    <section className={cn(pageClass, className)}>
      {historyPublication.dialog}
      <Feedback {...historyPublication.feedback} />
      <div className={cn(tablePanelClass, "space-y-5")}>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-sans text-base font-semibold">{labels.blogs}</h1>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <TableSearch
              value={search}
              onValueChange={onSearchChange}
              label={labels.search}
              clearLabel={labels.clearSearch}
            />
            {capabilities.manageCategories && (
              <BlogLink href={categoriesHref} className={outlineButtonClass}>
                <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.manageCategories}
              </BlogLink>
            )}
            {capabilities.create && (
              <BlogLink href={newHref} className={primaryClass}>
                <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.createAction ?? labels.newPost}
              </BlogLink>
            )}
          </div>
        </header>
        {!capabilities.edit && <Feedback message={labels.readOnly} />}
        <div className="relative overflow-x-auto">
          <table className={tableClass} aria-busy={loading}>
            {loading && data.items.length > 0 && (
              <caption className="sr-only">
                <output>{labels.loading}</output>
              </caption>
            )}
            <thead>
              <tr className={tableRowClass}>
                {showDelete && (
                  <th scope="col" className="w-10 p-2">
                    <TableSelectionCheckbox
                      label={labels.selectAllRows}
                      checked={selection.all}
                      mixed={selection.mixed}
                      onChange={selection.toggleAll}
                      disabled={selectionDisabled || !selectable.length}
                    />
                  </th>
                )}
                {[
                  labels.title,
                  labels.categories,
                  labels.languages,
                  labels.author,
                  labels.editor,
                  labels.modified,
                  labels.actions,
                ].map((label, index) => (
                  <th
                    key={label}
                    scope="col"
                    className={index === 6 ? tableActionHeaderClass : tableHeaderClass}
                  >
                    <div
                      className={index === 6 ? "flex items-center justify-end gap-2" : undefined}
                    >
                      {label}
                      {index === 6 && showDelete && (
                        <TableBulkDelete
                          selection={selection}
                          getName={(post) => post.title}
                          onDelete={(post, requestId) => onDelete!(post.id, requestId)}
                          labels={labels}
                          disabled={selectionDisabled}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {((error && !loading) || data.items.length === 0) && (
                <tr>
                  <td colSpan={7 + (showDelete ? 1 : 0)} className={cn(tableCellClass, "py-8")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Feedback
                        message={loading ? labels.loading : error || labels.empty}
                        error={!loading && !!error}
                      />
                      {error && !loading && onRetry && (
                        <button type="button" className={buttonClass} onClick={onRetry}>
                          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                          {labels.retry}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {retainRemovedItems(data.items, suppliedData.items, optimistic.pending).map(
                (post) => {
                  const canPublish = articleCapabilities(post).publish && !!onSetPublished;
                  const StatusBadge = canPublish ? "button" : "span";
                  return (
                    <tr
                      key={post.id}
                      hidden={
                        selection.isDeleting(post.id) ||
                        !data.items.some((row) => row.id === post.id)
                      }
                      className={tableRowClass}
                    >
                      {showDelete && (
                        <td className="w-10 p-2">
                          <TableSelectionCheckbox
                            label={`${labels.selectRow}: ${post.title}`}
                            checked={selection.selected.some((row) => row.id === post.id)}
                            mixed={false}
                            onChange={(checked) => selection.toggle(post.id, checked)}
                            disabled={selectionDisabled || !articleCapabilities(post).delete}
                          />
                        </td>
                      )}
                      <td className={cn(tableCellClass, "min-w-48 font-medium")}>
                        <BlogLink
                          href={editHref(post.id)}
                          className="block max-w-48 truncate text-foreground hover:underline md:max-w-72"
                          title={post.title}
                        >
                          {post.title}
                        </BlogLink>
                      </td>
                      <td className={tableCellClass}>
                        <p className="max-w-48 truncate" title={post.categoryNames?.join(", ")}>
                          {post.categoryNames?.join(", ") || "—"}
                        </p>
                      </td>
                      <td className={cn(tableCellClass, "min-w-48 whitespace-nowrap")}>
                        <div className="flex flex-nowrap gap-2">
                          {post.translations.map((t) => (
                            <StatusBadge
                              key={t.locale}
                              type={canPublish ? "button" : undefined}
                              title={labels[t.status]}
                              aria-label={
                                canPublish
                                  ? `${labels.publicationStatus}: ${t.locale.toUpperCase()}`
                                  : undefined
                              }
                              aria-pressed={canPublish ? t.status !== "draft" : undefined}
                              disabled={
                                canPublish
                                  ? loading ||
                                    optimistic.pending ||
                                    selection.pending ||
                                    toggleAction.pending ||
                                    !!loadError
                                  : undefined
                              }
                              onClick={
                                canPublish
                                  ? () => togglePublication(post, t.locale, t.status === "draft")
                                  : undefined
                              }
                              className={cn(
                                "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
                                blogStatusClass[t.status],
                                canPublish && publicationToggleClass,
                              )}
                            >
                              {t.locale.toUpperCase()}
                              <span className="sr-only"> · {labels[t.status]}</span>
                            </StatusBadge>
                          ))}
                        </div>
                      </td>
                      <td className={tableCellClass}>{(post.author ?? post.editor).name}</td>
                      <td className={tableCellClass}>{post.editor.name}</td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>
                        <time dateTime={post.updatedAt}>{formatDate(post.updatedAt, "")}</time>
                      </td>
                      <td className={tableActionCellClass}>
                        <div className={tableActionsClass}>
                          <IconTooltip label={`${labels.edit}: ${post.title}`}>
                            <BlogLink
                              href={editHref(post.id)}
                              className={iconButtonClass}
                              aria-label={`${labels.edit}: ${post.title}`}
                            >
                              <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                            </BlogLink>
                          </IconTooltip>
                          {showDelete && articleCapabilities(post).delete && (
                            <ConfirmDelete
                              labels={labels}
                              disabled={selectionDisabled}
                              title={`${labels.deleteTitle}: ${post.title}`}
                              label={`${labels.delete}: ${post.title}`}
                              description={labels.deleteDescription}
                              onDelete={(requestId) =>
                                optimistic.run(
                                  (page) => ({
                                    ...page,
                                    items: page.items.filter((row) => row.id !== post.id),
                                    total: Math.max(0, suppliedData.total - 1),
                                  }),
                                  () => onDelete!(post.id, requestId),
                                )
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          {...data}
          onPageChange={onPageChange}
          labels={labels}
          disabled={selectionDisabled}
        />
      </div>
    </section>
  );
}
export interface BlogNewPageProps extends BlogsAppearanceProps {
  client: BlogsClient;
  locales: BlogLocale[];
  defaultLocale: string;
  backHref: string;
  onCreated: (article: BlogArticle) => void;
  capabilities: BlogCapabilities;
}
function BlogNewPageContent({
  client,
  locales,
  defaultLocale,
  backHref,
  onCreated,
  capabilities,
  labels: overrides,
  linkComponent: BlogLink = Link,
  className,
}: BlogNewPageProps) {
  const labels = { ...blogsLabels, ...overrides },
    action = useBlogAction(labels),
    id = `factory-blog-form-${useId()}`;
  const [title, setTitle] = useState(""),
    [locale, setLocale] = useState(defaultLocale);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(JSON.stringify([title, locale]), (requestId) =>
      client.create({ title, locale, requestId }),
    );
    if (result) onCreated(result);
  }
  return (
    <section className={cn(pageClass, className)}>
      <BlogLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        ← {labels.back}
      </BlogLink>
      <h1 className="font-serif text-3xl font-semibold">{labels.newPost}</h1>
      <form onSubmit={(e) => void submit(e)} className={cn(cardClass, "max-w-2xl space-y-5")}>
        <fieldset disabled={action.pending || !capabilities.create} className="space-y-5">
          <Tabs.Root value={locale} onValueChange={(value) => setLocale(value as string)}>
            <Tabs.List
              aria-label={labels.language}
              className="flex gap-1 overflow-x-auto border-b border-border"
            >
              {locales.map((l) => (
                <Tabs.Tab
                  key={l.code}
                  type="button"
                  value={l.code}
                  disabled={action.pending || !capabilities.create}
                  className={languageTabClass}
                >
                  {l.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel key={locale} value={locale} className="space-y-2 pt-5">
              <label htmlFor={`${id}-title`}>{labels.title} *</label>
              <input
                id={`${id}-title`}
                required
                maxLength={250}
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Tabs.Panel>
          </Tabs.Root>
          <button className={primaryClass} disabled={!title.trim()}>
            {action.pending ? labels.pending : labels.create}
          </button>
        </fieldset>
        <Feedback {...action.feedback} />
      </form>
    </section>
  );
}
export interface BlogCategoriesPageProps extends BlogsAppearanceProps {
  blockedNavigation?: BlogEditPageProps["blockedNavigation"];
  onNavigationStateChange?: BlogEditPageProps["onNavigationStateChange"];
  client: BlogsClient;
  categories: BlogCategory[];
  locales: BlogLocale[];
  capabilities: BlogCapabilities;
  backHref: string;
  onChanged: () => void;
}
function BlogCategoriesPageContent({
  client: suppliedClient,
  categories: suppliedCategories,
  locales,
  capabilities,
  backHref,
  onChanged,
  blockedNavigation,
  onNavigationStateChange,
  labels: overrides,
  linkComponent: BlogLink = Link,
  className,
}: BlogCategoriesPageProps) {
  const labels = { ...blogsLabels, ...overrides };
  const optimistic = useOptimisticAction(suppliedCategories, suppliedClient);
  const categories = optimistic.value;
  const run = useRef(optimistic.run);
  useLayoutEffect(() => {
    run.current = optimistic.run;
  });
  const client = useMemo<BlogsClient>(
    () => ({
      ...suppliedClient,
      saveCategory: (input) => {
        const id = input.id ?? `pending-${crypto.randomUUID()}`;
        let category: BlogCategory = { ...input, id, version: input.version ?? 0 };
        return run.current(
          (rows) =>
            input.id ? rows.map((row) => (row.id === id ? category : row)) : [...rows, category],
          async () => {
            category = await suppliedClient.saveCategory(input);
            return category;
          },
        );
      },
      deleteCategory: (input) =>
        run.current(
          (rows) => rows.filter((row) => row.id !== input.id),
          () => suppliedClient.deleteCategory(input),
        ),
    }),
    [suppliedClient],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const childrenByParent = new Map<string, BlogCategory[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentId, children);
  }
  const categoryButton = (category: BlogCategory) => (
    <button
      type="button"
      aria-current={selected === category.id ? "page" : undefined}
      className={cn(
        buttonClass,
        "w-full min-w-0 justify-start text-left wrap-anywhere whitespace-normal aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary",
        category.parentId ? "font-normal text-muted-foreground" : "font-semibold",
      )}
      disabled={optimistic.pending || category.id.startsWith("pending-")}
      onClick={() => setSelected(category.id)}
    >
      {Object.values(category.translations)[0]?.name}
    </button>
  );
  return (
    <section className={cn(pageClass, className)}>
      <BlogLink
        href={backHref}
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
      >
        ← {labels.back}
      </BlogLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{labels.categories}</h1>
        {capabilities.manageCategories && (
          <button
            className={primaryClass}
            disabled={optimistic.pending}
            onClick={() => setSelected(null)}
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.createAction ?? labels.newCategory}
          </button>
        )}
      </header>
      <Feedback message={optimistic.error ? labels.error : undefined} error />
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label={labels.categories} className={cn(cardClass, "self-start")}>
          <ul className="space-y-2">
            {categories
              .filter((category) => !category.parentId)
              .map((parent) => {
                const children = childrenByParent.get(parent.id) ?? [];
                return (
                  <li key={parent.id}>
                    {categoryButton(parent)}
                    {children.length > 0 && (
                      <ul
                        className={cn(
                          "mt-1 ml-3 space-y-1 border-l border-border pl-2",
                          children.some((child) => child.id === selected) && "border-primary",
                        )}
                      >
                        {children.map((child) => (
                          <li key={child.id}>{categoryButton(child)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
        </nav>
        <BlogCategoryEditor
          blockedNavigation={blockedNavigation}
          onNavigationStateChange={onNavigationStateChange}
          key={selected ?? "new"}
          category={
            categories.find((c) => c.id === selected) ??
            suppliedCategories.find((c) => c.id === selected)
          }
          categories={categories}
          locales={locales}
          client={client}
          disabled={!capabilities.manageCategories}
          labels={labels}
          onSaved={(category, leaving) => {
            if (!leaving) setSelected(category.id);
            onChanged();
          }}
          onDeleted={() => {
            setSelected(null);
            onChanged();
          }}
        />
      </div>
    </section>
  );
}
export function BlogsPage(props: BlogsPageProps) {
  const owner = useMemo(
    () => ({ client: props.client, search: props.search, page: props.data.page }),
    [props.client, props.search, props.data.page],
  );
  return (
    <ActionToastProvider>
      <BlogEditorClient value={owner}>
        <BlogsPageContent {...props} />
      </BlogEditorClient>
    </ActionToastProvider>
  );
}

export function BlogNewPage(props: BlogNewPageProps) {
  return (
    <ActionToastProvider>
      <BlogNewPageContent {...props} />
    </ActionToastProvider>
  );
}

export function BlogCategoriesPage(props: BlogCategoriesPageProps) {
  return (
    <ActionToastProvider>
      <BlogCategoriesPageContent {...props} />
    </ActionToastProvider>
  );
}

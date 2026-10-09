"use client";

import { Tabs } from "@base-ui/react/tabs";
import {
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  PencilIcon,
  Quote,
} from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { Image } from "@/components/image";
import { Link } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import { blogsLabels } from "@/components/plugins/blogs/labels";
import { BlogMarkdown } from "@/components/plugins/blogs/public";
import type {
  BlogArticle,
  BlogAsset,
  BlogCapabilities,
  BlogCategory,
  BlogContent,
  BlogListItem,
  BlogLocale,
  BlogPage,
  BlogShared,
  BlogsAppearanceProps,
  BlogsClient,
} from "@/components/plugins/blogs/types";
import {
  buttonClass,
  cardClass,
  ConfirmDelete,
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
  emptyContent,
  hasUnpublishedChanges,
  MAX_IMAGE_BYTES,
  normalizeCategories,
  safeAssetUrl,
  slugify,
} from "@/components/plugins/blogs/utils";
import { TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";

const languageTabClass =
  "min-h-11 shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground focus-visible:rounded-t-md focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 data-[active]:border-primary data-[active]:text-foreground cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
const blogStatusClass = {
  published: "bg-status-success text-status-success-foreground",
  changed: "bg-status-pending text-status-pending-foreground",
  draft: "bg-status-not-started text-status-not-started-foreground",
};

export interface BlogsPageProps extends BlogsAppearanceProps {
  data: BlogPage<BlogListItem>;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  editHref: (id: string) => string;
  newHref: string;
  categoriesHref: string;
  capabilities: BlogCapabilities;
  onDelete?: (id: string, requestId: string) => Promise<void>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}
function BlogsPageContent({
  data,
  search,
  onSearchChange,
  onPageChange,
  editHref,
  newHref,
  categoriesHref,
  capabilities,
  onDelete,
  loading,
  error,
  onRetry,
  labels: overrides,
  linkComponent: BlogLink = Link,
  formatDate = (iso) => new Date(iso).toISOString().slice(0, 10),
  className,
}: BlogsPageProps) {
  const labels = { ...blogsLabels, ...overrides };
  return (
    <section className={cn(pageClass, className)}>
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
                {labels.newPost}
              </BlogLink>
            )}
          </div>
        </header>
        {!capabilities.edit && <Feedback message={labels.readOnly} />}
        {error ? (
          <>
            <Feedback message={error} error />
            {onRetry && (
              <button className={buttonClass} onClick={onRetry}>
                <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.retry}
              </button>
            )}
          </>
        ) : loading ? (
          <Feedback message={labels.loading} />
        ) : !data.items.length ? (
          <Feedback message={labels.empty} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={tableRowClass}>
                  {[
                    labels.title,
                    labels.categories,
                    labels.languages,
                    labels.editor,
                    labels.modified,
                    labels.actions,
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={index === 5 ? tableActionCellClass : tableHeaderClass}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {data.items.map((post) => (
                  <tr key={post.id} className={tableRowClass}>
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
                          <span
                            key={t.locale}
                            title={labels[t.status]}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
                              blogStatusClass[t.status],
                            )}
                          >
                            {t.locale.toUpperCase()}
                            <span className="sr-only"> · {labels[t.status]}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={tableCellClass}>{post.editor.name}</td>
                    <td className={cn(tableCellClass, "whitespace-nowrap")}>
                      <time dateTime={post.updatedAt}>{formatDate(post.updatedAt, "")}</time>
                    </td>
                    <td className={tableActionCellClass}>
                      <div className="flex justify-end gap-2">
                        <BlogLink
                          href={editHref(post.id)}
                          className={iconButtonClass}
                          aria-label={`${labels.edit}: ${post.title}`}
                        >
                          <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                        </BlogLink>
                        {capabilities.delete && onDelete && (
                          <ConfirmDelete
                            labels={labels}
                            title={`${labels.deleteTitle}: ${post.title}`}
                            label={`${labels.delete}: ${post.title}`}
                            description={labels.deleteDescription}
                            onDelete={(requestId) => onDelete(post.id, requestId)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...data} onPageChange={onPageChange} labels={labels} />
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
export interface BlogEditPageProps extends BlogsAppearanceProps {
  client: BlogsClient;
  article: BlogArticle;
  categories: BlogCategory[];
  assets: BlogAsset[];
  locales: BlogLocale[];
  defaultLocale: string;
  backHref: string;
  capabilities: BlogCapabilities;
  onSaved?: (article: BlogArticle) => void;
  onDeleted: () => void;
}
function BlogEditPageContent(props: BlogEditPageProps) {
  return <Editor key={props.article.id} {...props} />;
}
function Editor(props: BlogEditPageProps) {
  const [locale, setLocale] = useState(props.defaultLocale),
    [dirty, setDirty] = useState(false);
  const labels = { ...blogsLabels, ...props.labels };
  return (
    <section className={cn(pageClass, props.className)}>
      <BackLink {...props} />
      <Tabs.Root value={locale} onValueChange={(value) => setLocale(value as string)}>
        <Tabs.List
          aria-label={labels.language}
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {props.locales.map((l) => (
            <Tabs.Tab
              key={l.code}
              type="button"
              value={l.code}
              disabled={dirty && l.code !== locale}
              className={languageTabClass}
            >
              {l.name}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel key={locale} value={locale} className="space-y-6 pt-6">
          <EditorForm {...props} locale={locale} onDirty={setDirty} />
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}
function BackLink({
  linkComponent: BlogLink = Link,
  backHref,
  labels: overrides,
}: Pick<BlogEditPageProps, "linkComponent" | "backHref" | "labels">) {
  return (
    <BlogLink href={backHref} className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}>
      ← {{ ...blogsLabels, ...overrides }.back}
    </BlogLink>
  );
}
function EditorForm({
  client,
  article,
  categories,
  assets: initialAssets,
  locale,
  capabilities,
  onSaved,
  onDeleted,
  onDirty,
  labels: overrides,
  assetUrl,
  imageComponent: BlogImage = Image,
  linkComponent,
  maxImageBytes = MAX_IMAGE_BYTES,
  maxMarkdownBytes,
}: BlogEditPageProps & { locale: string; onDirty: (dirty: boolean) => void }) {
  const labels = { ...blogsLabels, ...overrides },
    action = useBlogAction(labels),
    id = `factory-blog-form-${useId()}`,
    textarea = useRef<HTMLTextAreaElement>(null);
  const [base, setBase] = useState(article),
    [content, setContent] = useState<BlogContent>(() => ({
      ...emptyContent,
      ...article.translations[locale]?.draft,
    })),
    [shared, setShared] = useState<BlogShared>(() => structuredClone(article.shared)),
    [assets, setAssets] = useState(initialAssets),
    [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState("");
  const readOnly = !capabilities.edit,
    pending = action.pending,
    status = !base.translations[locale]?.published
      ? "draft"
      : hasUnpublishedChanges(base, locale)
        ? "changed"
        : "published";
  function changed() {
    setDirty(true);
    onDirty(true);
    setValidation("");
  }
  function field<K extends keyof BlogContent>(key: K, value: BlogContent[K]) {
    changed();
    setContent((c) => ({ ...c, [key]: value }));
  }
  function sharedField<K extends keyof BlogShared>(key: K, value: BlogShared[K]) {
    changed();
    setShared((s) => ({ ...s, [key]: value }));
  }
  function accept(result: BlogArticle) {
    setBase(result);
    setContent({ ...emptyContent, ...result.translations[locale]?.draft });
    setShared(structuredClone(result.shared));
    setDirty(false);
    onDirty(false);
    onSaved?.(result);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    onDirty(true);
    const result = await action.run(
      JSON.stringify(["save", base.version, locale, content, shared]),
      (requestId) =>
        client.save({ id: base.id, version: base.version, locale, content, shared, requestId }),
      labels.saved,
    );
    if (result) accept(result);
    else onDirty(dirty);
  }
  async function publish(remove = false) {
    if (pending) return;
    if (dirty) {
      setValidation(labels.unsaved);
      return;
    }
    onDirty(true);
    const result = await action.run(
      JSON.stringify([remove ? "unpublish" : "publish", base.version, locale]),
      (requestId) =>
        client[remove ? "unpublish" : "publish"]({
          id: base.id,
          version: base.version,
          locale,
          requestId,
        }),
      remove ? labels.unpublishedSuccess : labels.publishedSuccess,
    );
    if (result) accept(result);
    else onDirty(dirty);
  }
  function insert(prefix: string, suffix = "") {
    const target = textarea.current,
      start = target?.selectionStart ?? content.markdown.length,
      end = target?.selectionEnd ?? start;
    field(
      "markdown",
      content.markdown.slice(0, start) +
        prefix +
        content.markdown.slice(start, end) +
        suffix +
        content.markdown.slice(end),
    );
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  async function upload(file: File, target: "thumbnailId" | "bannerId" | "inline") {
    if (pending) return;
    if (
      file.size > maxImageBytes ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setValidation(labels.INVALID);
      return;
    }
    onDirty(true);
    const result = await action.run(
      JSON.stringify(["upload", file.name, file.size, file.lastModified, target]),
      (requestId) => client.upload({ id: base.id, file, requestId }),
      labels.uploaded,
    );
    if (result) {
      setAssets((previous) => [...previous.filter((a) => a.id !== result.id), result]);
      if (target === "inline") insert(`![](${`./assets/${result.id}`})`);
      else sharedField(target, result.id);
    } else onDirty(dirty);
  }
  function imageField(
    target: "thumbnailId" | "bannerId",
    alt: "thumbnailAlt" | "bannerAlt",
    label: string,
  ) {
    return (
      <div className="space-y-3">
        <label htmlFor={`${id}-${target}`} className="text-sm font-medium">
          {label}
        </label>
        <NativeSelect
          id={`${id}-${target}`}
          className={inputClass}
          value={shared[target] ?? ""}
          onChange={(e) => sharedField(target, e.target.value || null)}
        >
          <option value="">{labels.noImage}</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        {shared[target] && (
          <BlogImage
            src={safeAssetUrl(assetUrl(shared[target]!))}
            alt={content[alt]}
            className="aspect-video max-h-48 w-full rounded-2xl object-cover"
          />
        )}
        {capabilities.upload && (
          <label className="block space-y-2 text-sm">
            {labels.upload}
            <input
              aria-label={`${labels.upload} — ${label}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted file:px-3 file:py-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file, target);
              }}
            />
          </label>
        )}
        <label className="block space-y-2 text-sm">
          <span>
            {label} · {labels.alt}
          </span>
          <input
            className={inputClass}
            maxLength={1000}
            value={content[alt]}
            onChange={(e) => field(alt, e.target.value)}
          />
        </label>
      </div>
    );
  }
  const categoryCheckbox = (category: BlogCategory) => (
    <label
      className={cn(
        "flex min-w-0 items-start gap-2 text-sm",
        category.parentId ? "text-muted-foreground" : "font-medium",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        checked={shared.categoryIds.includes(category.id)}
        onChange={(e) => {
          const ids = e.target.checked
            ? [...shared.categoryIds, category.id]
            : shared.categoryIds.filter(
                (value) =>
                  value !== category.id &&
                  categories.find((c) => c.id === value)?.parentId !== category.id,
              );
          sharedField("categoryIds", normalizeCategories(ids, categories));
        }}
      />
      <span className="min-w-0 wrap-anywhere">
        {category.translations[locale]?.name ?? Object.values(category.translations)[0]?.name}
      </span>
    </label>
  );
  return (
    <>
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 font-serif text-3xl font-semibold wrap-anywhere">
            {content.title || labels.newPost}
          </h1>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
              blogStatusClass[status],
            )}
          >
            {labels[status]}
          </span>
        </div>
        {!base.translations[locale] && (
          <p className="text-sm text-muted-foreground">{labels.translationHint}</p>
        )}
        {readOnly && <Feedback message={labels.readOnly} />}
      </header>
      <form onSubmit={(e) => void save(e)} className="space-y-6" aria-busy={pending}>
        <fieldset
          disabled={pending || readOnly}
          className={cn(cardClass, "grid min-w-0 gap-5 md:grid-cols-2")}
        >
          <label className="space-y-2 text-sm font-medium">
            <span>{labels.title}</span>
            <input
              maxLength={250}
              className={inputClass}
              value={content.title}
              onChange={(e) => field("title", e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>{labels.slug}</span>
            <input
              maxLength={120}
              className={inputClass}
              value={content.slug}
              onChange={(e) => field("slug", e.target.value)}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label className="space-y-2 text-sm font-medium md:col-span-2">
            <span>{labels.summary}</span>
            <textarea
              rows={3}
              maxLength={2000}
              className={cn(inputClass, "h-auto py-3")}
              value={content.summary}
              onChange={(e) => field("summary", e.target.value)}
            />
          </label>
        </fieldset>
        <fieldset disabled={pending || readOnly} className={cn(cardClass, "space-y-5")}>
          <legend className="sr-only">{labels.shared}</legend>
          <div>
            <h2 className="text-lg font-semibold">{labels.shared}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.sharedHint}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {imageField("thumbnailId", "thumbnailAlt", labels.thumbnail)}
            {imageField("bannerId", "bannerAlt", labels.banner)}
          </div>
          <p className="text-xs text-muted-foreground">{labels.imageHint}</p>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">{labels.categories}</legend>
            <ul className="grid gap-4 sm:grid-cols-2">
              {categories
                .filter((category) => !category.parentId)
                .map((parent) => {
                  const children = categories.filter((category) => category.parentId === parent.id);
                  return (
                    <li key={parent.id} className="min-w-0">
                      {categoryCheckbox(parent)}
                      {children.length > 0 && (
                        <ul className="mt-2 ml-2 space-y-2 border-l border-border pl-4">
                          {children.map((child) => (
                            <li key={child.id}>{categoryCheckbox(child)}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          </fieldset>
        </fieldset>
        <div className={cn(cardClass, "space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor={`${id}-markdown`} className="text-lg font-semibold">
              {labels.markdown}
            </label>
            <fieldset aria-label={labels.markdown} className="flex flex-wrap gap-1">
              {[
                { label: labels.bold, icon: Bold, prefix: "**", suffix: "**" },
                { label: labels.italic, icon: Italic, prefix: "*", suffix: "*" },
                { label: labels.heading, icon: Heading2, prefix: "\n## ", suffix: "" },
                { label: labels.link, icon: Link2, prefix: "[", suffix: "](https://)" },
                { label: labels.list, icon: List, prefix: "\n- ", suffix: "" },
                { label: labels.quote, icon: Quote, prefix: "\n> ", suffix: "" },
                { label: labels.code, icon: Code, prefix: "`", suffix: "`" },
              ].map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  className={buttonClass}
                  disabled={pending || readOnly}
                  aria-label={tool.label}
                  onClick={() => insert(tool.prefix, tool.suffix)}
                >
                  <tool.icon />
                </button>
              ))}
              {capabilities.upload && !readOnly && (
                <label
                  className={cn(buttonClass, "relative focus-within:ring-2 focus-within:ring-ring")}
                >
                  <ImagePlus />
                  <span className="sr-only">{labels.insertImage}</span>
                  <input
                    aria-label={labels.insertImage}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={pending}
                    className="absolute inset-0 w-full cursor-pointer opacity-0"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(file, "inline");
                    }}
                  />
                </label>
              )}
            </fieldset>
          </div>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <textarea
              ref={textarea}
              id={`${id}-markdown`}
              className={cn(
                inputClass,
                "h-auto min-h-96 resize-y rounded-2xl py-4 font-mono text-sm leading-6",
              )}
              value={content.markdown}
              disabled={pending || readOnly}
              spellCheck={false}
              onChange={(e) => field("markdown", e.target.value)}
            />
            <section
              aria-label={labels.preview}
              className="min-w-0 rounded-2xl border border-border p-4"
            >
              <h2 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {labels.preview}
              </h2>
              <BlogMarkdown
                maxMarkdownBytes={maxMarkdownBytes}
                markdown={content.markdown}
                assetIds={assets.map((a) => a.id)}
                assetUrl={assetUrl}
                imageComponent={BlogImage}
                linkComponent={linkComponent}
              />
            </section>
          </div>
        </div>
        <Feedback message={validation} error />
        <Feedback {...action.feedback} />
        {dirty && <Feedback message={labels.unsaved} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {capabilities.delete && (
            <ConfirmDelete
              labels={labels}
              title={labels.deleteTitle}
              label={labels.delete}
              description={labels.deleteDescription}
              disabled={pending}
              onDelete={async (requestId) => {
                await client.delete({ id: base.id, version: base.version, requestId });
                onDeleted();
              }}
            />
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {capabilities.publish && (
              <>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={pending || dirty || !base.translations[locale]}
                  onClick={() => void publish()}
                >
                  {labels.publish}
                </button>
                {base.translations[locale]?.published && (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={pending || dirty}
                    onClick={() => void publish(true)}
                  >
                    {labels.unpublish}
                  </button>
                )}
              </>
            )}
            {capabilities.edit && (
              <button type="submit" disabled={pending} className={primaryClass}>
                {pending ? labels.pending : labels.save}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{labels.publicationHint}</p>
      </form>
    </>
  );
}

export interface BlogCategoriesPageProps extends BlogsAppearanceProps {
  client: BlogsClient;
  categories: BlogCategory[];
  locales: BlogLocale[];
  capabilities: BlogCapabilities;
  backHref: string;
  onChanged: () => void;
}
function BlogCategoriesPageContent({
  client,
  categories,
  locales,
  capabilities,
  backHref,
  onChanged,
  labels: overrides,
  linkComponent: BlogLink = Link,
  className,
}: BlogCategoriesPageProps) {
  const labels = { ...blogsLabels, ...overrides };
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
          <button className={primaryClass} onClick={() => setSelected(null)}>
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.newCategory}
          </button>
        )}
      </header>
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
        <CategoryForm
          key={selected ?? "new"}
          category={categories.find((c) => c.id === selected)}
          categories={categories}
          locales={locales}
          client={client}
          disabled={!capabilities.manageCategories}
          labels={labels}
          onSaved={(category) => {
            setSelected(category.id);
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
function CategoryForm({
  category,
  categories,
  locales,
  client,
  disabled,
  labels,
  onSaved,
  onDeleted,
}: {
  category?: BlogCategory;
  categories: BlogCategory[];
  locales: BlogLocale[];
  client: BlogsClient;
  disabled: boolean;
  labels: typeof blogsLabels;
  onSaved: (category: BlogCategory) => void;
  onDeleted: () => void;
}) {
  const [base, setBase] = useState(category),
    [translations, setTranslations] = useState(category?.translations ?? {}),
    [parentId, setParent] = useState(category?.parentId ?? "");
  const action = useBlogAction(labels);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      id: base?.id,
      version: base?.version,
      parentId: parentId || null,
      translations: Object.fromEntries(
        Object.entries(translations).filter(([, value]) => value.name.trim()),
      ),
    };
    const result = await action.run(
      JSON.stringify(input),
      (requestId) => client.saveCategory({ ...input, requestId }),
      labels.categorySaved,
    );
    if (result) {
      setBase(result);
      setTranslations(result.translations);
      onSaved(result);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className={cn(cardClass, "space-y-5")}>
      <header className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold">{base ? labels.edit : labels.newCategory}</h2>
        {base && !disabled && (
          <ConfirmDelete
            labels={labels}
            title={labels.deleteCategoryTitle}
            label={labels.deleteCategory}
            description={labels.deleteCategoryDescription}
            disabled={action.pending}
            onDelete={async (requestId) => {
              await client.deleteCategory({ id: base.id, version: base.version, requestId });
              onDeleted();
            }}
          />
        )}
      </header>
      <fieldset disabled={disabled || action.pending} className="space-y-5">
        <label className="block space-y-2 text-sm">
          <span>{labels.parent}</span>
          <NativeSelect
            className={inputClass}
            value={parentId}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value="">{labels.noParent}</option>
            {categories
              .filter((c) => !c.parentId && c.id !== base?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {Object.values(c.translations)[0]?.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        {locales.map((locale) => (
          <fieldset
            key={locale.code}
            className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2"
          >
            <legend className="px-2 text-sm font-medium">{locale.name}</legend>
            <label className="space-y-2 text-sm">
              <span>{labels.categoryName}</span>
              <input
                className={inputClass}
                maxLength={150}
                value={translations[locale.code]?.name ?? ""}
                onChange={(e) =>
                  setTranslations((t) => ({
                    ...t,
                    [locale.code]: {
                      name: e.target.value,
                      slug:
                        !t[locale.code]?.slug ||
                        t[locale.code].slug === slugify(t[locale.code].name)
                          ? slugify(e.target.value)
                          : t[locale.code].slug,
                    },
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{labels.slug}</span>
              <input
                className={inputClass}
                maxLength={120}
                value={translations[locale.code]?.slug ?? ""}
                onChange={(e) =>
                  setTranslations((t) => ({
                    ...t,
                    [locale.code]: { name: t[locale.code]?.name ?? "", slug: e.target.value },
                  }))
                }
              />
            </label>
          </fieldset>
        ))}
        <button className={primaryClass}>
          {action.pending ? labels.pending : labels.saveCategory}
        </button>
      </fieldset>
      <Feedback {...action.feedback} />
    </form>
  );
}

export function BlogsPage(props: BlogsPageProps) {
  return (
    <ActionToastProvider>
      <BlogsPageContent {...props} />
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

export function BlogEditPage(props: BlogEditPageProps) {
  return (
    <ActionToastProvider>
      <BlogEditPageContent {...props} />
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

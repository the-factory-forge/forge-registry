"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import {
  XIcon,
  HistoryIcon,
  GitCompareArrowsIcon,
  RefreshCwIcon,
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
import {
  useId,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import { ImageCropDialog, type ImageCropSize, type ImageCropLabels } from "@/components/image-crop";
import { ContentSidebarLayout } from "@/components/layouts/content-sidebar-layout";
import { Link } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import { NativeSelect } from "@/components/native-select";
import {
  BlogHistoryPanel,
  BlogHistoryReader,
  useHistoryPublication,
} from "@/components/plugins/blogs/history";
import { blogsLabels, type BlogsLabels } from "@/components/plugins/blogs/labels";
import { BlogMarkdown } from "@/components/plugins/blogs/public";
import type {
  BlogArticle,
  BlogAsset,
  BlogCapabilities,
  BlogCategory,
  BlogContent,
  BlogEditor,
  BlogHistoryHeader,
  BlogHistoryVersion,
  BlogHistoryOrigin,
  BlogLocale,
  BlogShared,
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
  primaryClass,
  useBlogAction,
} from "@/components/plugins/blogs/ui";
import {
  languageTabClass,
  blogStatusClass,
  publicationToggleClass,
} from "@/components/plugins/blogs/ui";
import {
  hasUnpublishedChanges,
  MAX_IMAGE_BYTES,
  MAX_MARKDOWN_BYTES,
  normalizeCategories,
  safeAssetUrl,
  slugify,
} from "@/components/plugins/blogs/utils";
import { emptyContent } from "@/components/plugins/blogs/utils";
import { cn } from "@/components/utils/cn";
function subscribeHistoryDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 1024px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const historyDesktopSnapshot = () => window.matchMedia("(min-width: 1024px)").matches;

import { editorActionsClass, useEditorValidation } from "@/components/utils/editor-form";

export interface BlogEditPageProps extends BlogsAppearanceProps {
  /** Covers are cropped by default; false retains original uploads. */
  imageDimensions?: Partial<Record<"thumbnail" | "banner", ImageCropSize>> | false;
  authors?: BlogEditor[];
  imageCropLabels?: Partial<ImageCropLabels>;
  client: BlogsClient;
  article: BlogArticle;
  categories: BlogCategory[];
  assets: BlogAsset[];
  locales: BlogLocale[];
  defaultLocale: string;
  backHref: string;
  /** Host route for category management; shown only to category managers. */
  categoriesHref?: string;
  capabilities: BlogCapabilities;
  onSaved?: (article: BlogArticle) => void;
  /** Let the host guard navigation outside this portable editor. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Host router reports a blocked transition for the existing leave dialog to resolve. */
  blockedNavigation?: { proceed: () => void; reset: () => void };
  /** Host routers use this state to guard history and other route changes. */
  onNavigationStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
  onDeleted: () => void;
}
function BlogEditPageContent(props: BlogEditPageProps) {
  return <Editor key={props.article.id} {...props} />;
}
function Editor(props: BlogEditPageProps) {
  const [locale, setLocale] = useState(props.defaultLocale);
  const labels = { ...blogsLabels, ...props.labels };
  const navigationRef = useRef<(next: () => void) => void>((next) => next());
  return (
    <section className={cn(pageClass, props.className)}>
      <BackLink {...props} onLeave={(next) => navigationRef.current(next)} />
      <Tabs.Root
        value={locale}
        onValueChange={(value) => navigationRef.current(() => setLocale(value as string))}
      >
        <Tabs.List
          aria-label={labels.language}
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {props.locales.map((l) => (
            <Tabs.Tab key={l.code} type="button" value={l.code} className={languageTabClass}>
              {l.name}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel key={locale} value={locale} className="space-y-6 pt-6">
          <BlogEditorClient value={props.client}>
            <EditorForm {...props} locale={locale} navigationRef={navigationRef} />
          </BlogEditorClient>
        </Tabs.Panel>
      </Tabs.Root>
    </section>
  );
}
function BackLink({
  linkComponent: BlogLink = Link,
  backHref,
  labels: overrides,
  onLeave,
}: Pick<BlogEditPageProps, "linkComponent" | "backHref" | "labels"> & {
  onLeave?: (next: () => void) => void;
}) {
  return (
    <BlogLink
      href={backHref}
      onClick={
        onLeave
          ? (event) => {
              if (
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              )
                return;
              event.preventDefault();
              onLeave(() => window.location.assign(backHref));
            }
          : undefined
      }
      className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
    >
      ← {{ ...blogsLabels, ...overrides }.back}
    </BlogLink>
  );
}
function BlogLeaveDialog({
  open,
  pending,
  labels,
  feedback,
  saveLabel,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  pending: boolean;
  labels: typeof blogsLabels;
  feedback?: { message: string; error?: boolean };
  saveLabel: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          className={cn(
            cardClass,
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto py-0 shadow-xl",
          )}
        >
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-card px-6 pt-5 pb-2"
          >
            <Dialog.Title className="min-w-0 flex-1 font-semibold break-words">
              {labels.unsavedTitle}
            </Dialog.Title>
            <IconTooltip label={labels.close ?? labels.cancel}>
              <Dialog.Close
                type="button"
                aria-label={labels.close ?? labels.cancel}
                disabled={pending}
                className={iconButtonClass}
              >
                <XIcon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.unsavedDescription}
          </Dialog.Description>
          <Feedback {...feedback} />
          <div
            data-dialog-footer
            className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-card px-6 pt-0 pb-5"
          >
            <Dialog.Close className={outlineButtonClass} disabled={pending}>
              {labels.cancel}
            </Dialog.Close>
            <button
              type="button"
              className={outlineButtonClass}
              disabled={pending}
              onClick={onDiscard}
            >
              {labels.discardChanges}
            </button>
            <button type="button" className={primaryClass} disabled={pending} onClick={onSave}>
              {pending ? labels.pending : saveLabel}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorForm({
  client,
  article,
  categories,
  assets: initialAssets,
  categoriesHref,
  locale,
  capabilities,
  onSaved,
  onDirtyChange,
  blockedNavigation,
  onNavigationStateChange,
  onDeleted,
  navigationRef,
  formatDate = (iso: string) => new Date(iso).toLocaleString(),
  labels: overrides,
  assetUrl,
  imageComponent: BlogImage = Image,
  linkComponent: BlogLink = Link,
  maxImageBytes = MAX_IMAGE_BYTES,
  maxMarkdownBytes = MAX_MARKDOWN_BYTES,
  imageDimensions = {
    thumbnail: { width: 1200, height: 900 },
    banner: { width: 1600, height: 900 },
  },
  authors = [],
  imageCropLabels,
}: BlogEditPageProps & {
  locale: string;
  navigationRef: RefObject<(next: () => void) => void>;
}) {
  const labels = { ...blogsLabels, ...overrides },
    id = `factory-blog-form-${useId()}`,
    textarea = useRef<HTMLTextAreaElement>(null);
  const draft = useBlogDraft({
    client,
    article,
    locale,
    labels,
    navigationRef,
    onSaved,
    onDirtyChange,
    blockedNavigation,
    onNavigationStateChange,
  });
  const { base, content, shared, dirty, origin, pending, status, publication, history } = draft;
  const {
    headers,
    selectedId,
    selected,
    bodyLoading,
    bodyError,
    compareWorking,
    mode: historyMode,
    loading: historyLoading,
    error: historyError,
  } = history;
  const [assets, setAssets] = useState(initialAssets);
  const [historyChoice, setHistoryOpen] = useState<boolean>();
  const contentArea = useRef<HTMLDivElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(
    subscribeHistoryDesktop,
    historyDesktopSnapshot,
    () => false,
  );
  const historyOpen = historyChoice ?? desktop;
  const { formRef, ...fields } = useEditorValidation();
  const [validation, setValidation] = useState("");
  const [crop, setCrop] = useState<{
    file: File;
    target: "thumbnailId" | "bannerId";
    dimensions: ImageCropSize;
  } | null>(null);
  const [previousClient, setPreviousClient] = useState(client);
  if (previousClient !== client) {
    setPreviousClient(client);
    setCrop(null);
    setValidation("");
  }
  const readOnly = !capabilities.edit;
  const StatusBadge = capabilities.publish ? "button" : "span";
  function field<K extends keyof BlogContent>(key: K, value: BlogContent[K]) {
    setValidation("");
    fields.clear(`${id}-${key}`);
    draft.editContent(key, value);
  }
  function sharedField<K extends keyof BlogShared>(key: K, value: BlogShared[K]) {
    setValidation("");
    if (key === "categoryIds") fields.clear(`${id}-category`);
    draft.editShared(key, value);
  }
  function validate(publishing = false) {
    const issues: Record<string, string> = {};
    if (publishing) {
      if (!shared.author) issues[`${id}-author`] = labels.AUTHOR_REQUIRED;
      for (const key of ["title", "slug", "markdown"] as const) {
        if (!content[key].trim()) issues[`${id}-${key}`] = labels.fieldRequired;
      }
      for (const category of categories) {
        if (
          shared.categoryIds.includes(category.id) &&
          !category.translations[locale]?.name.trim()
        ) {
          issues[`${id}-category.${category.id}`] = labels.categoryTranslationRequired;
        }
      }
    }
    if (content.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.slug)) {
      issues[`${id}-slug`] = labels.slugInvalid;
    }
    if (new TextEncoder().encode(content.markdown).length > maxMarkdownBytes) {
      issues[`${id}-markdown`] = labels.contentTooLong;
    }
    return fields.validate(issues);
  }
  async function save(event?: FormEvent, continueNavigation = false) {
    event?.preventDefault();
    if (pending) return false;
    if (!validate()) {
      draft.leave.cancel();
      return false;
    }
    return draft.save(continueNavigation);
  }
  async function publish(remove = false) {
    if (pending) return;
    if (dirty) {
      setValidation(labels.unsaved);
      return;
    }
    if (!remove && !validate(true)) return;
    await draft.publish(remove);
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
      if (!draft.isCurrent()) return;
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  async function upload(file: File, target: "thumbnailId" | "bannerId" | "inline") {
    if (pending || readOnly || !capabilities.upload) return false;
    if (
      file.size > maxImageBytes ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setValidation(labels.INVALID);
      return false;
    }

    const result = await draft.upload(file, target, (result) => {
      setAssets((previous) => [...previous.filter((a) => a.id !== result.id), result]);
      if (target === "inline") insert(`![](${`./assets/${result.id}`})`);
      else sharedField(target, result.id);
      setCrop(null);
    });
    return !!result;
  }
  function selectImage(file: File, target: "thumbnailId" | "bannerId") {
    if (pending || readOnly || !capabilities.upload) return;
    const dimensions =
      imageDimensions && imageDimensions[target === "thumbnailId" ? "thumbnail" : "banner"];
    if (dimensions) setCrop({ file, target, dimensions });
    else void upload(file, target);
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
                if (file) selectImage(file, target);
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
            {...fields.field(`${id}-${alt}`)}
            aria-label={`${label} · ${labels.alt}`}
            value={content[alt]}
            onChange={(e) => field(alt, e.target.value)}
          />
          {fields.message(`${id}-${alt}`)}
        </label>
      </div>
    );
  }
  const categoryCheckbox = (category: BlogCategory) => (
    <label
      className={cn(
        "flex min-w-0 items-start gap-2 text-sm",
        fields.issues[`${id}-category.${category.id}`] && "text-destructive",
        category.parentId ? "text-muted-foreground" : "font-medium",
      )}
    >
      <input
        {...fields.field(`${id}-category.${category.id}`)}
        aria-label={
          category.translations[locale]?.name ?? Object.values(category.translations)[0]?.name
        }
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-destructive"
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
        {fields.message(`${id}-category.${category.id}`)}
      </span>
    </label>
  );
  function inspect(header: BlogHistoryHeader, mode: "read" | "compare" = "read") {
    history.inspect(header, mode, () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) setHistoryOpen(false);
      requestAnimationFrame(() => contentArea.current?.focus());
    });
  }
  function resume(version: BlogHistoryVersion) {
    history.resume(version, () => {
      setValidation("");
      requestAnimationFrame(() => contentArea.current?.focus());
    });
  }
  const currentHeader = headers.find(
    (header) => header.id === base.translations[locale]?.history?.currentId,
  );
  const liveHeader = headers.find(
    (header) => header.id === base.translations[locale]?.history?.publishedId,
  );
  const workingPreview = dirty ? { origin, header: currentHeader } : undefined;
  const workingVersion: BlogHistoryVersion = {
    ...(currentHeader ?? {
      id: "working",
      number: 0,
      state: "draft",
      locale,
      savedAt: base.updatedAt,
      savedBy: base.editor,
      author: shared.author,
      repriseId: null,
      sourcePublicationId: null,
      sourcePublicationOrder: null,
      publicationOrder: null,
      publishedAt: null,
      omittedAssetIds: [],
    }),
    content: {
      ...base.translations[locale]?.draft,
      ...content,
      revisionId: null,
      assetIds: assets.map((asset) => asset.id),
      editor: base.editor,
      updatedAt: base.updatedAt,
    },
    shared,
    author: shared.author,
  };
  return (
    <>
      {publication.dialog}
      <BlogLeaveDialog
        open={draft.leave.requested}
        pending={pending}
        labels={labels}
        feedback={draft.feedback}
        saveLabel={labels.save}
        onCancel={draft.leave.cancel}
        onDiscard={draft.leave.discard}
        onSave={() => void save(undefined, true)}
      />
      <ContentSidebarLayout
        toolbar={
          client.history && (
            <div className="flex flex-wrap justify-end gap-2">
              {(draft.feedback?.error || publication.feedback?.error) && (
                <IconTooltip label={labels.refreshArticle}>
                  <button
                    aria-label={labels.refreshArticle}
                    type="button"
                    className={iconButtonClass}
                    disabled={pending}
                    onClick={() => void draft.refresh()}
                  >
                    <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </IconTooltip>
              )}
              {(selectedId || compareWorking) && (
                <button
                  type="button"
                  className={outlineButtonClass}
                  disabled={pending}
                  onClick={history.returnToDraft}
                >
                  {labels.returnToDraft}
                </button>
              )}
              {!selectedId && !compareWorking && (
                <button
                  type="button"
                  className={outlineButtonClass}
                  disabled={pending}
                  onClick={history.compareDraft}
                >
                  <GitCompareArrowsIcon aria-hidden="true" />
                  {labels.compareDraft}
                </button>
              )}
              <button
                type="button"
                className={cn(
                  outlineButtonClass,
                  historyOpen && primaryClass,
                  historyOpen && "border-primary",
                )}
                ref={historyTrigger}
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <HistoryIcon aria-hidden="true" />
                {labels.history}
              </button>
            </div>
          )
        }
        sidebar={
          client.history &&
          historyOpen && (
            <BlogHistoryPanel
              headers={headers}
              selectedId={selectedId}
              currentId={base.translations[locale]?.history?.currentId ?? null}
              publishedId={base.translations[locale]?.history?.publishedId ?? null}
              loading={historyLoading}
              error={historyError}
              labels={labels}
              onSelect={inspect}
              onCompare={(header) => inspect(header, "compare")}
              onRetry={history.retry}
              onClose={() => {
                setHistoryOpen(false);
                historyTrigger.current?.focus();
              }}
              disabled={pending}
              deleteDisabled={dirty}
              formatDate={(iso) => formatDate(iso, locale)}
              working={workingPreview}
              onDelete={capabilities.delete ? history.delete : undefined}
              onDeleted={history.accept}
            />
          )
        }
      >
        <div
          ref={contentArea}
          tabIndex={-1}
          className="@container/blog-editor flex min-w-0 flex-col gap-6 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {(selectedId || compareWorking) && (
            <div className="flex min-h-80 flex-1 flex-col" aria-busy={bodyLoading}>
              {bodyLoading && <Feedback message={labels.loading} />}
              {bodyError && (
                <div className="space-y-3">
                  <Feedback message={bodyError} error />
                  <p className="text-sm">{labels.versionMissing}</p>
                  <button type="button" className={outlineButtonClass} onClick={history.retry}>
                    {labels.retry}
                  </button>
                </div>
              )}
              {(selected || compareWorking) && (
                <BlogHistoryReader
                  key={selected?.id ?? "working"}
                  version={selected ?? workingVersion}
                  working={compareWorking && (dirty || !currentHeader)}
                  mode={historyMode}
                  onModeChange={history.changeMode}
                  publication={base.translations[locale]?.published}
                  liveLabel={liveHeader ? labels.versionLabel(liveHeader.number) : labels.live}
                  labels={labels}
                  categories={categories}
                  assetUrl={assetUrl}
                  imageComponent={BlogImage}
                  linkComponent={BlogLink}
                  formatDate={formatDate}
                  disabled={pending}
                  onResume={selected && capabilities.publish ? () => resume(selected) : undefined}
                  onPublish={
                    selected &&
                    capabilities.publish &&
                    selected.id !== base.translations[locale]?.history?.publishedId
                      ? () =>
                          void publication.prepare({
                            id: base.id,
                            version: base.version,
                            locale,
                            versionId: selected.id,
                          })
                      : undefined
                  }
                />
              )}
            </div>
          )}
          <div hidden={!!selectedId || compareWorking} className="space-y-6">
            {dirty && origin && (
              <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
                {labels.unsavedDraft} ·{" "}
                {labels.resumedFrom(
                  headers.find((header) => header.id === origin.versionId)
                    ? labels.versionLabel(
                        headers.find((header) => header.id === origin.versionId)!.number,
                      )
                    : labels.sourceUnavailable,
                )}
              </p>
            )}
            {currentHeader && !dirty && (
              <p className="text-sm text-muted-foreground">
                {labels.currentDraft} · {labels.versionLabel(currentHeader.number)}
              </p>
            )}
            {crop && !readOnly && capabilities.upload && (
              <ImageCropDialog
                file={crop.file}
                {...crop.dimensions}
                maxFileBytes={maxImageBytes}
                labels={imageCropLabels}
                onCancel={() => setCrop(null)}
                onConfirm={async (file) => {
                  if (!(await upload(file, crop.target))) throw new Error("Upload failed");
                }}
              />
            )}
            <header className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="min-w-0 flex-1 font-serif text-3xl font-semibold wrap-anywhere">
                  {content.title || labels.newPost}
                </h1>
                <StatusBadge
                  type={capabilities.publish ? "button" : undefined}
                  aria-label={capabilities.publish ? labels.publicationStatus : undefined}
                  aria-pressed={capabilities.publish ? status !== "draft" : undefined}
                  disabled={
                    capabilities.publish
                      ? pending || dirty || !base.translations[locale]
                      : undefined
                  }
                  onClick={
                    capabilities.publish ? () => void publish(status !== "draft") : undefined
                  }
                  className={cn(
                    "ml-auto inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
                    blogStatusClass[status],
                    capabilities.publish && publicationToggleClass,
                  )}
                >
                  {labels[status]}
                </StatusBadge>
              </div>
              {!base.translations[locale] && (
                <p className="text-sm text-muted-foreground">{labels.translationHint}</p>
              )}
              {readOnly && <Feedback message={labels.readOnly} />}
            </header>
            <form
              ref={formRef}
              noValidate
              onSubmit={(e) => void save(e)}
              className="space-y-6"
              aria-busy={pending}
            >
              <fieldset
                disabled={pending || readOnly}
                className={cn(cardClass, "grid min-w-0 gap-5 @min-[32rem]/blog-editor:grid-cols-2")}
              >
                <label className="space-y-2 text-sm font-medium">
                  <span>{labels.title}</span>
                  <input
                    maxLength={250}
                    className={inputClass}
                    {...fields.field(`${id}-title`)}
                    aria-label={labels.title}
                    value={content.title}
                    onChange={(e) => field("title", e.target.value)}
                  />
                  {fields.message(`${id}-title`)}
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>{labels.slug}</span>
                  <input
                    maxLength={120}
                    className={inputClass}
                    {...fields.field(`${id}-slug`)}
                    aria-label={labels.slug}
                    value={content.slug}
                    onChange={(e) => field("slug", e.target.value)}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  />
                  {fields.message(`${id}-slug`)}
                </label>
                <label className="space-y-2 text-sm font-medium @min-[32rem]/blog-editor:col-span-2">
                  <span>{labels.summary}</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    className={cn(inputClass, "h-auto py-3")}
                    {...fields.field(`${id}-summary`)}
                    aria-label={labels.summary}
                    value={content.summary}
                    onChange={(e) => field("summary", e.target.value)}
                  />
                  {fields.message(`${id}-summary`)}
                </label>
              </fieldset>
              <fieldset disabled={pending || readOnly} className={cn(cardClass, "space-y-5")}>
                <legend className="sr-only">{labels.shared}</legend>
                <div>
                  <h2 className="text-lg font-semibold">{labels.shared}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{labels.sharedHint}</p>
                </div>
                <label className="grid gap-2 text-sm font-medium">
                  <span>{labels.author}</span>
                  <NativeSelect
                    aria-label={labels.author}
                    className={inputClass}
                    {...fields.field(`${id}-author`)}
                    value={shared.author?.id ?? ""}
                    disabled={
                      !capabilities.changeAuthor ||
                      !authors.length ||
                      (!!origin && !shared.author && !capabilities.reviewLegacyAuthor)
                    }
                    onChange={(event) => {
                      const author = authors.find((person) => person.id === event.target.value);
                      if (author) {
                        fields.clear(`${id}-author`);
                        sharedField("author", author);
                      }
                    }}
                  >
                    {!shared.author && (
                      <option value="" disabled>
                        {labels.selectAuthor}
                      </option>
                    )}
                    {shared.author &&
                      !authors.some((person) => person.id === shared.author?.id) && (
                        <option value={shared.author.id}>{shared.author.name}</option>
                      )}
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name}
                      </option>
                    ))}
                  </NativeSelect>
                  {fields.message(`${id}-author`)}
                  {!shared.author && !fields.field(`${id}-author`)["aria-invalid"] && (
                    <span className="font-normal text-muted-foreground">
                      {labels.AUTHOR_REQUIRED}
                    </span>
                  )}
                </label>
                <div className="grid gap-6 @min-[32rem]/blog-editor:grid-cols-2">
                  {imageField("thumbnailId", "thumbnailAlt", labels.thumbnail)}
                  {imageField("bannerId", "bannerAlt", labels.banner)}
                </div>
                <p className="text-xs text-muted-foreground">{labels.imageHint}</p>
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">
                    <span className="inline-flex items-center gap-2">
                      {labels.categories}
                      {capabilities.manageCategories && categoriesHref && (
                        <IconTooltip label={labels.manageCategories}>
                          <BlogLink
                            href={categoriesHref}
                            className={iconButtonClass}
                            aria-label={labels.manageCategories}
                            onClick={(event) => {
                              if (
                                event.defaultPrevented ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey ||
                                event.button !== 0 ||
                                (!dirty && !pending)
                              )
                                return;
                              event.preventDefault();
                              navigationRef.current(() => window.location.assign(categoriesHref));
                            }}
                          >
                            <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                          </BlogLink>
                        </IconTooltip>
                      )}
                    </span>
                  </legend>
                  <ul className="grid gap-4 @min-[32rem]/blog-editor:grid-cols-2">
                    {categories
                      .filter((category) => !category.parentId)
                      .map((parent) => {
                        const children = categories.filter(
                          (category) => category.parentId === parent.id,
                        );
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
                      <IconTooltip key={tool.label} label={tool.label}>
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={pending || readOnly}
                          aria-label={tool.label}
                          onClick={() => insert(tool.prefix, tool.suffix)}
                        >
                          <tool.icon aria-hidden="true" />
                        </button>
                      </IconTooltip>
                    ))}
                    {capabilities.upload && !readOnly && (
                      <label
                        className={cn(
                          buttonClass,
                          "relative focus-within:ring-2 focus-within:ring-ring",
                        )}
                      >
                        <ImagePlus aria-hidden="true" />
                        <span className="sr-only">{labels.insertImage}</span>
                        <IconTooltip label={labels.insertImage}>
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
                        </IconTooltip>
                      </label>
                    )}
                  </fieldset>
                </div>
                <div className="grid min-w-0 gap-6 @min-[40rem]/blog-editor:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <textarea
                      ref={textarea}
                      {...fields.field(`${id}-markdown`)}
                      className={cn(
                        inputClass,
                        "h-auto min-h-64 resize-y rounded-2xl py-4 font-mono text-sm leading-6",
                      )}
                      value={content.markdown}
                      disabled={pending || readOnly}
                      spellCheck={false}
                      onChange={(e) => field("markdown", e.target.value)}
                    />
                    {fields.message(`${id}-markdown`)}
                  </div>
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
                      linkComponent={BlogLink}
                    />
                  </section>
                </div>
              </div>
              <Feedback message={validation} error />
              <Feedback {...draft.feedback} />
              {dirty && <Feedback message={labels.unsaved} />}
              <div className={editorActionsClass}>
                {capabilities.delete && (
                  <ConfirmDelete
                    labels={labels}
                    title={labels.deleteTitle}
                    label={labels.delete}
                    description={labels.deleteDescription}
                    disabled={pending}
                    onDelete={(requestId) =>
                      client.delete({ id: base.id, version: base.version, requestId })
                    }
                    onDeleted={onDeleted}
                  />
                )}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  {capabilities.publish && (
                    <>
                      {status !== "published" && (
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={pending || dirty || !base.translations[locale]}
                          onClick={() => void publish()}
                        >
                          {labels.publish}
                        </button>
                      )}
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
            </form>
          </div>
          <Feedback {...publication.feedback} />
        </div>
      </ContentSidebarLayout>
    </>
  );
}

export interface BlogCategoryEditorProps {
  category?: BlogCategory;
  categories: BlogCategory[];
  locales: BlogLocale[];
  client: BlogsClient;
  disabled: boolean;
  labels: typeof blogsLabels;
  onSaved: (category: BlogCategory, leaving: boolean) => void;
  blockedNavigation?: BlogEditPageProps["blockedNavigation"];
  onNavigationStateChange?: BlogEditPageProps["onNavigationStateChange"];
  onDeleted: () => void;
}

export function BlogCategoryEditor(props: BlogCategoryEditorProps) {
  return (
    <BlogEditorClient value={props.client}>
      <BlogCategoryEditorContent key={props.category?.id ?? "new"} {...props} />
    </BlogEditorClient>
  );
}

function BlogCategoryEditorContent({
  category,
  categories,
  locales,
  client,
  disabled,
  labels,
  onSaved,
  onDeleted,
  blockedNavigation,
  onNavigationStateChange,
}: BlogCategoryEditorProps) {
  const [base, setBase] = useState(category),
    [translations, setTranslations] = useState(category?.translations ?? {}),
    [parentId, setParent] = useState(category?.parentId ?? "");
  const action = useBlogAction(labels);
  const snapshot = JSON.stringify([translations, parentId]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const form = useRef<HTMLFormElement>(null);
  const editor = useBlogEditorState(
    !disabled && snapshot !== savedSnapshot,
    action.pending,
    onNavigationStateChange,
  );
  async function submit(event?: FormEvent, leaving = false) {
    event?.preventDefault();
    if (action.pending || disabled) return;
    if (!form.current?.checkValidity()) {
      blockedNavigation?.reset();
      requestAnimationFrame(() => form.current?.reportValidity());
      return;
    }
    const input = {
      id: base?.id,
      version: base?.version,
      parentId: parentId || null,
      translations: Object.fromEntries(
        Object.entries(translations).filter(([, value]) => value.name.trim()),
      ),
    };
    await action.run(
      JSON.stringify(input),
      (requestId) => client.saveCategory({ ...input, requestId }),
      labels.categorySaved,
      (result) => {
        const proceed = leaving ? blockedNavigation?.proceed : undefined;
        setSavedSnapshot(JSON.stringify([result.translations, result.parentId ?? ""]));
        setParent(result.parentId ?? "");
        setBase(result);
        setTranslations(result.translations);
        onSaved(result, !!proceed);
        if (proceed) editor.resume(proceed);
      },
    );
  }
  return (
    <>
      <BlogLeaveDialog
        open={!!blockedNavigation}
        pending={action.pending}
        labels={labels}
        feedback={action.feedback}
        saveLabel={labels.saveCategory}
        onCancel={() => {
          if (!action.pending) blockedNavigation?.reset();
        }}
        onDiscard={() => {
          if (!action.pending && blockedNavigation) editor.resume(blockedNavigation.proceed);
        }}
        onSave={() => void submit(undefined, true)}
      />
      <form ref={form} onSubmit={(e) => void submit(e)} className={cn(cardClass, "space-y-5")}>
        <header className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold">
            {base ? labels.edit : labels.newCategory}
          </h2>
          {base && !disabled && (
            <ConfirmDelete
              labels={labels}
              title={labels.deleteCategoryTitle}
              label={labels.deleteCategory}
              description={labels.deleteCategoryDescription}
              disabled={action.pending}
              onDelete={(requestId) =>
                client.deleteCategory({ id: base.id, version: base.version, requestId })
              }
              onDeleted={onDeleted}
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
    </>
  );
}

export function BlogEditPage(props: BlogEditPageProps) {
  return (
    <ActionToastProvider>
      <BlogEditPageContent {...props} />
    </ActionToastProvider>
  );
}

/** Private editor session: the owner remounts it when the article or language changes. */
function useBlogDraft({
  client,
  article,
  locale,
  labels,
  navigationRef,
  onSaved,
  onDirtyChange,
  blockedNavigation,
  onNavigationStateChange,
}: {
  client: BlogsClient;
  article: BlogArticle;
  locale: string;
  labels: BlogsLabels;
  navigationRef: RefObject<(next: () => void) => void>;
  onSaved?: (article: BlogArticle) => void;
  onDirtyChange?: (dirty: boolean) => void;
  blockedNavigation?: { proceed: () => void; reset: () => void };
  onNavigationStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
}) {
  const action = useBlogAction(labels);
  const [base, setBase] = useState(article);
  const [content, setContent] = useState<BlogContent>(() => ({
    ...emptyContent,
    ...article.translations[locale]?.draft,
  }));
  const [shared, setShared] = useState<BlogShared>(() =>
    structuredClone(article.translations[locale]?.shared ?? article.shared),
  );
  const [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState<BlogHistoryOrigin>();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [historyResult, setHistoryResult] = useState<{
    client?: BlogsClient;
    version?: number;
    locale?: string;
    refresh?: number;
    headers: BlogHistoryHeader[];
    error?: unknown;
  }>({ headers: [] });
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodyResult, setBodyResult] = useState<{
    client: BlogsClient;
    version: number;
    id: string;
    refresh: number;
    value?: BlogHistoryVersion;
    error?: unknown;
  }>();
  const [compareWorking, setCompareWorking] = useState(false);
  const [historyMode, setHistoryMode] = useState<"read" | "compare">("read");
  const publication = useHistoryPublication(client, labels, accept);
  const pending = action.pending || publication.pending;
  const editor = useBlogEditorState(dirty, pending, onNavigationStateChange);
  const [optimisticStatus, setOptimisticStatus] = useState<{
    scope: typeof action.scope;
    value: "draft" | "changed" | "published";
  }>();
  const status = publication.publishing
    ? "published"
    : action.pending && optimisticStatus?.scope === action.scope
      ? optimisticStatus.value
      : !base.translations[locale]?.published
        ? "draft"
        : hasUnpublishedChanges(base, locale)
          ? "changed"
          : "published";

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    navigationRef.current = (next) => {
      if (pending) return;
      if (dirty) setLeave(() => next);
      else next();
    };
    return () => {
      navigationRef.current = (next) => next();
    };
  }, [dirty, navigationRef, pending]);

  const historyLoading =
    !!client.history &&
    (historyResult.client !== client ||
      historyResult.version !== base.version ||
      historyResult.locale !== locale ||
      historyResult.refresh !== historyRefresh);
  const bodyLoading =
    !!selectedId &&
    (bodyResult?.id !== selectedId ||
      bodyResult.client !== client ||
      bodyResult.version !== base.version ||
      bodyResult.refresh !== historyRefresh);
  const selected =
    !bodyLoading && bodyResult?.id === selectedId ? (bodyResult.value ?? null) : null;
  useLoadingActivity(historyLoading || bodyLoading);

  useEffect(() => {
    if (!client.history) return;
    let active = true;
    void client.history.list({ id: base.id, locale }).then(
      (headers) => {
        if (active)
          setHistoryResult({
            client,
            version: base.version,
            locale,
            refresh: historyRefresh,
            headers,
          });
      },
      (error: unknown) => {
        if (active)
          setHistoryResult((previous) => ({
            ...previous,
            client,
            version: base.version,
            locale,
            refresh: historyRefresh,
            error,
          }));
      },
    );
    return () => {
      active = false;
    };
  }, [client, base.id, base.version, locale, historyRefresh]);

  useEffect(() => {
    if (!selectedId || !client.history) return;
    let active = true;
    void client.history.get({ id: base.id, locale, versionId: selectedId }).then(
      (value) => {
        if (active)
          setBodyResult({
            client,
            version: base.version,
            id: selectedId,
            refresh: historyRefresh,
            value,
          });
      },
      (error: unknown) => {
        if (active)
          setBodyResult({
            client,
            version: base.version,
            id: selectedId,
            refresh: historyRefresh,
            error,
          });
      },
    );
    return () => {
      active = false;
    };
  }, [client, base.id, base.version, locale, selectedId, historyRefresh]);

  function returnToDraft() {
    setSelectedId(null);
    setBodyResult(undefined);
    setCompareWorking(false);
  }
  function accept(result: BlogArticle) {
    setOrigin(undefined);
    returnToDraft();
    setBase(result);
    setContent({ ...emptyContent, ...result.translations[locale]?.draft });
    setShared(structuredClone(result.translations[locale]?.shared ?? result.shared));
    setDirty(false);
    onSaved?.(result);
  }
  async function save(continueNavigation = false) {
    if (pending) return false;
    const next = continueNavigation ? (blockedNavigation?.proceed ?? leave) : null;
    setOptimisticStatus({
      scope: action.scope,
      value: base.translations[locale]?.published ? "changed" : "draft",
    });
    const result = await action.run(
      JSON.stringify(["save", base.version, locale, content, shared, origin]),
      (requestId) =>
        client.save({
          id: base.id,
          version: base.version,
          locale,
          content,
          shared,
          origin,
          requestId,
        }),
      labels.saved,
      (saved) => {
        accept(saved);
        if (continueNavigation) {
          setLeave(null);
          if (next) editor.resume(next);
        }
      },
    );
    return !!result;
  }
  async function publish(remove = false) {
    if (pending || dirty) return;
    const versionId = base.translations[locale]?.history?.currentId;
    if (!remove && client.history && versionId) {
      await publication.prepare({ id: base.id, version: base.version, locale, versionId });
      return;
    }
    setOptimisticStatus({ scope: action.scope, value: remove ? "draft" : "published" });
    await action.run(
      JSON.stringify([remove ? "unpublish" : "publish", base.version, locale]),
      (requestId) =>
        client[remove ? "unpublish" : "publish"]({
          id: base.id,
          version: base.version,
          locale,
          requestId,
        }),
      remove ? labels.unpublishedSuccess : labels.publishedSuccess,
      accept,
    );
  }
  function refresh() {
    return action.run(
      "refresh-article",
      () => client.get(base.id),
      undefined,
      (latest) => {
        if (dirty || selectedId) {
          setBase(latest);
          if (!dirty) {
            setContent({ ...emptyContent, ...latest.translations[locale]?.draft });
            setShared(structuredClone(latest.translations[locale]?.shared ?? latest.shared));
          }
        } else accept(latest);
      },
    );
  }

  return {
    base,
    content,
    shared,
    dirty,
    origin,
    pending,
    status,
    feedback: action.feedback,
    isCurrent: action.isCurrent,
    publication,
    save,
    publish,
    refresh,
    editContent: <K extends keyof BlogContent>(key: K, value: BlogContent[K]) => {
      setContent((previous) => ({ ...previous, [key]: value }));
      setDirty(true);
    },
    editShared: <K extends keyof BlogShared>(key: K, value: BlogShared[K]) => {
      setShared((previous) => ({ ...previous, [key]: value }));
      setDirty(true);
    },
    upload: (
      file: File,
      target: "thumbnailId" | "bannerId" | "inline",
      onUploaded: (asset: BlogAsset) => void,
    ) => {
      return action.run(
        JSON.stringify(["upload", file.name, file.size, file.lastModified, target]),
        (requestId) => client.upload({ id: base.id, file, requestId }),
        labels.uploaded,
        onUploaded,
      );
    },
    leave: {
      requested: !!leave || !!blockedNavigation,
      cancel: () => {
        if (pending) return;
        setLeave(null);
        blockedNavigation?.reset();
      },
      discard: () => {
        if (pending) return;
        const next = blockedNavigation?.proceed ?? leave;
        accept(base);
        setLeave(null);
        if (next) editor.resume(next);
      },
    },
    history: {
      headers: historyResult.headers,
      loading: historyLoading,
      error:
        !historyLoading && historyResult.error
          ? errorMessage(historyResult.error, labels)
          : undefined,
      selectedId,
      selected,
      bodyLoading,
      bodyError:
        !bodyLoading && bodyResult?.error ? errorMessage(bodyResult.error, labels) : undefined,
      compareWorking,
      mode: historyMode,
      changeMode: (mode: "read" | "compare") => {
        setHistoryMode(mode);
      },
      retry: () => {
        setHistoryRefresh((value) => value + 1);
      },
      returnToDraft,
      compareDraft: () => {
        setHistoryMode("compare");
        setCompareWorking(true);
      },
      inspect: (header: BlogHistoryHeader, mode: "read" | "compare", onEntered: () => void) => {
        navigationRef.current(() => {
          setSelectedId(header.id);
          setHistoryMode(mode);
          setCompareWorking(false);
          onEntered();
        });
      },
      resume: (version: BlogHistoryVersion, onEntered: () => void) => {
        navigationRef.current(() => {
          setContent({ ...version.content });
          setShared(structuredClone(version.shared));
          setOrigin(
            version.state === "publication"
              ? { versionId: version.id, repriseId: crypto.randomUUID() }
              : { versionId: version.id },
          );
          returnToDraft();
          setDirty(true);
          onEntered();
        });
      },
      accept,
      delete: (version: BlogHistoryHeader, requestId: string) =>
        client.history!.delete({
          id: base.id,
          version: base.version,
          locale,
          versionId: version.id,
          requestId,
        }),
    },
  };
}

/** Blog drafts and categories share native protection and synchronous resume ordering. */
function useBlogEditorState(
  dirty: boolean,
  pending: boolean,
  onNavigationStateChange: BlogEditPageProps["onNavigationStateChange"],
) {
  const active = useRef(false);
  const state = useRef({ dirty: false, pending: false });
  useEffect(() => {
    state.current = { dirty, pending };
    onNavigationStateChange?.(state.current);
    return () => onNavigationStateChange?.({ dirty: false, pending: false });
  }, [dirty, pending, onNavigationStateChange]);
  useEffect(() => {
    active.current = true;
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty || state.current.pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      active.current = false;
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return {
    resume: (next: () => void) => {
      if (!active.current) return;
      // Clear before calling the host so a confirmed move never warns twice.
      state.current = { dirty: false, pending: false };
      onNavigationStateChange?.(state.current);
      next();
    },
  };
}

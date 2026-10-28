"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  EllipsisIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { createContext, useContext, useId, useMemo, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { IconTooltip } from "@/components/icon-tooltip";
import { Image, type ImageProps } from "@/components/image";
import { blogTextDiff } from "@/components/plugins/blogs/history-diff";
import { blogHistoryLabel, type BlogsLabels } from "@/components/plugins/blogs/labels";
import { BlogMarkdown } from "@/components/plugins/blogs/public";
import type {
  BlogArticle,
  BlogCategory,
  BlogHistoryHeader,
  BlogHistoryOrigin,
  BlogHistoryPlan,
  BlogHistoryTarget,
  BlogHistoryVersion,
  BlogPublication,
  BlogsAppearanceProps,
  BlogsClient,
} from "@/components/plugins/blogs/types";
import {
  BlogEditorClient,
  cardClass,
  ConfirmDelete,
  Feedback,
  iconButtonClass,
  outlineButtonClass,
  primaryClass,
  useBlogAction,
} from "@/components/plugins/blogs/ui";
import { safeAssetUrl } from "@/components/plugins/blogs/utils";
import { cn } from "@/components/utils/cn";
import { editorActionsClass } from "@/components/utils/editor-form";

const removedTone = "bg-status-canceled/40 text-status-canceled-foreground";
const addedTone = "bg-status-success/40 text-status-success-foreground";

export function useHistoryPublication(
  client: BlogsClient | undefined,
  labels: BlogsLabels,
  onPublished: (article: BlogArticle) => void,
) {
  const action = useBlogAction(labels);
  const [plan, setPlan] = useState<BlogHistoryPlan | null>(null);
  const [publishing, setPublishing] = useState<BlogHistoryTarget | null>(null);
  const [omit, setOmit] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [scope, setScope] = useState(action.scope);
  if (scope !== action.scope) {
    setScope(action.scope);
    setPlan(null);
    setPublishing(null);
    setOmit(false);
    setRefreshed(false);
  }
  async function execute(value: BlogHistoryPlan, omitMissingImages: boolean) {
    setPublishing(value.target);
    await action.run(
      JSON.stringify(["history-publish", value.target, value.token, omitMissingImages]),
      (requestId) =>
        client!.history!.publish({
          ...value.target,
          token: value.token,
          omitMissingImages,
          requestId,
        }),
      labels.publishedSuccess,
      (article) => {
        setPlan(null);
        onPublished(article);
      },
    );
    if (action.isCurrent()) setPublishing(null);
  }
  async function prepare(target: BlogHistoryTarget) {
    if (!client?.history) return;
    let publishing: Promise<void> | undefined;
    await action.run(
      JSON.stringify(["history-plan", target]),
      () => client.history!.plan(target),
      undefined,
      (result) => {
        setOmit(false);
        setRefreshed(false);
        if (result.missingAssetIds.length) setPlan(result);
        else publishing = execute(result, false);
      },
    );
    await publishing;
  }

  return {
    pending: action.pending,
    publishing: action.pending ? publishing : null,
    feedback: action.feedback,
    prepare,
    dialog: (
      <Dialog.Root
        open={!!plan}
        onOpenChange={(open) => {
          if (!open && !action.pending) setPlan(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            className={cn(
              cardClass,
              "fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto py-0 shadow-xl",
            )}
          >
            <div
              data-dialog-header
              className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-card px-6 pt-5 pb-2"
            >
              <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
                {labels.publishReview}
              </Dialog.Title>
              <IconTooltip label={labels.close ?? labels.cancel}>
                <Dialog.Close
                  type="button"
                  aria-label={labels.close ?? labels.cancel}
                  disabled={action.pending}
                  className={iconButtonClass}
                >
                  <XIcon className="size-4 shrink-0" aria-hidden="true" />
                </Dialog.Close>
              </IconTooltip>
            </div>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.publishReviewDescription}
            </Dialog.Description>
            {plan && (
              <>
                {plan.discarded.length ? (
                  <ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
                    {plan.discarded.map((version) => (
                      <li
                        key={version.id}
                        className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"
                      >
                        <span className="font-medium">{blogHistoryLabel(version, labels)}</span>
                        <span>{version.state === "draft" ? labels.draft : labels.publication}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">{labels.noVersionsRemoved}</p>
                )}
                {plan.missingAssetIds.length > 0 && (
                  <div className="space-y-3 text-sm">
                    <p>{labels.missingImages}</p>
                    <label className="flex items-start gap-2">
                      <input
                        className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
                        type="checkbox"
                        checked={omit}
                        onChange={(event) => setOmit(event.target.checked)}
                        disabled={action.pending}
                      />
                      {labels.omitMissingImages}
                    </label>
                  </div>
                )}
                <div className="min-h-10 space-y-2">
                  <Feedback {...action.feedback} />
                  {refreshed && <Feedback message={labels.refreshedPlan} />}
                </div>
                <div
                  data-dialog-footer
                  className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-card px-6 pt-0 pb-5"
                >
                  <Dialog.Close className={outlineButtonClass} disabled={action.pending}>
                    {labels.cancel}
                  </Dialog.Close>
                  {action.feedback?.error && (
                    <IconTooltip label={labels.refreshPlan}>
                      <button
                        aria-label={labels.refreshPlan}
                        type="button"
                        className={iconButtonClass}
                        disabled={action.pending}
                        onClick={() =>
                          void action.run(
                            "refresh-history-plan",
                            async () => {
                              const latest = await client!.get(plan.target.id);
                              return client!.history!.plan({
                                ...plan.target,
                                versionId:
                                  latest.translations[plan.target.locale]?.history?.currentId ??
                                  plan.target.versionId,
                                version: latest.version,
                              });
                            },
                            undefined,
                            (result) => {
                              setPlan(result);
                              setOmit(false);
                              setRefreshed(true);
                            },
                          )
                        }
                      >
                        <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
                      </button>
                    </IconTooltip>
                  )}
                  <button
                    type="button"
                    className={primaryClass}
                    disabled={action.pending || (!!plan.missingAssetIds.length && !omit)}
                    onClick={() => void execute(plan, omit)}
                  >
                    {action.pending ? labels.pending : labels.publish}
                  </button>
                </div>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
  };
}

export function BlogHistoryPanel<T = void>({
  headers,
  selectedId,
  currentId,
  publishedId,
  loading,
  error,
  labels,
  onSelect,
  onCompare,
  onRetry,
  onClose,
  onDelete,
  onDeleted,
  disabled,
  deleteDisabled = false,
  formatDate,
  working,
}: {
  headers: BlogHistoryHeader[];
  selectedId: string | null;
  currentId: string | null;
  publishedId: string | null;
  loading: boolean;
  error?: string;
  labels: BlogsLabels;
  onSelect: (header: BlogHistoryHeader) => void;
  onCompare: (header: BlogHistoryHeader) => void;
  onRetry: () => void;
  onClose: () => void;
  onDelete?: (version: BlogHistoryHeader, requestId: string) => Promise<T>;
  onDeleted?: (result: T) => void;
  disabled: boolean;
  deleteDisabled?: boolean;
  formatDate: (iso: string) => string;
  working?: { origin?: BlogHistoryOrigin; header?: BlogHistoryHeader };
}) {
  const list = useRef<HTMLOListElement>(null);
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<BlogHistoryHeader | null>(null);
  const owner = useContext(BlogEditorClient);
  const [previousOwner, setPreviousOwner] = useState(owner);
  if (previousOwner !== owner) {
    setPreviousOwner(owner);
    setDeleting(null);
  }
  const rows = useMemo(() => {
    const ordered = headers
      .filter((header) => !working || header.state !== "draft")
      .sort((a, b) => b.number - a.number);
    if (working) {
      const source =
        headers.find((header) => header.id === working.origin?.versionId) ?? working.header;
      ordered.unshift({
        id: "working",
        number: 0,
        locale: source?.locale ?? "",
        state: "draft",
        savedAt: "",
        savedBy: source?.savedBy ?? { id: "", name: "" },
        repriseId:
          working.origin?.repriseId ?? (source?.state === "draft" ? source.repriseId : "working"),
        sourcePublicationId:
          source?.state === "publication" ? source.id : (source?.sourcePublicationId ?? null),
        sourcePublicationOrder: null,
        publicationOrder: null,
        publishedAt: null,
        omittedAssetIds: [],
      });
    }
    return ordered;
  }, [headers, working]);
  const sourceOf = (row: BlogHistoryHeader) =>
    headers.find((header) => header.id === row.sourcePublicationId);
  return (
    <aside
      aria-label={`${labels.history} · ${headers[0]?.locale.toUpperCase() ?? ""}`}
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{labels.history}</h2>
        <IconTooltip label={labels.closeHistory}>
          <button
            type="button"
            className={iconButtonClass}
            aria-label={labels.closeHistory}
            onClick={onClose}
          >
            <XIcon aria-hidden="true" />
          </button>
        </IconTooltip>
      </header>
      <p className="text-xs text-muted-foreground tabular-nums">
        {labels.historyCounts(
          headers.filter((header) => header.state === "publication").length,
          headers.filter((header) => header.state === "draft").length,
        )}
      </p>
      <div className="min-h-5">
        <Feedback message={error} error />
        {loading && <Feedback message={labels.loading} />}
        {error && (
          <button type="button" className={outlineButtonClass} onClick={onRetry} disabled={loading}>
            {labels.retry}
          </button>
        )}
      </div>
      {!loading && !error && !rows.length && (
        <p className="py-8 text-sm text-muted-foreground">{labels.historyEmpty}</p>
      )}
      <ol ref={list} className="space-y-2" aria-busy={loading}>
        {rows.map((row) => {
          const source = sourceOf(row),
            isWorking = row.id === "working",
            isLive = row.id === publishedId;
          const chosen = row.id === (selectedId ?? (working ? "working" : currentId));
          return (
            <li key={row.id} data-history-id={row.id} className="flex min-w-0 items-start gap-2">
              <button
                type="button"
                disabled={disabled || isWorking}
                aria-pressed={chosen}
                onClick={() => onSelect(row)}
                className={cn(
                  "min-w-0 flex-1 cursor-pointer space-y-1 rounded-lg px-3 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed",
                  chosen ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-muted",
                )}
              >
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <strong className="tabular-nums">
                    {isWorking ? labels.unsavedDraft : blogHistoryLabel(row, labels)}
                  </strong>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      isLive
                        ? "bg-status-success text-status-success-foreground"
                        : row.state === "draft"
                          ? "bg-status-not-started text-status-not-started-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isLive
                      ? labels.live
                      : row.state === "draft"
                        ? labels.draft
                        : labels.publication}
                  </span>
                </span>
                {!isWorking && (
                  <>
                    <span className="block wrap-anywhere">
                      {row.author?.name ?? labels.unknownAuthor}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(row.savedAt)}
                    </span>
                  </>
                )}
                {row.state === "draft" && (
                  <span className="block text-xs text-muted-foreground">
                    {row.sourcePublicationId
                      ? labels.resumedFrom(
                          source ? blogHistoryLabel(source, labels) : labels.sourceUnavailable,
                        )
                      : labels.newPost}
                  </span>
                )}
              </button>
              {!isWorking && (
                <div className="shrink-0 pt-2">
                  <DropdownMenu>
                    <IconTooltip label={`${labels.actions}: ${blogHistoryLabel(row, labels)}`}>
                      <DropdownMenuTrigger
                        className={iconButtonClass}
                        aria-label={`${labels.actions}: ${blogHistoryLabel(row, labels)}`}
                        disabled={disabled}
                        onFocus={(event) => {
                          actionTrigger.current = event.currentTarget;
                        }}
                      >
                        <EllipsisIcon className="size-4 shrink-0" aria-hidden="true" />
                      </DropdownMenuTrigger>
                    </IconTooltip>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-40 rounded-xl motion-reduce:animate-none"
                    >
                      <DropdownMenuItem
                        className="min-h-10 rounded-md md:min-h-8"
                        disabled={disabled}
                        onClick={() => onCompare(row)}
                      >
                        <GitCompareArrowsIcon aria-hidden="true" />
                        {labels.compare}
                      </DropdownMenuItem>
                      {onDelete && (
                        <DropdownMenuItem
                          className="min-h-10 rounded-md md:min-h-8"
                          variant={disabled || deleteDisabled || isLive ? "default" : "destructive"}
                          disabled={disabled || deleteDisabled || isLive}
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2Icon aria-hidden="true" />
                          {row.state === "draft" ? labels.deleteDraft : labels.deleteVersion}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {deleting && onDelete && (
        <ConfirmDelete
          labels={labels}
          title={
            deleting.state === "draft"
              ? labels.deleteDraft
              : `${labels.deleteVersion} ${blogHistoryLabel(deleting, labels)}`
          }
          description={labels.historyDeleteDescription}
          label={
            deleting.state === "draft"
              ? labels.deleteDraft
              : `${labels.deleteVersion} ${blogHistoryLabel(deleting, labels)}`
          }
          disabled={disabled || deleteDisabled || deleting.id === publishedId}
          onDelete={(requestId) => onDelete(deleting, requestId)}
          onDeleted={onDeleted}
          onClose={() => setDeleting(null)}
          finalFocus={() =>
            actionTrigger.current?.isConnected
              ? actionTrigger.current
              : (list.current?.querySelector("button") ?? false)
          }
        />
      )}
    </aside>
  );
}

const HistoryImageContext = createContext({
  imageComponent: Image as NonNullable<BlogsAppearanceProps["imageComponent"]>,
  unavailable: "Image unavailable",
});
function HistoryImage(props: ImageProps) {
  const { imageComponent: BlogImage, unavailable } = useContext(HistoryImageContext);
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="flex min-h-20 items-center justify-center rounded-lg bg-muted p-4 text-sm text-muted-foreground">
      {unavailable}
    </span>
  ) : (
    <BlogImage {...props} onError={() => setFailed(true)} />
  );
}

export function BlogHistoryReader({
  version,
  publication,
  liveLabel,
  labels,
  categories,
  onResume,
  onPublish,
  disabled,
  assetUrl,
  imageComponent = Image,
  linkComponent,
  formatDate = (iso) => new Date(iso).toLocaleString(),
  working = false,
  mode,
  onModeChange,
}: BlogsAppearanceProps & {
  version: BlogHistoryVersion;
  publication?: BlogPublication | null;
  liveLabel: string;
  labels: BlogsLabels;
  categories: BlogCategory[];
  onResume?: () => void;
  onPublish?: () => void;
  disabled: boolean;
  working?: boolean;
  mode: "read" | "compare";
  onModeChange: (mode: "read" | "compare") => void;
}) {
  const labelsId = `factory-blog-history-view-${useId()}`;
  const selectedLabel = working ? labels.unsavedDraft : blogHistoryLabel(version, labels);
  const diff = useMemo(
    () => blogTextDiff(publication?.markdown ?? "", version.content.markdown),
    [publication?.markdown, version.content.markdown],
  );
  const categoryNames = (ids: string[]) =>
    ids
      .map((id) => {
        const category = categories.find((value) => value.id === id);
        return (
          category?.translations[version.locale]?.name ??
          Object.values(category?.translations ?? {})[0]?.name ??
          id
        );
      })
      .sort()
      .join(", ");
  const changes = publication
    ? [
        [labels.title, publication.title, version.content.title],
        [labels.slug, publication.slug, version.content.slug],
        [labels.summary, publication.summary, version.content.summary],
        [
          labels.signature,
          publication.shared.author?.name ?? labels.unknownAuthor,
          version.shared.author?.name ?? labels.unknownAuthor,
        ],
        [
          labels.thumbnail,
          publication.shared.thumbnailId ?? labels.noImage,
          version.shared.thumbnailId ?? labels.noImage,
        ],
        [
          labels.banner,
          publication.shared.bannerId ?? labels.noImage,
          version.shared.bannerId ?? labels.noImage,
        ],
        [
          `${labels.thumbnail} · ${labels.alt}`,
          publication.thumbnailAlt,
          version.content.thumbnailAlt,
        ],
        [`${labels.banner} · ${labels.alt}`, publication.bannerAlt, version.content.bannerAlt],
        [
          labels.categories,
          categoryNames(publication.shared.categoryIds),
          categoryNames(version.shared.categoryIds),
        ],
      ].filter(([, before, after]) => before !== after)
    : [];
  const fieldValue = (label: string, value: string) =>
    label === labels.thumbnail || label === labels.banner ? (
      value === labels.noImage ? (
        labels.noImage
      ) : (
        <HistoryImage
          src={safeAssetUrl(assetUrl(value))}
          alt={label}
          className="my-2 aspect-video max-h-32 rounded-lg object-cover"
        />
      )
    ) : (
      value || labels.noImage
    );
  return (
    <HistoryImageContext.Provider value={{ imageComponent, unavailable: labels.imageUnavailable }}>
      <section aria-labelledby={labelsId} className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="space-y-3">
          <h2
            id={labelsId}
            aria-label={
              mode === "compare" && publication
                ? labels.comparisonTitle(liveLabel, selectedLabel)
                : undefined
            }
            className="flex flex-wrap items-center gap-2 font-semibold"
          >
            <HistoryIcon className="size-4" aria-hidden="true" />
            {mode === "compare" && publication ? (
              <>
                <span
                  data-diff-side="before"
                  className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1", removedTone)}
                >
                  <span aria-hidden="true">−</span>
                  {liveLabel}
                  {liveLabel !== labels.live && (
                    <span className="font-normal">({labels.live})</span>
                  )}
                </span>
                <span aria-hidden="true">→</span>
                <span
                  data-diff-side="after"
                  className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1", addedTone)}
                >
                  <span aria-hidden="true">+</span>
                  {selectedLabel}
                </span>
              </>
            ) : (
              selectedLabel
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{!working && labels.historyReadOnly}</p>
        </header>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">{labels.preview}</legend>
          <button
            type="button"
            aria-pressed={mode === "read"}
            className={mode === "read" ? primaryClass : outlineButtonClass}
            disabled={disabled}
            onClick={() => onModeChange("read")}
          >
            <FileTextIcon aria-hidden="true" />
            {labels.read}
          </button>
          <button
            type="button"
            aria-pressed={mode === "compare"}
            className={mode === "compare" ? primaryClass : outlineButtonClass}
            disabled={disabled}
            onClick={() => onModeChange("compare")}
          >
            <GitCompareArrowsIcon aria-hidden="true" />
            {labels.compare}
          </button>
        </fieldset>
        <dl className="grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{labels.signature}</dt>
            <dd className="mt-1 font-medium">{version.author?.name ?? labels.unknownAuthor}</dd>
          </div>
          {!working && (
            <div>
              <dt className="text-muted-foreground">{labels.savedBy}</dt>
              <dd className="mt-1">
                {version.savedBy.name} · {formatDate(version.savedAt, version.locale)}
              </dd>
            </div>
          )}
        </dl>
        {mode === "compare" ? (
          !publication ? (
            <p className="py-8 text-sm text-muted-foreground">{labels.noLiveComparison}</p>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">{labels.comparedFields}</p>
              {!!changes.length && (
                <dl className="space-y-4 text-sm">
                  {changes.map(([label, before, after]) => (
                    <div key={label} className="space-y-1">
                      <dt className="font-medium">{label}</dt>
                      <dd className="space-y-1">
                        <div
                          data-diff-side="before"
                          className={cn(
                            "grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-3 py-2 wrap-anywhere",
                            removedTone,
                          )}
                        >
                          <span aria-hidden="true">−</span>
                          <span>
                            <span className="sr-only">{labels.removed}: </span>
                            <del>{fieldValue(label, before)}</del>
                          </span>
                        </div>
                        <div
                          data-diff-side="after"
                          className={cn(
                            "grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-3 py-2 wrap-anywhere",
                            addedTone,
                          )}
                        >
                          <span aria-hidden="true">+</span>
                          <span>
                            <span className="sr-only">{labels.added}: </span>
                            <ins className="no-underline">{fieldValue(label, after)}</ins>
                          </span>
                        </div>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {!changes.length && diff.every((row) => row.kind === "context") && (
                <p className="text-sm text-muted-foreground">{labels.noChanges}</p>
              )}
              <section aria-labelledby={`${labelsId}-markdown`} className="space-y-1 text-sm">
                <h3 id={`${labelsId}-markdown`} className="font-medium">
                  {labels.markdown}
                </h3>
                <div aria-label={labels.compare} className="space-y-0.5 leading-7">
                  {diff.map((row, index) => (
                    <div
                      key={index}
                      className={cn(
                        "grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-3 py-2",
                        row.kind === "removed"
                          ? removedTone
                          : row.kind === "added"
                            ? addedTone
                            : "text-muted-foreground",
                      )}
                    >
                      <span
                        aria-label={
                          row.kind === "removed"
                            ? labels.removed
                            : row.kind === "added"
                              ? labels.added
                              : undefined
                        }
                        aria-hidden={row.kind === "context"}
                      >
                        {row.kind === "removed" ? "−" : row.kind === "added" ? "+" : ""}
                      </span>
                      <span className="wrap-anywhere whitespace-pre-wrap">
                        {row.parts.map((part, partIndex) =>
                          part.added || part.removed ? (
                            <mark
                              key={partIndex}
                              data-change={part.removed ? "removed" : "added"}
                              className={cn(
                                "rounded-sm px-0.5 font-semibold text-inherit",
                                part.removed ? "bg-status-canceled" : "bg-status-success",
                              )}
                            >
                              {part.value}
                            </mark>
                          ) : (
                            <span key={partIndex} className="text-muted-foreground">
                              {part.value}
                            </span>
                          ),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )
        ) : (
          <article className="space-y-5">
            <h3 className="font-serif text-2xl font-semibold wrap-anywhere">
              {version.content.title}
            </h3>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{labels.slug}</dt>
                <dd className="wrap-anywhere">{version.content.slug}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{labels.categories}</dt>
                <dd>{categoryNames(version.shared.categoryIds) || labels.noCategories}</dd>
              </div>
            </dl>
            {version.shared.thumbnailId && (
              <HistoryImage
                src={safeAssetUrl(assetUrl(version.shared.thumbnailId))}
                alt={version.content.thumbnailAlt}
                className="aspect-video max-h-32 rounded-xl object-cover"
              />
            )}
            {version.shared.bannerId && (
              <HistoryImage
                src={safeAssetUrl(assetUrl(version.shared.bannerId))}
                alt={version.content.bannerAlt}
                className="aspect-video w-full rounded-xl object-cover"
              />
            )}
            {version.content.summary && (
              <p className="text-muted-foreground">{version.content.summary}</p>
            )}
            <BlogMarkdown
              markdown={version.content.markdown}
              assetIds={version.content.assetIds}
              assetUrl={assetUrl}
              imageComponent={HistoryImage}
              linkComponent={linkComponent}
            />
          </article>
        )}
        <div className={cn(editorActionsClass, "mt-auto justify-start gap-2")}>
          {onPublish && (
            <button type="button" className={primaryClass} disabled={disabled} onClick={onPublish}>
              {labels.publishVersion}
            </button>
          )}
          {onResume && (
            <button
              type="button"
              className={outlineButtonClass}
              disabled={disabled}
              onClick={onResume}
            >
              <PencilIcon aria-hidden="true" />
              {version.state === "draft" ? labels.continueDraft : labels.newReprise}
            </button>
          )}
        </div>
      </section>
    </HistoryImageContext.Provider>
  );
}

"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useId,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { NativeSelect } from "@/components/native-select";
import {
  BlogCategoriesPage,
  BlogEditPage,
  BlogIndexPage,
  BlogNewPage,
  BlogPostPage,
  BlogsPage,
  blogCapabilities,
} from "@/components/plugins/blogs";
import { articleListItem } from "@/components/plugins/blogs/utils";
import { blogLocales, createBlogsMock } from "@/showroom/blogs-mock";
import {
  ShowroomLink as Link,
  useShowroomParams,
  useShowroomEditorGuard,
} from "@/showroom/routing";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const previewClassName =
  "showroom-page [&_img[src^='https://assets.the-corner.io/images/']]:object-contain [&_img[src^='https://assets.the-corner.io/images/']]:mix-blend-multiply dark:[&_img[src^='https://assets.the-corner.io/images/']]:mix-blend-screen dark:[&_img[src^='https://assets.the-corner.io/images/']]:invert";

function usePreview() {
  const [mock] = useState(createBlogsMock),
    [editor, setEditor] = useState("jordan"),
    [admin, setAdmin] = useState(true),
    [readOnly, setReadOnly] = useState(false),
    [fail, setFail] = useState(false),
    [failUpload, setFailUpload] = useState(false),
    [cropImages, setCropImages] = useState(true),
    [state, setState] = useState("ready"),
    [exampleRevision, setExampleRevision] = useState(0),
    [missingImages, setMissingImages] = useState(false),
    [historyEnabled, setHistoryEnabled] = useState(true);
  const revision = useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  useEffect(() => () => mock.dispose(), [mock]);
  const client = useMemo(() => {
    const client = mock.client({
      editor: { id: editor, name: editor === "jordan" ? "Jordan Lee" : "Alex Morgan" },
      admin,
      readOnly,
      fail,
      failUpload,
      missingImages,
      consumeUploadFailure: () => setFailUpload(false),
    });
    if (!historyEnabled) delete client.history;
    return client;
  }, [mock, editor, admin, readOnly, fail, failUpload, missingImages, historyEnabled]);
  return {
    mock,
    historyEnabled,
    setHistoryEnabled,
    exampleRevision,
    setExampleRevision,
    missingImages,
    setMissingImages,
    client,
    revision,
    editor,
    setEditor,
    admin,
    setAdmin,
    readOnly,
    setReadOnly,
    fail,
    setFail,
    failUpload,
    setFailUpload,
    cropImages,
    setCropImages,
    state,
    setState,
  };
}
const Context = createContext<ReturnType<typeof usePreview> | null>(null);
function useBlogsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing blogs preview provider");
  return value;
}
export function BlogsPreviewProvider({ children }: { children: ReactNode }) {
  const selectId = `factory-showroom-blogs-${useId()}`;
  const { locale, segments } = useShowroomParams();
  const state = usePreview();
  const article = state.mock.all().find((value) => value.id === segments[0]);
  return (
    <Context.Provider value={state}>
      <ShowroomPreview
        notice={previewDataNotice}
        navigation={
          <>
            <Link href={`/${locale}/blogs`}>Public blog</Link>
            <Link href={`/${locale}/admin/blogs`}>Manage posts</Link>
            <Link href="/fr/blogs">French blog</Link>
          </>
        }
        controls={
          <>
            <label htmlFor={`${selectId}-editor`} className="flex items-center gap-2">
              Editor
              <NativeSelect
                id={`${selectId}-editor`}
                aria-label="Editor"
                value={state.editor}
                onChange={(e) => state.setEditor(e.target.value)}
              >
                <option value="jordan">Jordan Lee</option>
                <option value="alex">Alex Morgan</option>
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.readOnly}
                onChange={(e) => state.setReadOnly(e.target.checked)}
              />
              Read-only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.admin}
                onChange={(event) => state.setAdmin(event.target.checked)}
              />
              Administrator
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.fail}
                onChange={(e) => state.setFail(e.target.checked)}
              />
              Simulate action failures
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.historyEnabled}
                onChange={(event) => state.setHistoryEnabled(event.target.checked)}
              />
              History transport
            </label>
            <div className="space-y-2">
              <button
                className="underline disabled:text-muted-foreground disabled:no-underline"
                disabled={!article}
                aria-describedby={`${selectId}-history-example`}
                onClick={() => {
                  if (!article) return;
                  state.mock.loadHistoryExample(article.id);
                  state.setExampleRevision((value) => value + 1);
                }}
              >
                Load history example
              </button>
              <p id={`${selectId}-history-example`} className="text-xs text-muted-foreground">
                {article
                  ? "Replaces this post’s demo content and history in English and French."
                  : "Open a post in Manage posts to load its history example."}
              </p>
            </div>
            <div className="space-y-2">
              <button
                className="underline disabled:text-muted-foreground disabled:no-underline"
                disabled={!article}
                aria-describedby={`${selectId}-concurrent-correction`}
                onClick={() => article && state.mock.applyConcurrentCorrection(article.id)}
              >
                Simulate concurrent correction
              </button>
              <p id={`${selectId}-concurrent-correction`} className="text-xs text-muted-foreground">
                Changes this post as another editor. The next save will conflict.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.missingImages}
                onChange={(event) => state.setMissingImages(event.target.checked)}
              />
              Simulate missing illustrations
            </label>
            <button onClick={() => state.setFailUpload(true)} className="underline">
              Fail next upload{state.failUpload ? " (armed)" : ""}
            </button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.cropImages}
                onChange={(event) => state.setCropImages(event.target.checked)}
              />
              Crop new blog images (1200 × 675)
            </label>
            <label htmlFor={`${selectId}-directory`} className="flex items-center gap-2">
              Directory state
              <NativeSelect
                id={`${selectId}-directory`}
                aria-label="Directory state"
                value={state.state}
                onChange={(e) => state.setState(e.target.value)}
              >
                <option value="ready">Ready</option>
                <option value="loading">Loading</option>
                <option value="error">Error</option>
                <option value="empty">Empty</option>
              </NativeSelect>
            </label>
          </>
        }
      >
        {children}
      </ShowroomPreview>
    </Context.Provider>
  );
}
export function BlogsAdminPreview() {
  const { locale: routeLocale, segments } = useShowroomParams();
  const locale = blogLocales.some((l) => l.code === routeLocale) ? routeLocale : "en";
  const state = useBlogsPreview(),
    navigate = useNavigate();
  const { onNavigationStateChange, blockedNavigation } = useShowroomEditorGuard();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const root = `/${locale}/admin/blogs`,
    actor = state.readOnly ? null : { id: state.editor, admin: state.admin },
    capabilities = blogCapabilities(actor);
  const common = {
    className: previewClassName,
    assetUrl: state.mock.assetUrl,
    linkComponent: Link,
    client: state.client,
    capabilities,
    labels:
      locale === "fr"
        ? {
            history: "Historique",
            closeHistory: "Fermer l’historique",
            read: "Lire",
            compare: "Comparer",
            compareDraft: "Comparer le brouillon",
            currentDraft: "Brouillon courant",
            returnToDraft: "Revenir au brouillon",
            unsavedDraft: "Brouillon non enregistré",
            historyReadOnly: "Lecture seule. Votre brouillon reste conservé.",
            historyEmpty: "Aucune version enregistrée dans cette langue.",
            live: "En ligne",
            publication: "Publication",
            signature: "Signature de l’article",
            savedBy: "Enregistrée par",
            newReprise: "Reprendre comme brouillon",
            continueDraft: "Modifier ce brouillon",
            publishVersion: "Publier cette version",
            deleteVersion: "Supprimer la version",
            sourceUnavailable: "Source indisponible",
            historyCounts: (publications: number, drafts: number) =>
              `Publications ${publications} / 5 · Brouillons ${drafts} / 8`,
            resumedFrom: (source: string) => `Depuis ${source}`,
            repriseLabel: (version: string) => `Reprise ${version}`,
            compareWith: (version: string) => `Comparaison avec la publication ${version}`,
          }
        : undefined,
  };
  if (segments[0] === "new")
    return (
      <BlogNewPage
        {...common}
        locales={blogLocales}
        defaultLocale={locale}
        backHref={root}
        onCreated={(article) => navigate({ href: `${root}/${article.id}` })}
      />
    );
  if (segments[0] === "categories")
    return (
      <BlogCategoriesPage
        onNavigationStateChange={onNavigationStateChange}
        blockedNavigation={blockedNavigation}
        {...common}
        locales={blogLocales}
        categories={state.mock.categories()}
        backHref={root}
        onChanged={() => {}}
      />
    );
  if (segments[0]) {
    const article = state.mock.all().find((a) => a.id === segments[0]);
    if (!article)
      return (
        <p role="alert" className="p-8">
          Article unavailable.{" "}
          <Link
            href={root}
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Back to posts
          </Link>
        </p>
      );
    return (
      <BlogEditPage
        key={`${article.id}:${state.exampleRevision}`}
        onNavigationStateChange={onNavigationStateChange}
        blockedNavigation={blockedNavigation}
        {...common}
        authors={[
          { id: "jordan", name: "Jordan Lee" },
          { id: "alex", name: "Alex Morgan" },
        ]}
        capabilities={blogCapabilities(actor, article.shared.author?.id)}
        imageDimensions={
          state.cropImages
            ? { thumbnail: { width: 1200, height: 675 }, banner: { width: 1200, height: 675 } }
            : false
        }
        article={article}
        categories={state.mock.categories()}
        assets={state.mock.assets(article.id)}
        locales={blogLocales}
        defaultLocale={locale}
        backHref={root}
        categoriesHref={`${root}/categories`}
        onDeleted={() => navigate({ href: root, ignoreBlocker: true })}
      />
    );
  }
  const items =
    state.state === "empty"
      ? []
      : state.mock
          .all()
          .filter((a) =>
            Object.values(a.translations).some((t) =>
              t.draft.title.toLowerCase().includes(search.toLowerCase()),
            ),
          )
          .map((a) => articleListItem(a, locale, state.mock.categories()));
  return (
    <BlogsPage
      {...common}
      capabilitiesForArticle={(post) => blogCapabilities(actor, post.author?.id)}
      data={{
        items: items.slice((page - 1) * 6, page * 6),
        total: items.length,
        page,
        pageSize: 6,
      }}
      search={search}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      onPageChange={setPage}
      onSetPublished={async (id, locale, published, requestId) => {
        const article = state.mock.get(id);
        await state.client[published ? "publish" : "unpublish"]({
          id,
          version: article.version,
          locale,
          requestId,
        });
      }}
      onDelete={async (id, requestId) => {
        const article = state.mock.get(id);
        await state.client.delete({ id, version: article.version, requestId });
        setPage(1);
      }}
      editHref={(id) => `${root}/${id}`}
      newHref={`${root}/new`}
      categoriesHref={`${root}/categories`}
      loading={state.state === "loading"}
      error={state.state === "error" ? "Unable to load blog posts." : undefined}
      onRetry={() => state.setState("ready")}
    />
  );
}
export function BlogsPublicPreview() {
  const { locale, segments } = useShowroomParams(),
    params = useSearch({ strict: false }),
    navigate = useNavigate(),
    state = useBlogsPreview();
  const root = `/${locale}/blogs`,
    search = params.search ?? "",
    category = params.category ?? undefined,
    page = Math.max(1, Number(params.page) || 1);
  const common = {
    className: previewClassName,
    assetUrl: state.mock.assetUrl,
    linkComponent: Link,
    categories: state.mock.categories(),
  };
  function href(next: { page?: number; category?: string | null }) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (next.category ?? category)
      query.set("category", next.category === null ? "" : (next.category ?? category!));
    if (next.category === null) query.delete("category");
    if (next.page && next.page > 1) query.set("page", String(next.page));
    return `${root}${query.size ? `?${query}` : ""}`;
  }
  if (segments[0]) {
    const post = state.mock.getPublished(locale, segments[0]);
    if (!post)
      return (
        <p role="alert" className="p-8">
          This translation is not published.{" "}
          <Link
            href={root}
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Back to posts
          </Link>
        </p>
      );
    return (
      <BlogPostPage
        {...common}
        post={post}
        backHref={root}
        categoryHref={(id) => `${root}?category=${id}`}
      />
    );
  }
  const data = state.mock.listPublished({
    locale,
    search,
    categoryId: category,
    page,
    pageSize: 6,
  });
  return (
    <div
      onSubmit={(event) => {
        const form = event.target;
        if (form instanceof HTMLFormElement) {
          event.preventDefault();
          const values = new FormData(form),
            query = new URLSearchParams();
          for (const [key, value] of values)
            if (typeof value === "string" && value) query.set(key, value);
          void navigate({ href: `${root}?${query}` });
        }
      }}
    >
      <BlogIndexPage
        {...common}
        locale={locale}
        data={state.state === "empty" ? { ...data, items: [], total: 0 } : data}
        search={search}
        categoryId={category}
        actionHref={root}
        postHref={(post) => `${root}/${post.slug}`}
        categoryHref={(id) => href({ category: id })}
        pageHref={(next) => href({ page: next })}
        loading={state.state === "loading"}
        error={state.state === "error" ? "Unable to load blog posts." : undefined}
      />
    </div>
  );
}

"use client";

import {
  Link as RouterLink,
  useLoaderData,
  useMatch,
  useNavigate,
  useRouteContext,
  useSearch,
  useLocation,
} from "@tanstack/react-router";
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
import { z } from "zod";

import { BackLink } from "@/components/back-link";
import { createBlogsAgentOperation } from "@/components/connectors/agents-blogs/server";
import { NativeSelect } from "@/components/native-select";
import {
  BlogCategoriesPage,
  BlogEditPage,
  BlogIndexPage,
  BlogNewPage,
  BlogPostPage,
  BlogsPage,
  blogCapabilities,
  type BlogEditorView,
} from "@/components/plugins/blogs";
import { BLOG_SORT_FIELDS } from "@/components/plugins/blogs/types";
import { articleListItem, sortBlogItems } from "@/components/plugins/blogs/utils";
import { publicRecordPath } from "@/components/utils/public-identifier";
import { isLocale } from "@/lib/i18n/config";
import { blogsPreviewCropLabels, blogsPreviewLabels } from "@/showroom/blogs-labels";
import { blogLocales } from "@/showroom/blogs-mock";
import { PluginWebMcp } from "@/showroom/plugin-webmcp";
import { PreviewLanguageSwitcher } from "@/showroom/preview-language-switcher";
import { useShowroomTableSort } from "@/showroom/routing";
import { useShowroomTablePage } from "@/showroom/routing";
import {
  ShowroomLink as Link,
  useShowroomParams,
  useShowroomEditorGuard,
} from "@/showroom/routing";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

const previewClassName =
  "showroom-page [&_img[src^='https://assets.the-corner.swiss/images/']]:object-contain [&_img[src^='https://assets.the-corner.swiss/images/']]:mix-blend-multiply dark:[&_img[src^='https://assets.the-corner.swiss/images/']]:mix-blend-screen dark:[&_img[src^='https://assets.the-corner.swiss/images/']]:invert";

function usePreview() {
  const { blogsMock: mock } = useRouteContext({ from: "/_blogs" });
  const [editor, setEditor] = useState("jordan"),
    [admin, setAdmin] = useState(true),
    [readOnly, setReadOnly] = useState(false),
    [fail, setFail] = useState(false),
    [simulateLoading, setSimulateLoading] = useState(false),
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
      missingImages,
      consumeUploadFailure: () => setFailUpload(false),
    });
    if (!historyEnabled) delete client.history;
    return client;
  }, [mock, editor, admin, readOnly, fail, missingImages, historyEnabled]);
  return {
    mock,
    actor: readOnly ? null : { id: editor, admin },
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
    simulateLoading,
    setSimulateLoading,
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
  const path = useLocation({ select: (location) => location.pathname });
  const selectId = `factory-showroom-blogs-${useId()}`;
  const { locale, segments } = useShowroomParams();
  const state = usePreview();
  const adminRoute = useMatch({ from: "/_blogs/$locale/admin/blogs/$", shouldThrow: false });
  const articles = state.mock.all();
  const article = articles.find((value) => value.id === segments[0]);
  const publicSlug = adminRoute ? undefined : segments[0];
  const publicId = useMatch({ from: "/_blogs/$locale/blogs/$", shouldThrow: false })?.loaderData
    ?.id;
  const publicPost = publicId ? articles.find((value) => value.id === publicId) : undefined;
  const hasArticleEditor = Boolean(adminRoute && article);
  const canSimulateMissingImages = hasArticleEditor && state.historyEnabled;
  return (
    <Context.Provider value={state}>
      {path.includes("/admin/blogs") && (
        <PluginWebMcp
          operations={[
            createBlogsAgentOperation<undefined>({
              client: () => state.client,
              authorize: async () => true,
            }),
          ]}
          revision={`${state.editor}:${state.admin}:${state.readOnly}:${state.historyEnabled}:${state.exampleRevision}`}
          context={{ plugin: "blogs", recordId: path.split("/admin/blogs/")[1]?.split("/")[0] }}
        />
      )}
      <ShowroomPreview
        notice={previewDataNotice}
        navigation={
          <>
            <Link href={`/${locale}/blogs`}>Public blog</Link>
            <RouterLink
              to="/$locale/admin/blogs/$"
              params={{ locale, _splat: "" }}
              activeOptions={{ exact: segments[0] === "categories" }}
            >
              Manage posts
            </RouterLink>
            {blogCapabilities(state.actor).manageCategories && (
              <Link href={`/${locale}/admin/blogs/categories`}>Categories</Link>
            )}
          </>
        }
        controls={
          <>
            <PreviewLanguageSwitcher
              translatedPath={
                publicSlug
                  ? (code) => {
                      const translation = publicPost?.translations[code]?.published;
                      return publicPost && translation
                        ? publicRecordPath(`/${code}/blogs`, {
                            id: publicPost.id,
                            slug: translation.slug,
                          })
                        : undefined;
                    }
                  : undefined
              }
            />
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
            {article && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.simulateLoading}
                  onChange={(event) => state.setSimulateLoading(event.target.checked)}
                />
                Simulate loading
              </label>
            )}
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
                  ? "Loads five publications and one draft per language for this post."
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
            <div className="space-y-2">
              <label className="flex items-center gap-2 has-disabled:text-muted-foreground">
                <input
                  type="checkbox"
                  checked={state.missingImages}
                  disabled={!canSimulateMissingImages}
                  aria-describedby={`${selectId}-missing-illustrations`}
                  onChange={(event) => state.setMissingImages(event.target.checked)}
                />
                Simulate missing illustrations
              </label>
              <p id={`${selectId}-missing-illustrations`} className="text-xs text-muted-foreground">
                {!hasArticleEditor
                  ? "Open a post in Manage posts to try this simulation."
                  : !state.historyEnabled
                    ? "Enable History transport to simulate missing illustrations."
                    : "Publish a draft with illustrations to see the omission warning."}
              </p>
            </div>
            <button
              onClick={() => {
                state.mock.failNextUpload();
                state.setFailUpload(true);
              }}
              className="underline"
            >
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
const historyVersionId = z.uuid();

function readEditorView(search: Record<string, unknown>, defaultLocale: string): BlogEditorView {
  return {
    locale: blogLocales.find(({ code }) => code === search.lang)?.code ?? defaultLocale,
    historyOpen: search.history === true,
    versionId: historyVersionId.safeParse(search.version).data ?? null,
    compare: search.compare === true,
  };
}

export function BlogsAdminPreview() {
  const { locale: routeLocale, segments } = useShowroomParams();
  const locale = blogLocales.some((l) => l.code === routeLocale) ? routeLocale : "en";
  const state = useBlogsPreview(),
    navigate = useNavigate();
  const query = useSearch({ strict: false });
  const view = readEditorView(query, locale);
  const { onNavigationStateChange, blockedNavigation } = useShowroomEditorGuard((current, next) => {
    const from = readEditorView(current, locale);
    const to = readEditorView(next, locale);
    return from.locale !== to.locale || (to.versionId !== null && from.versionId !== to.versionId);
  });
  function changeView(change: Partial<BlogEditorView>) {
    void navigate({
      to: ".",
      search: (previous) => {
        const next = { ...readEditorView(previous, locale), ...change };
        return {
          ...previous,
          lang: next.locale === locale ? undefined : next.locale,
          history: next.historyOpen || undefined,
          version: next.versionId ?? undefined,
          compare: next.compare || undefined,
        };
      },
      hash: true,
      resetScroll: false,
      // The editor already guarded the language or history selection.
      ignoreBlocker: true,
    });
  }
  const initialLoad = state.state === "loading";
  const currentArticle = initialLoad
    ? undefined
    : state.mock.all().find((article) => article.id === segments[0]);
  const [lastArticle, setLastArticle] = useState(currentArticle);
  if (
    currentArticle &&
    (currentArticle.id !== lastArticle?.id || currentArticle.version !== lastArticle.version)
  )
    setLastArticle(currentArticle);
  const order = useShowroomTableSort("blog", BLOG_SORT_FIELDS);
  const { search, setSearch, page, setPage } = useShowroomTablePage("blog");
  const root = `/${routeLocale}/admin/blogs`,
    capabilities = blogCapabilities(state.actor);
  const common = {
    className: previewClassName,
    assetUrl: state.mock.assetUrl,
    linkComponent: Link,
    client: state.client,
    capabilities,
    labels: blogsPreviewLabels[isLocale(routeLocale) ? routeLocale : "en"],
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
    // Keep the editor mounted until its successful deletion callback navigates away.
    const article = currentArticle ?? (lastArticle?.id === segments[0] ? lastArticle : undefined);
    if (!article && !initialLoad)
      return (
        <p role="alert" className="p-8">
          {common.labels.NOT_FOUND}{" "}
          <BackLink linkComponent={Link} href={root}>
            {common.labels.back}
          </BackLink>
        </p>
      );
    const editor = (
      <BlogEditPage
        key={`${segments[0]}:${state.exampleRevision}`}
        onNavigationStateChange={onNavigationStateChange}
        blockedNavigation={blockedNavigation}
        {...common}
        authors={[
          { id: "jordan", name: "Jordan Lee" },
          { id: "alex", name: "Alex Morgan" },
        ]}
        capabilities={blogCapabilities(state.actor, article?.shared.author?.id)}
        imageDimensions={
          state.cropImages
            ? { thumbnail: { width: 1200, height: 675 }, banner: { width: 1200, height: 675 } }
            : false
        }
        imageCropLabels={blogsPreviewCropLabels[isLocale(routeLocale) ? routeLocale : "en"]}
        article={article ?? null}
        categories={state.mock.categories()}
        assets={state.mock.assets(segments[0])}
        locales={blogLocales}
        defaultLocale={locale}
        view={{ state: view, onChange: changeView }}
        backHref={root}
        categoriesHref={`${root}/categories`}
        onDeleted={() => navigate({ href: root, ignoreBlocker: true })}
      />
    );
    const showLoadingPreview = state.simulateLoading && !!article;
    return (
      <>
        {showLoadingPreview && (
          <BlogEditPage
            {...common}
            article={null}
            locales={blogLocales}
            defaultLocale={locale}
            view={{ state: view, onChange: changeView }}
            backHref={root}
          />
        )}
        <div hidden={showLoadingPreview}>{editor}</div>
      </>
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
      {...order}
      {...common}
      capabilitiesForArticle={(post) => blogCapabilities(state.actor, post.author?.id)}
      data={{
        items: sortBlogItems(items, order.sort, locale).slice((page - 1) * 6, page * 6),
        total: items.length,
        page,
        pageSize: 6,
      }}
      search={search}
      onSearchChange={setSearch}
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
      error={state.state === "error" ? common.labels.error : undefined}
      onRetry={() => state.setState("ready")}
    />
  );
}
export function BlogPublicNotFound() {
  const { locale } = useShowroomParams();
  const labels = blogsPreviewLabels[isLocale(locale) ? locale : "en"];
  return (
    <p role="alert" className="p-8">
      {labels.NOT_FOUND}{" "}
      <BackLink linkComponent={Link} href={`/${locale}/blogs`}>
        {labels.back}
      </BackLink>
    </p>
  );
}

export function BlogsPublicPreview() {
  const post = useLoaderData({ from: "/_blogs/$locale/blogs/$" });
  const { locale } = useShowroomParams(),
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
    labels: blogsPreviewLabels[isLocale(locale) ? locale : "en"],
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
  if (post) {
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
        postHref={(post) => publicRecordPath(root, post)}
        categoryHref={(id) => href({ category: id })}
        pageHref={(next) => href({ page: next })}
        loading={state.state === "loading"}
        error={state.state === "error" ? common.labels.error : undefined}
      />
    </div>
  );
}

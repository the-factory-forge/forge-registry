"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  BlogCategoriesPage,
  BlogEditPage,
  BlogIndexPage,
  BlogNewPage,
  BlogPostPage,
  BlogsPage,
} from "@/components/plugins/blogs";
import { articleListItem } from "@/components/plugins/blogs/utils";
import { blogLocales, createBlogsMock } from "@/showroom/blogs-mock";
import { ShowroomLink as Link, useShowroomParams } from "@/showroom/routing";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function usePreview() {
  const [mock] = useState(createBlogsMock),
    [editor, setEditor] = useState("jordan"),
    [readOnly, setReadOnly] = useState(false),
    [fail, setFail] = useState(false),
    [failUpload, setFailUpload] = useState(false),
    [state, setState] = useState("ready");
  const revision = useSyncExternalStore(mock.subscribe, mock.snapshot, () => 0);
  useEffect(() => () => mock.dispose(), [mock]);
  const client = useMemo(
    () =>
      mock.client({
        editor: { id: editor, name: editor === "jordan" ? "Jordan Lee" : "Alex Morgan" },
        readOnly,
        fail,
        failUpload,
        consumeUploadFailure: () => setFailUpload(false),
      }),
    [mock, editor, readOnly, fail, failUpload],
  );
  return {
    mock,
    client,
    revision,
    editor,
    setEditor,
    readOnly,
    setReadOnly,
    fail,
    setFail,
    failUpload,
    setFailUpload,
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
  const state = usePreview();
  return (
    <Context.Provider value={state}>
      <ShowroomPreview
        navigation={
          <>
            <Link href="/en/blogs">Public blog</Link>
            <Link href="/en/admin/blogs">Manage posts</Link>
            <Link href="/fr/blogs">French blog</Link>
          </>
        }
        controls={
          <>
            <label className="flex items-center gap-2">
              Editor
              <select
                aria-label="Editor"
                value={state.editor}
                onChange={(e) => state.setEditor(e.target.value)}
              >
                <option value="jordan">Jordan Lee</option>
                <option value="alex">Alex Morgan</option>
              </select>
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
                checked={state.fail}
                onChange={(e) => state.setFail(e.target.checked)}
              />
              Fail mutations
            </label>
            <button onClick={() => state.setFailUpload(true)} className="underline">
              Fail next upload{state.failUpload ? " (armed)" : ""}
            </button>
            <label className="flex items-center gap-2">
              Directory state
              <select
                aria-label="Directory state"
                value={state.state}
                onChange={(e) => state.setState(e.target.value)}
              >
                <option value="ready">Ready</option>
                <option value="loading">Loading</option>
                <option value="error">Error</option>
                <option value="empty">Empty</option>
              </select>
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
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const root = `/${locale}/admin/blogs`,
    capabilities = {
      create: !state.readOnly,
      edit: !state.readOnly,
      publish: !state.readOnly,
      delete: !state.readOnly,
      upload: !state.readOnly,
      manageCategories: !state.readOnly,
    };
  const common = {
    className: "showroom-page",
    assetUrl: state.mock.assetUrl,
    linkComponent: Link,
    client: state.client,
    capabilities,
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
          Article unavailable. <Link href={root}>Back to posts</Link>
        </p>
      );
    return (
      <BlogEditPage
        {...common}
        article={article}
        categories={state.mock.categories()}
        assets={state.mock.assets(article.id)}
        locales={blogLocales}
        defaultLocale={locale}
        backHref={root}
        onDeleted={() => navigate({ href: root })}
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
          .map((a) => articleListItem(a, locale));
  return (
    <BlogsPage
      {...common}
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
    className: "showroom-page",
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
          This translation is not published. <Link href={root}>Back to posts</Link>
        </p>
      );
    const article = state.mock.get(post.id),
      translations = blogLocales.flatMap((l) => {
        const p = article.translations[l.code]?.published;
        return p ? [{ locale: l.code, name: l.name, href: `/${l.code}/blogs/${p.slug}` }] : [];
      });
    return (
      <BlogPostPage
        {...common}
        post={post}
        backHref={root}
        categoryHref={(id) => `${root}?category=${id}`}
        translations={translations}
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

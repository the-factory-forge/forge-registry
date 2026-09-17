import { Markdown } from "@tanstack/markdown/react";
import { ArrowUpRight, CalendarDays, UserRound } from "lucide-react";

import { Image } from "@/components/image";
import { Link } from "@/components/link";
import { blogsLabels } from "@/components/plugins/blogs/labels";
import type {
  BlogCategory,
  BlogPost,
  BlogPublicPage,
  BlogsAppearanceProps,
} from "@/components/plugins/blogs/types";
import { assetIdFromUrl, MAX_MARKDOWN_BYTES, safeAssetUrl } from "@/components/plugins/blogs/utils";
import { cn } from "@/components/utils/cn";

export interface BlogMarkdownProps extends Pick<
  BlogsAppearanceProps,
  "assetUrl" | "className" | "imageComponent" | "linkComponent" | "maxMarkdownBytes"
> {
  markdown: string;
  assetIds: string[];
}
export function BlogMarkdown({
  markdown,
  assetIds,
  assetUrl,
  imageComponent: BlogImage = Image,
  linkComponent: BlogLink = Link,
  className,
  maxMarkdownBytes = MAX_MARKDOWN_BYTES,
}: BlogMarkdownProps) {
  const allowed = new Set(assetIds);
  if (new TextEncoder().encode(markdown).length > maxMarkdownBytes) return null;
  return (
    <div
      className={cn(
        "space-y-5 leading-8 break-words text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mt-8 [&_h1]:font-serif [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:border-border [&_img]:mx-auto [&_img]:max-h-[36rem] [&_img]:rounded-2xl [&_li]:ml-6 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-muted [&_pre]:p-4 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:p-3 [&_ul]:list-disc",
        className,
      )}
    >
      <Markdown
        allowHtml={false}
        urlTransform={(url, kind, defaultUrl) => {
          if (kind !== "image") return defaultUrl;
          const id = assetIdFromUrl(url);
          return id && allowed.has(id) ? safeAssetUrl(assetUrl(id)) || null : null;
        }}
        components={{
          img: ({ src, alt }) =>
            typeof src === "string" ? <BlogImage src={src} alt={alt ?? ""} /> : null,
          a: ({ href, children, ...props }) =>
            href ? (
              <BlogLink {...props} href={href}>
                {children}
              </BlogLink>
            ) : (
              <span>{children}</span>
            ),
          h1: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
export interface BlogIndexPageProps extends BlogsAppearanceProps {
  locale: string;
  data: BlogPublicPage;
  categories: BlogCategory[];
  search?: string;
  categoryId?: string;
  actionHref: string;
  postHref: (post: BlogPublicPage["items"][number]) => string;
  categoryHref: (id: string | null) => string;
  pageHref: (page: number) => string;
  loading?: boolean;
  error?: string;
}
const defaultDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
export function BlogIndexPage({
  locale,
  data,
  categories,
  search = "",
  categoryId,
  actionHref,
  postHref,
  categoryHref,
  pageHref,
  loading,
  error,
  labels: overrides,
  linkComponent: BlogLink = Link,
  imageComponent: BlogImage = Image,
  assetUrl,
  formatDate = defaultDate,
  className,
}: BlogIndexPageProps) {
  const labels = { ...blogsLabels, ...overrides },
    pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl space-y-10 px-4 py-10 text-foreground sm:px-6",
        className,
      )}
    >
      <header className="space-y-4 border-b border-border pb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {labels.publicTitle}
        </h1>
        <form action={actionHref} method="get" className="flex max-w-lg gap-2">
          <label className="sr-only" htmlFor="blog-search">
            {labels.search}
          </label>
          <input
            id="blog-search"
            name="search"
            defaultValue={search}
            placeholder={labels.search}
            className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          {categoryId && <input type="hidden" name="category" value={categoryId} />}
          <button className="rounded-2xl bg-primary px-4 py-2 text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {labels.searchSubmit}
          </button>
        </form>
      </header>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-8">
          {error ? (
            <p role="alert">{error}</p>
          ) : loading ? (
            <output>{labels.loading}</output>
          ) : !data.items.length ? (
            <output>{labels.empty}</output>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {data.items.map((post) => (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-3xl border border-border bg-card"
                >
                  {post.shared.thumbnailId && (
                    <BlogLink href={postHref(post)} tabIndex={-1} aria-hidden="true">
                      <BlogImage
                        src={safeAssetUrl(assetUrl(post.shared.thumbnailId))}
                        alt={post.thumbnailAlt}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </BlogLink>
                  )}
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3" />
                        {post.editor.name}
                      </span>
                      <time dateTime={post.updatedAt} className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(post.updatedAt, locale)}
                      </time>
                    </div>
                    <h2 className="font-serif text-xl leading-snug font-semibold">
                      <BlogLink
                        href={postHref(post)}
                        className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {post.title}
                      </BlogLink>
                    </h2>
                    {post.summary && (
                      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {post.summary}
                      </p>
                    )}
                    <BlogLink
                      href={postHref(post)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {labels.readMore}
                      <ArrowUpRight className="size-4" />
                    </BlogLink>
                  </div>
                </article>
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav
              aria-label={labels.pageLabel(data.page, pages)}
              className="flex justify-between gap-4 text-sm"
            >
              {data.page > 1 ? (
                <BlogLink href={pageHref(data.page - 1)}>{labels.previous}</BlogLink>
              ) : (
                <span />
              )}
              <span>{labels.pageLabel(data.page, pages)}</span>
              {data.page < pages && (
                <BlogLink href={pageHref(data.page + 1)}>{labels.next}</BlogLink>
              )}
            </nav>
          )}
        </div>
        <aside className="rounded-3xl border border-border p-5">
          <h2 className="mb-5 font-serif text-xl font-semibold">{labels.popularCategories}</h2>
          <nav aria-label={labels.categories} className="space-y-3">
            <BlogLink
              href={categoryHref(null)}
              aria-current={!categoryId ? "page" : undefined}
              className="block text-sm hover:underline"
            >
              {labels.allCategories}
            </BlogLink>
            {categories
              .filter((c) => c.translations[locale] && (data.categoryCounts[c.id] ?? 0) > 0)
              .map((c) => (
                <BlogLink
                  key={c.id}
                  href={categoryHref(c.id)}
                  aria-current={categoryId === c.id ? "page" : undefined}
                  className={cn(
                    "block text-sm text-muted-foreground hover:text-foreground hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
                    c.parentId && "pl-4",
                  )}
                >
                  {labels.categoryCount(
                    c.translations[locale].name,
                    data.categoryCounts[c.id] ?? 0,
                  )}
                </BlogLink>
              ))}
          </nav>
        </aside>
      </div>
    </section>
  );
}
export interface BlogPostPageProps extends BlogsAppearanceProps {
  post: BlogPost;
  categories: BlogCategory[];
  backHref: string;
  categoryHref: (id: string) => string;
  translations?: { locale: string; name: string; href: string }[];
}
export function BlogPostPage({
  post,
  categories,
  backHref,
  categoryHref,
  translations = [],
  labels: overrides,
  linkComponent: BlogLink = Link,
  imageComponent: BlogImage = Image,
  assetUrl,
  maxMarkdownBytes,
  formatDate = defaultDate,
  className,
}: BlogPostPageProps) {
  const labels = { ...blogsLabels, ...overrides };
  return (
    <article
      lang={post.locale}
      className={cn(
        "mx-auto w-full max-w-5xl space-y-8 px-4 py-10 text-foreground sm:px-6",
        className,
      )}
    >
      <BlogLink
        href={backHref}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← {labels.back}
      </BlogLink>
      <header className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {post.shared.categoryIds.map((id) => {
            const name = categories.find((c) => c.id === id)?.translations[post.locale]?.name;
            return name ? (
              <BlogLink
                key={id}
                href={categoryHref(id)}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                {name}
              </BlogLink>
            ) : null;
          })}
        </div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.summary && (
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.summary}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{post.editor.name}</span>
          <span>
            {labels.publishedDate}:{" "}
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, post.locale)}</time>
          </span>
          <span>
            {labels.modified}:{" "}
            <time dateTime={post.updatedAt}>{formatDate(post.updatedAt, post.locale)}</time>
          </span>
        </div>
        {translations.length > 1 && (
          <nav aria-label={labels.languages} className="flex gap-3 text-sm">
            {translations.map((t) => (
              <BlogLink
                key={t.locale}
                href={t.href}
                hrefLang={t.locale}
                aria-current={post.locale === t.locale ? "page" : undefined}
                className="underline"
              >
                {t.name}
              </BlogLink>
            ))}
          </nav>
        )}
      </header>
      {post.shared.bannerId && (
        <BlogImage
          src={safeAssetUrl(assetUrl(post.shared.bannerId))}
          alt={post.bannerAlt}
          priority
          className="max-h-[32rem] w-full rounded-3xl object-cover"
        />
      )}
      <BlogMarkdown
        maxMarkdownBytes={maxMarkdownBytes}
        markdown={post.markdown}
        assetIds={post.assetIds}
        assetUrl={assetUrl}
        imageComponent={BlogImage}
        linkComponent={BlogLink}
        className="mx-auto max-w-3xl"
      />
    </article>
  );
}

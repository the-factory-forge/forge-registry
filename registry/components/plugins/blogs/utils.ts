import { parseMarkdown } from "@tanstack/markdown/parser";

import type {
  BlogArticle,
  BlogCategory,
  BlogContent,
  BlogListItem,
  BlogPost,
  BlogPublicQuery,
  BlogShared,
} from "@/components/plugins/blogs/types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MARKDOWN_BYTES = 1024 * 1024;
export const emptyShared: BlogShared = { thumbnailId: null, bannerId: null, categoryIds: [] };
export const emptyContent: BlogContent = {
  title: "",
  slug: "",
  summary: "",
  markdown: "",
  thumbnailAlt: "",
  bannerAlt: "",
};
export type BlogsErrorCode =
  | "INVALID"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "IN_USE"
  | "STORAGE";
export class BlogsError extends Error {
  code: BlogsErrorCode;
  constructor(code: BlogsErrorCode) {
    super(code);
    this.name = "BlogsError";
    this.code = code;
  }
}
export function assertBlog(
  condition: unknown,
  code: BlogsErrorCode = "INVALID",
): asserts condition {
  if (!condition) throw new BlogsError(code);
}
export function validId(id: unknown): asserts id is string {
  assertBlog(typeof id === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id));
}
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
export function validateContent(
  content: BlogContent,
  maxBytes = MAX_MARKDOWN_BYTES,
  publishing = false,
) {
  assertBlog(content && typeof content === "object");
  for (const key of Object.keys(emptyContent) as (keyof BlogContent)[])
    assertBlog(typeof content[key] === "string");
  assertBlog(
    content.title.length <= 250 &&
      content.summary.length <= 2000 &&
      content.thumbnailAlt.length <= 1000 &&
      content.bannerAlt.length <= 1000,
  );
  assertBlog(new TextEncoder().encode(content.markdown).length <= maxBytes);
  assertBlog(content.slug === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.slug));
  assertBlog(content.slug.length <= 120);
  if (publishing) assertBlog(content.title.trim() && content.slug && content.markdown.trim());
  return {
    title: content.title.trim(),
    slug: content.slug,
    summary: content.summary.trim(),
    markdown: content.markdown,
    thumbnailAlt: content.thumbnailAlt,
    bannerAlt: content.bannerAlt,
  };
}
export function imageType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    return "image/jpeg";
  if (
    bytes.length >= 20 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
}
export function safeAssetUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\s]/.test(value)) return value;
  try {
    const url = new URL(value);
    if (["http:", "https:", "blob:"].includes(url.protocol) && !url.username && !url.password)
      return value;
  } catch {
    /* Invalid host URL. */
  }
  return "";
}
export function assetIdFromUrl(url: string) {
  const match = /^\.\/assets\/([\da-f-]+)$/i.exec(url);
  if (!match) return undefined;
  try {
    validId(match[1]);
    return match[1];
  } catch {
    return undefined;
  }
}
/** Use the same parser as the renderer, including reference-style images. */
export function markdownAssetIds(markdown: string) {
  const ids = new Set<string>();
  let invalid = false;
  parseMarkdown(markdown, {
    allowHtml: false,
    urlTransform(url, kind, defaultUrl) {
      if (kind !== "image") return defaultUrl;
      const id = assetIdFromUrl(url);
      if (id) ids.add(id);
      else invalid = true;
      return null;
    },
  });
  assertBlog(!invalid);
  return [...ids];
}
export function normalizeCategories(ids: string[], categories: BlogCategory[]) {
  assertBlog(Array.isArray(ids) && ids.length <= 100);
  const selected = new Set<string>();
  for (const id of ids) {
    validId(id);
    const category = categories.find((c) => c.id === id);
    assertBlog(category, "NOT_FOUND");
    selected.add(id);
    if (category.parentId) selected.add(category.parentId);
  }
  return [...selected].sort();
}
export function hasUnpublishedChanges(article: BlogArticle, locale: string) {
  const translation = article.translations[locale];
  return (
    !translation?.published ||
    translation.draft.revisionId !== translation.published.revisionId ||
    JSON.stringify(article.shared) !== JSON.stringify(translation.published.shared)
  );
}
export function articleListItem(article: BlogArticle, locale: string): BlogListItem {
  return {
    id: article.id,
    title:
      article.translations[locale]?.draft.title ??
      Object.values(article.translations)[0]?.draft.title ??
      "",
    editor: article.editor,
    updatedAt: article.updatedAt,
    translations: Object.entries(article.translations).map(([code, t]) => ({
      locale: code,
      slug: t.draft.slug,
      status: !t.published
        ? "draft"
        : hasUnpublishedChanges(article, code)
          ? "changed"
          : "published",
    })),
  };
}
export function publicPosts(articles: BlogArticle[], query: BlogPublicQuery) {
  const posts: BlogPost[] = articles.flatMap((article) => {
    const publication = article.translations[query.locale]?.published;
    return publication ? [{ ...publication, id: article.id, locale: query.locale }] : [];
  });
  const counts: Record<string, number> = {};
  for (const post of posts)
    for (const id of new Set(post.shared.categoryIds)) counts[id] = (counts[id] ?? 0) + 1;
  const search = (query.search ?? "").toLocaleLowerCase();
  const filtered = posts
    .filter(
      (p) =>
        (!query.categoryId || p.shared.categoryIds.includes(query.categoryId)) &&
        `${p.title} ${p.summary}`.toLocaleLowerCase().includes(search),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 12;
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    categoryCounts: counts,
  };
}

import type {
  BlogArticle,
  BlogCategory,
  BlogCategoryInput,
  BlogEditor,
  BlogSaveInput,
} from "@/components/plugins/blogs/types";
import {
  assertBlog,
  emptyContent,
  emptyShared,
  markdownAssetIds,
  normalizeCategories,
  slugify,
  validId,
  validateContent,
} from "@/components/plugins/blogs/utils";

export function createArticle(
  id: string,
  title: string,
  locale: string,
  editor: BlogEditor,
  now: string,
): BlogArticle {
  assertBlog(typeof title === "string" && title.trim() && title.length <= 250);
  return {
    id,
    version: 1,
    shared: { ...emptyShared, categoryIds: [] },
    editor,
    createdAt: now,
    updatedAt: now,
    translations: {
      [locale]: {
        draft: {
          ...emptyContent,
          title: title.trim(),
          slug: slugify(title),
          revisionId: null,
          assetIds: [],
          editor,
          updatedAt: now,
        },
        published: null,
      },
    },
  };
}
export function saveArticle(
  article: BlogArticle,
  input: BlogSaveInput,
  categories: BlogCategory[],
  assets: Set<string>,
  revisionId: string,
  editor: BlogEditor,
  now: string,
  maxBytes?: number,
): BlogArticle {
  assertBlog(input.shared && typeof input.shared === "object");
  const content = validateContent(input.content, maxBytes);
  const shared = {
    thumbnailId: input.shared.thumbnailId,
    bannerId: input.shared.bannerId,
    categoryIds: normalizeCategories(input.shared.categoryIds, categories),
  };
  for (const id of [shared.thumbnailId, shared.bannerId])
    if (id !== null) {
      validId(id);
      assertBlog(assets.has(id), "NOT_FOUND");
    }
  const assetIds = markdownAssetIds(content.markdown);
  for (const id of assetIds) assertBlog(assets.has(id), "NOT_FOUND");
  return {
    ...article,
    shared,
    version: article.version + 1,
    editor,
    updatedAt: now,
    translations: {
      ...article.translations,
      [input.locale]: {
        draft: { ...content, revisionId, assetIds, editor, updatedAt: now },
        published: article.translations[input.locale]?.published ?? null,
      },
    },
  };
}
export function publishArticle(
  article: BlogArticle,
  locale: string,
  categories: BlogCategory[],
  editor: BlogEditor,
  now: string,
  maxBytes?: number,
): BlogArticle {
  const translation = article.translations[locale];
  assertBlog(translation, "NOT_FOUND");
  validateContent(translation.draft, maxBytes, true);
  assertBlog(translation.draft.revisionId);
  for (const id of article.shared.categoryIds)
    assertBlog(categories.find((c) => c.id === id)?.translations[locale]?.name.trim());
  const draft = { ...translation.draft, editor, updatedAt: now };
  const published = {
    ...draft,
    shared: structuredClone(article.shared),
    assetIds: [
      ...new Set(
        [...draft.assetIds, article.shared.thumbnailId, article.shared.bannerId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ],
    publishedAt: translation.published?.publishedAt ?? now,
  };
  return {
    ...article,
    version: article.version + 1,
    updatedAt: now,
    editor,
    translations: { ...article.translations, [locale]: { draft, published } },
  };
}
export function unpublishArticle(
  article: BlogArticle,
  locale: string,
  editor: BlogEditor,
  now: string,
): BlogArticle {
  assertBlog(article.translations[locale], "NOT_FOUND");
  return {
    ...article,
    version: article.version + 1,
    editor,
    updatedAt: now,
    translations: {
      ...article.translations,
      [locale]: { ...article.translations[locale], published: null },
    },
  };
}
export function validateCategory(
  input: BlogCategoryInput,
  categories: BlogCategory[],
  locales: string[],
) {
  assertBlog(
    input &&
      typeof input === "object" &&
      input.translations &&
      typeof input.translations === "object",
  );
  if (input.parentId !== null) {
    validId(input.parentId);
    assertBlog(input.parentId !== input.id);
    const parent = categories.find((c) => c.id === input.parentId);
    assertBlog(parent && parent.parentId === null);
    assertBlog(!categories.some((c) => c.parentId === input.id));
  }
  const translations: BlogCategory["translations"] = {};
  for (const [locale, label] of Object.entries(input.translations)) {
    assertBlog(
      locales.includes(locale) &&
        label &&
        typeof label.name === "string" &&
        typeof label.slug === "string",
    );
    assertBlog(
      label.name.trim() &&
        label.name.length <= 150 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label.slug) &&
        label.slug.length <= 120,
    );
    assertBlog(
      !categories.some((c) => c.id !== input.id && c.translations[locale]?.slug === label.slug),
      "CONFLICT",
    );
    translations[locale] = { name: label.name.trim(), slug: label.slug };
  }
  assertBlog(Object.keys(translations).length);
  // Removing labels would break already published category links.
  const previous = categories.find((c) => c.id === input.id);
  if (previous)
    for (const locale of Object.keys(previous.translations)) assertBlog(translations[locale]);
  return translations;
}

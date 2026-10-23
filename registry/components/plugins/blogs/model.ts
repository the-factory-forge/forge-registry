import type {
  BlogArticle,
  BlogCategory,
  BlogCategoryInput,
  BlogEditor,
  BlogHistoryHeader,
  BlogHistoryVersion,
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
  draftShared,
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
    shared: { ...emptyShared, categoryIds: [], author: { id: editor.id, name: editor.name } },
    editor,
    createdAt: now,
    updatedAt: now,
    translations: {
      [locale]: {
        history: { lastNumber: 0, lastPublicationOrder: 0, currentId: null, publishedId: null },
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
  const previousShared = draftShared(article, input.locale);
  const author = input.shared.author ?? previousShared.author;
  const shared = {
    author: author ? { id: author.id, name: author.name } : undefined,
    thumbnailId: input.shared.thumbnailId,
    bannerId: input.shared.bannerId,
    categoryIds: normalizeCategories(input.shared.categoryIds, categories),
  };
  if (shared.author)
    assertBlog(
      typeof shared.author.id === "string" &&
        shared.author.id.length > 0 &&
        shared.author.id.length <= 250 &&
        typeof shared.author.name === "string" &&
        shared.author.name.trim().length > 0 &&
        shared.author.name.length <= 250,
    );
  for (const id of [shared.thumbnailId, shared.bannerId])
    if (id !== null) {
      validId(id);
      assertBlog(assets.has(id), "NOT_FOUND");
    }
  const assetIds = markdownAssetIds(content.markdown);
  for (const id of assetIds) assertBlog(assets.has(id), "NOT_FOUND");
  return {
    ...article,
    shared: {
      ...shared,
      author: author?.id !== previousShared.author?.id ? shared.author : article.shared.author,
    },
    version: article.version + 1,
    editor,
    updatedAt: now,
    translations: {
      ...Object.fromEntries(
        Object.entries(article.translations).map(([locale, translation]) => [
          locale,
          { ...translation, shared: translation.shared ?? structuredClone(article.shared) },
        ]),
      ),
      [input.locale]: {
        ...article.translations[input.locale],
        draft: { ...content, revisionId, assetIds, editor, updatedAt: now },
        shared: structuredClone(shared),
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
  assertBlog(article.shared.author, "AUTHOR_REQUIRED");
  const translation = article.translations[locale];
  assertBlog(translation, "NOT_FOUND");
  const shared = draftShared(article, locale);
  assertBlog(shared.author, "AUTHOR_REQUIRED");
  validateContent(translation.draft, maxBytes, true);
  assertBlog(translation.draft.revisionId);
  for (const id of shared.categoryIds)
    assertBlog(categories.find((c) => c.id === id)?.translations[locale]?.name.trim());
  const draft = { ...translation.draft, editor, updatedAt: now };
  const published = {
    ...draft,
    shared: {
      ...structuredClone(shared),
      author: { id: shared.author.id, name: shared.author.name },
    },
    assetIds: [
      ...new Set(
        [...draft.assetIds, shared.thumbnailId, shared.bannerId].filter((id): id is string =>
          Boolean(id),
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
    translations: { ...article.translations, [locale]: { ...translation, draft, published } },
  };
}

export const BLOG_PUBLICATION_LIMIT = 5;
export const BLOG_DRAFT_LIMIT = 8;

export function sameBlogInputs(
  left: Pick<BlogHistoryVersion, "content" | "shared">,
  right: Pick<BlogHistoryVersion, "content" | "shared">,
) {
  const inputs = ({ content, shared }: Pick<BlogHistoryVersion, "content" | "shared">) => [
    content.title,
    content.slug,
    content.summary,
    content.markdown,
    content.thumbnailAlt,
    content.bannerAlt,
    shared.author?.id ?? null,
    shared.thumbnailId,
    shared.bannerId,
    [...shared.categoryIds].sort(),
  ];
  return JSON.stringify(inputs(left)) === JSON.stringify(inputs(right));
}

/** Headers are sufficient for retention; only the selected body needs to be loaded. */
export function recordBlogSave(
  previous: BlogArticle,
  next: BlogArticle,
  input: BlogSaveInput,
  headers: BlogHistoryHeader[],
  source: BlogHistoryVersion | null,
) {
  const translation = next.translations[input.locale];
  const content = translation.draft;
  const shared = draftShared(next, input.locale);
  if (input.origin) {
    assertBlog(source && source.id === input.origin.versionId, "NOT_FOUND");
    assertBlog(source.locale === input.locale, "NOT_FOUND");
    if (source.state === "publication") {
      validId(input.origin.repriseId);
      assertBlog(
        !headers.some((header) => header.repriseId === input.origin!.repriseId),
        "CONFLICT",
      );
    } else {
      assertBlog(!input.origin.repriseId || input.origin.repriseId === source.repriseId);
    }
  }
  if (input.origin && source && !input.shared.author) shared.author = source.shared.author;
  const base = source ?? {
    content: previous.translations[input.locale]?.draft ?? {
      ...emptyContent,
      revisionId: null,
      assetIds: [],
      editor: previous.editor,
      updatedAt: previous.updatedAt,
    },
    shared: draftShared(previous, input.locale),
  };
  if (sameBlogInputs(base, { content, shared }))
    return { article: previous, saved: null, removedIds: [] as string[] };
  assertBlog(content.revisionId);
  const state = previous.translations[input.locale]?.history;
  const publication = source?.state === "publication" ? source : null;
  if (source && input.origin)
    next.shared.author =
      shared.author?.id === source.shared.author?.id ? previous.shared.author : shared.author;
  const saved: BlogHistoryVersion = {
    id: content.revisionId,
    number:
      Math.max(
        state?.lastNumber ?? 0,
        ...headers
          .filter((header) => header.locale === input.locale)
          .map((header) => header.number),
      ) + 1,
    locale: input.locale,
    state: "draft",
    savedAt: content.updatedAt,
    savedBy: { ...content.editor },
    author: shared.author ? { ...shared.author } : undefined,
    repriseId: publication
      ? (input.origin?.repriseId ?? content.revisionId)
      : (source?.repriseId ?? content.revisionId),
    sourcePublicationId: publication?.id ?? source?.sourcePublicationId ?? null,
    sourcePublicationOrder: publication?.publicationOrder ?? source?.sourcePublicationOrder ?? null,
    publicationOrder: null,
    publishedAt: null,
    omittedAssetIds: [],
    content: structuredClone(content),
    shared: structuredClone(shared),
  };
  const drafts = [
    ...headers.filter((header) => header.locale === input.locale && header.state === "draft"),
    saved,
  ].sort((left, right) => right.number - left.number);
  translation.history = {
    lastNumber: saved.number,
    lastPublicationOrder: state?.lastPublicationOrder ?? 0,
    currentId: saved.id,
    publishedId: state?.publishedId ?? null,
  };
  return {
    article: next,
    saved,
    removedIds: drafts.slice(BLOG_DRAFT_LIMIT).map((header) => header.id),
  };
}

export function blogPublicationDiscard(target: BlogHistoryHeader, headers: BlogHistoryHeader[]) {
  headers = headers.filter((header) => header.locale === target.locale);
  const sourceOrder =
    target.state === "publication" ? target.publicationOrder : target.sourcePublicationOrder;
  const later = headers.filter(
    (header) =>
      header.state === "publication" &&
      sourceOrder !== null &&
      header.publicationOrder! > sourceOrder &&
      header.id !== target.id,
  );
  const publications = headers
    .filter(
      (header) =>
        header.state === "publication" && !later.includes(header) && header.id !== target.id,
    )
    .sort((left, right) => right.publicationOrder! - left.publicationOrder!);
  const removed = new Set([
    ...later.map((header) => header.id),
    ...publications.slice(BLOG_PUBLICATION_LIMIT - 1).map((header) => header.id),
    ...headers
      .filter((header) => header.state === "draft" && header.id !== target.id)
      .map((header) => header.id),
  ]);
  return {
    historicalReturn: later.length > 0,
    discarded: headers
      .filter((header) => removed.has(header.id))
      .sort((left, right) => right.number - left.number),
  };
}

export function publishBlogVersion(
  article: BlogArticle,
  target: BlogHistoryVersion,
  headers: BlogHistoryHeader[],
  categories: BlogCategory[],
  editor: BlogEditor,
  now: string,
  omittedAssetIds: string[] = [],
  maxBytes?: number,
) {
  const translation = article.translations[target.locale];
  assertBlog(translation && translation.history, "NOT_FOUND");
  const plan = blogPublicationDiscard(target, headers);
  const prepared = {
    ...article,
    shared: { ...structuredClone(target.shared), author: article.shared.author },
    translations: {
      ...article.translations,
      [target.locale]: {
        ...translation,
        draft: { ...structuredClone(target.content), revisionId: target.id },
        shared: structuredClone(target.shared),
      },
    },
  };
  const next = publishArticle(prepared, target.locale, categories, editor, now, maxBytes);
  const current = next.translations[target.locale];
  const publication = current.published!;
  const omitted = new Set(omittedAssetIds);
  publication.omittedAssetIds = [...omitted];
  publication.assetIds = publication.assetIds.filter((id) => !omitted.has(id));
  if (publication.shared.thumbnailId && omitted.has(publication.shared.thumbnailId))
    publication.shared.thumbnailId = null;
  if (publication.shared.bannerId && omitted.has(publication.shared.bannerId))
    publication.shared.bannerId = null;
  const publicationOrder = translation.history.lastPublicationOrder + 1;
  current.history = {
    ...translation.history,
    currentId: target.id,
    publishedId: target.id,
    lastPublicationOrder: publicationOrder,
  };
  return {
    article: next,
    saved: {
      ...target,
      state: "publication" as const,
      publicationOrder,
      publishedAt: now,
      omittedAssetIds: [...omitted],
    },
    ...plan,
  };
}

export function deleteBlogVersion(
  article: BlogArticle,
  target: BlogHistoryHeader,
  headers: BlogHistoryHeader[],
  fallback: BlogHistoryVersion | null,
  editor: BlogEditor,
  now: string,
) {
  const translation = article.translations[target.locale];
  assertBlog(translation?.history, "NOT_FOUND");
  assertBlog(target.id !== translation.history.publishedId, "IN_USE");
  let current = translation;
  if (target.id === translation.history.currentId) {
    const remaining = headers.filter(
      (header) => header.locale === target.locale && header.id !== target.id,
    );
    const nextId =
      remaining
        .filter((header) => header.state === "draft")
        .sort((left, right) => right.number - left.number)[0]?.id ??
      translation.history.publishedId;
    assertBlog((fallback?.id ?? null) === nextId, "CONFLICT");
    current = {
      ...translation,
      draft: fallback
        ? structuredClone(fallback.content)
        : {
            ...emptyContent,
            revisionId: null,
            assetIds: [],
            editor,
            updatedAt: now,
          },
      shared: structuredClone(
        fallback?.shared ?? { ...emptyShared, categoryIds: [], author: article.shared.author },
      ),
      history: { ...translation.history, currentId: nextId },
    };
  }
  return {
    ...article,
    shared:
      current === translation
        ? article.shared
        : { ...current.shared!, author: article.shared.author },
    version: article.version + 1,
    editor,
    updatedAt: now,
    translations: { ...article.translations, [target.locale]: current },
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
      [locale]: {
        ...article.translations[locale],
        published: null,
        ...(article.translations[locale].history
          ? {
              history: { ...article.translations[locale].history!, publishedId: null },
            }
          : {}),
      },
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

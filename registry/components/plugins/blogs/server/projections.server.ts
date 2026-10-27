import { eq, gt } from "drizzle-orm";

import {
  blogsArticles,
  blogsHistory,
  blogsPublicationCategories,
  blogsTranslations,
  type BlogTranslationRecord,
  type BlogPublicationCategoryRecord,
} from "@/components/plugins/blogs/server/schema";
import type { BlogsTransaction } from "@/components/plugins/blogs/server/types";
import type { BlogArticle, BlogHistoryVersion } from "@/components/plugins/blogs/types";
import { lockPlugin } from "@/components/utils/database";

export function historyAssetIds({
  content,
  shared,
}: Pick<BlogHistoryVersion, "content" | "shared">) {
  return [
    ...new Set(
      [...content.assetIds, shared.thumbnailId, shared.bannerId].filter((id): id is string =>
        Boolean(id),
      ),
    ),
  ];
}

export function blogProjections(article: BlogArticle) {
  const fields = [
    article.shared,
    ...Object.values(article.translations).flatMap((t) => [
      ...(t.shared ? [t.shared] : []),
      ...(t.published ? [t.published.shared] : []),
    ]),
  ];
  const translations: BlogTranslationRecord[] = [];
  const publicationCategories: BlogPublicationCategoryRecord[] = [];
  for (const [locale, translation] of Object.entries(article.translations)) {
    const draft = translation.draft;
    translations.push({
      articleId: article.id,
      locale,
      kind: "draft",
      slug: draft.slug,
      searchText: `${draft.title} ${draft.summary}`,
      categoryIds: (translation.shared ?? article.shared).categoryIds,
      publication: null,
      publishedAt: null,
    });
    const published = translation.published;
    if (!published) continue;
    translations.push({
      articleId: article.id,
      locale,
      kind: "publication",
      slug: published.slug,
      searchText: `${published.title} ${published.summary}`,
      publication: published,
      publishedAt: new Date(published.publishedAt),
      categoryIds: published.shared.categoryIds,
    });
    publicationCategories.push(
      ...[...new Set(published.shared.categoryIds)].map((categoryId) => ({
        articleId: article.id,
        locale,
        categoryId,
      })),
    );
  }
  return {
    authorIds: [...new Set(fields.flatMap((field) => (field.author ? [field.author.id] : [])))],
    categoryIds: [...new Set(fields.flatMap((field) => field.categoryIds))],
    translations,
    publicationCategories,
  };
}

export async function updateBlogProjections(tx: BlogsTransaction, article: BlogArticle) {
  const { authorIds, categoryIds, translations, publicationCategories } = blogProjections(article);
  await tx
    .update(blogsArticles)
    .set({ authorIds, categoryIds })
    .where(eq(blogsArticles.id, article.id));
  await tx.delete(blogsTranslations).where(eq(blogsTranslations.articleId, article.id));
  await tx
    .delete(blogsPublicationCategories)
    .where(eq(blogsPublicationCategories.articleId, article.id));
  if (translations.length) await tx.insert(blogsTranslations).values(translations);
  if (publicationCategories.length)
    await tx.insert(blogsPublicationCategories).values(publicationCategories);
}

/** Migration only: stop old writers, add the schema, then run inside a host transaction. */
export async function backfillBlogProjections(tx: BlogsTransaction) {
  await lockPlugin(tx, "forge-blogs");
  let articleCount = 0,
    historyCount = 0;
  let after: string | undefined;
  for (;;) {
    const rows = await tx
      .select()
      .from(blogsArticles)
      .where(after ? gt(blogsArticles.id, after) : undefined)
      .orderBy(blogsArticles.id)
      .limit(100);
    if (!rows.length) break;
    for (const row of rows) {
      await updateBlogProjections(tx, row.document);
      articleCount++;
    }
    after = rows.at(-1)!.id;
  }
  after = undefined;
  for (;;) {
    const rows = await tx
      .select()
      .from(blogsHistory)
      .where(after ? gt(blogsHistory.id, after) : undefined)
      .orderBy(blogsHistory.id)
      .limit(100);
    if (!rows.length) break;
    for (const row of rows) {
      await tx
        .update(blogsHistory)
        .set({ assetIds: historyAssetIds(row.payload) })
        .where(eq(blogsHistory.id, row.id));
      historyCount++;
    }
    after = rows.at(-1)!.id;
  }
  return { articles: articleCount, history: historyCount };
}

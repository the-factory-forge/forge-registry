import { isDeepStrictEqual } from "node:util";

import { eq, gt } from "drizzle-orm";

import {
  blogProjections,
  historyAssetIds,
} from "@/components/plugins/blogs/server/projections.server";
import {
  blogsArticles,
  blogsCategories,
  blogsHistory,
  blogsMutations,
  blogsObjects,
  blogsTranslations,
  blogsPublicationCategories,
} from "@/components/plugins/blogs/server/schema";
import type { BlogsDatabase } from "@/components/plugins/blogs/server/types";
import { lockPlugin } from "@/components/utils/database";

/** Startup preflight only; validates existing data without repairing it or migrating. */
export async function assertBlogStorageReady(db: BlogsDatabase) {
  try {
    return await db.transaction(async (tx) => {
      await lockPlugin(tx, "forge-blogs");
      for (const table of [
        blogsArticles,
        blogsCategories,
        blogsHistory,
        blogsMutations,
        blogsObjects,
        blogsTranslations,
        blogsPublicationCategories,
      ]) {
        await tx.select().from(table).limit(0);
      }
      let articles = 0,
        history = 0;
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
          const expected = blogProjections(row.document);
          const translations = await tx
            .select()
            .from(blogsTranslations)
            .where(eq(blogsTranslations.articleId, row.id));
          const categories = await tx
            .select()
            .from(blogsPublicationCategories)
            .where(eq(blogsPublicationCategories.articleId, row.id));
          const translationOrder = (
            a: (typeof translations)[number],
            b: (typeof translations)[number],
          ) => a.locale.localeCompare(b.locale) || a.kind.localeCompare(b.kind);
          const categoryOrder = (a: (typeof categories)[number], b: (typeof categories)[number]) =>
            a.locale.localeCompare(b.locale) || a.categoryId.localeCompare(b.categoryId);
          if (
            row.id !== row.document.id ||
            !isDeepStrictEqual([...row.authorIds].sort(), [...expected.authorIds].sort()) ||
            !isDeepStrictEqual([...row.categoryIds].sort(), [...expected.categoryIds].sort()) ||
            !isDeepStrictEqual(
              translations.sort(translationOrder),
              expected.translations.sort(translationOrder),
            ) ||
            !isDeepStrictEqual(
              categories.sort(categoryOrder),
              expected.publicationCategories.sort(categoryOrder),
            )
          ) {
            throw new Error(`Article projections differ: ${row.id}`);
          }
          articles++;
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
          if (!isDeepStrictEqual([...row.assetIds].sort(), historyAssetIds(row.payload).sort())) {
            throw new Error(`History image references differ: ${row.id}`);
          }
          history++;
        }
        after = rows.at(-1)!.id;
      }
      return { articles, history };
    });
  } catch (cause) {
    throw new Error(
      "Blog storage is not ready. Apply reviewed migrations and backfills before starting services.",
      { cause },
    );
  }
}

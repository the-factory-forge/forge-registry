import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  and,
  arrayContains,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  lt,
  ne,
} from "drizzle-orm";
import { z } from "zod";

import {
  createArticle,
  saveBlogDraft,
  unpublishArticle,
  validateCategory,
  sameBlogInputs,
  blogPublicationDiscard,
  publishBlogVersion,
  deleteBlogVersion,
  BLOG_DRAFT_LIMIT,
  BLOG_PUBLICATION_LIMIT,
} from "@/components/plugins/blogs/model";
import { blogInputs, blogIdSchema, parseBlogInput } from "@/components/plugins/blogs/server/input";
import {
  historyAssetIds,
  updateBlogProjections,
} from "@/components/plugins/blogs/server/projections.server";
import { assertBlogStorageReady } from "@/components/plugins/blogs/server/readiness.server";
import {
  blogsArticles as articles,
  blogsCategories as categoriesTable,
  blogsHistory as historyTable,
  blogsObjects as objects,
  blogsMutations as mutations,
  blogsTranslations as translations,
  blogsPublicationCategories as publicationCategories,
} from "@/components/plugins/blogs/server/schema";
import type {
  BlogImageInput,
  BlogsPermission,
  BlogsStorageOptions,
  BlogsTransaction,
} from "@/components/plugins/blogs/server/types";
import type {
  BlogArticle,
  BlogEditor,
  BlogShared,
  BlogAsset,
  BlogCategory,
  BlogCategoryInput,
  BlogMutation,
  BlogPost,
  BlogPostMutation,
  BlogPublishInput,
  BlogQuery,
  BlogPublicQuery,
  BlogSaveInput,
  BlogsClient,
  BlogHistoryHeader,
  BlogHistoryVersion,
  BlogHistoryTarget,
  BlogHistoryPlan,
  BlogRevision,
} from "@/components/plugins/blogs/types";
import {
  articleListItem,
  assertBlog,
  BlogsError,
  imageType,
  MAX_IMAGE_BYTES,
  MAX_MARKDOWN_BYTES,
  validId,
  draftShared,
  validateContent,
} from "@/components/plugins/blogs/utils";
import { databaseErrorCode } from "@/components/utils/database";
import { lockPlugin, containsPattern } from "@/components/utils/database";
import { storageFilename } from "@/components/utils/storage-filename";

type ObjectRow = typeof objects.$inferSelect;
function references(article: BlogArticle) {
  const refs = new Set(
    [article.shared.thumbnailId, article.shared.bannerId].filter((v): v is string => Boolean(v)),
  );
  for (const t of Object.values(article.translations))
    for (const id of [t.shared?.thumbnailId, t.shared?.bannerId]) if (id) refs.add(id);
  for (const t of Object.values(article.translations))
    for (const revision of [t.draft, t.published])
      if (revision) {
        for (const id of revision.assetIds) refs.add(id);
      }
  return refs;
}
const asset = (row: ObjectRow): BlogAsset => ({
  id: row.id,
  postId: row.articleId,
  name: row.name,
  size: row.size,
  contentType: row.contentType,
});

export function createBlogsStorage<Context>(options: BlogsStorageOptions<Context>) {
  const { db, s3 } = options;
  let readiness: ReturnType<typeof assertBlogStorageReady> | undefined;
  function preflight() {
    readiness ??= assertBlogStorageReady(db).catch((error: unknown) => {
      readiness = undefined;
      throw error;
    });
    return readiness;
  }
  const bucket = options.bucket?.trim();
  const prefix = options.keyPrefix;
  function scopedKey(key: string) {
    assertBlog(
      key.startsWith(prefix) &&
        !key.split("/").some((part) => !part || part === "." || part === ".."),
      "STORAGE",
    );
    return key;
  }
  const maxImage = options.maxImageBytes ?? MAX_IMAGE_BYTES;
  const maxMarkdown = options.maxMarkdownBytes ?? MAX_MARKDOWN_BYTES;
  let bucketVerified: Promise<void> | undefined;
  function verifyBucket() {
    assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
    bucketVerified ??= s3
      .send(new GetBucketVersioningCommand({ Bucket: bucket }), {
        abortSignal: AbortSignal.timeout(30000),
      })
      .then((result) => {
        assertBlog(!result.Status, "STORAGE");
      })
      .catch((error: unknown) => {
        bucketVerified = undefined;
        throw error;
      });
    return bucketVerified;
  }
  assertBlog(/^[a-z0-9]+(?:-[a-z0-9]+)*\/blogs\/$/.test(prefix));
  assertBlog(
    options.locales.length > 0 &&
      options.locales.length <= 20 &&
      options.locales.every((l) => /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(l)),
  );
  assertBlog(Number.isSafeInteger(maxImage) && maxImage > 0 && maxImage <= 100 * 1024 * 1024);
  assertBlog(
    Number.isSafeInteger(maxMarkdown) && maxMarkdown > 0 && maxMarkdown <= 10 * 1024 * 1024,
  );
  function locale(value: string) {
    assertBlog(options.locales.includes(value));
  }
  function query(input: BlogQuery) {
    locale(input.locale);
    const page = input.page ?? 1,
      pageSize = input.pageSize ?? 12,
      search = input.search ?? "";
    assertBlog(
      Number.isSafeInteger(page) &&
        page >= 1 &&
        page <= 100000 &&
        Number.isSafeInteger(pageSize) &&
        pageSize >= 1 &&
        pageSize <= 100 &&
        typeof search === "string" &&
        search.length <= 250,
    );
    return { page, pageSize, search };
  }
  async function access(context: Context, permission: BlogsPermission, id?: string) {
    if (id !== undefined) validId(id);
    assertBlog(await options.authorize(context, permission, id), "FORBIDDEN");
  }
  async function guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      await preflight();
      return await action();
    } catch (error) {
      if (error instanceof BlogsError) throw error;
      if (databaseErrorCode(error) === "23505") throw new BlogsError("CONFLICT");
      throw new BlogsError("STORAGE");
    }
  }
  // shortcut: serialize blog writes and maintenance per database; use per-article locks
  // plus transactional taxonomy/slug indexes if a host needs high write throughput.
  async function lock(tx: BlogsTransaction) {
    await lockPlugin(tx, "forge-blogs");
  }
  async function metadata(tx: BlogsTransaction, id: string) {
    const [row] = await tx
      .select({ document: articles.document })
      .from(articles)
      .where(eq(articles.id, id));
    assertBlog(row, "NOT_FOUND");
    return row.document;
  }
  function authorFields(article: BlogArticle) {
    return [
      article.shared,
      ...Object.values(article.translations).flatMap((translation) => [
        ...(translation.shared ? [translation.shared] : []),
        ...(translation.published ? [translation.published.shared] : []),
      ]),
    ];
  }
  async function refreshAuthorNames(tx: BlogsTransaction, fields: Pick<BlogShared, "author">[]) {
    for (const field of fields)
      if (field.author) field.author = { id: field.author.id, name: field.author.name };
    if (!options.resolveAuthorNames) return;
    const ids = [...new Set(fields.flatMap((field) => (field.author ? [field.author.id] : [])))];
    if (!ids.length) return;
    const names = await options.resolveAuthorNames(ids, tx);
    for (const author of names) {
      assertBlog(
        ids.includes(author.id) &&
          typeof author.name === "string" &&
          author.name.trim().length > 0 &&
          author.name.length <= 250,
      );
    }
    const byId = new Map(names.map((author) => [author.id, author.name]));
    for (const field of fields) {
      const name = field.author && byId.get(field.author.id);
      if (field.author && name) field.author = { id: field.author.id, name };
    }
  }
  /** Server-only: call inside the host's authorized account-deletion transaction. */
  async function snapshotAuthorName(tx: BlogsTransaction, author: BlogEditor) {
    assertBlog(
      typeof author.id === "string" &&
        author.id.length > 0 &&
        author.id.length <= 250 &&
        typeof author.name === "string" &&
        author.name.trim().length > 0 &&
        author.name.length <= 250,
    );
    await lock(tx);
    const records = await tx
      .select({ document: articles.document })
      .from(articles)
      .where(arrayContains(articles.authorIds, [author.id]));
    for (const { document } of records) {
      for (const field of authorFields(document))
        if (field.author?.id === author.id) field.author = { id: author.id, name: author.name };
      await saveRecord(tx, document);
    }
    const versions = await tx
      .select()
      .from(historyTable)
      .where(eq(historyTable.authorId, author.id));
    for (const version of versions) {
      await tx
        .update(historyTable)
        .set({
          header: { ...version.header, author: { ...author } },
          payload: {
            ...version.payload,
            shared: { ...version.payload.shared, author: { ...author } },
          },
        })
        .where(eq(historyTable.id, version.id));
    }
  }
  async function allCategories(tx: BlogsTransaction) {
    return (
      await tx
        .select({ document: categoriesTable.document })
        .from(categoriesTable)
        .orderBy(categoriesTable.id)
    ).map((r) => r.document);
  }

  async function historyHeaders(tx: BlogsTransaction, id: string, language: string) {
    return (
      await tx
        .select({ header: historyTable.header })
        .from(historyTable)
        .where(and(eq(historyTable.articleId, id), eq(historyTable.locale, language)))
        .orderBy(desc(historyTable.number))
        .limit(BLOG_DRAFT_LIMIT + BLOG_PUBLICATION_LIMIT)
    ).map((row) => row.header);
  }
  async function historyVersion(
    tx: BlogsTransaction,
    id: string,
    language: string,
    versionId: string,
  ) {
    validId(versionId);
    const [row] = await tx
      .select({ header: historyTable.header, payload: historyTable.payload })
      .from(historyTable)
      .where(
        and(
          eq(historyTable.articleId, id),
          eq(historyTable.locale, language),
          eq(historyTable.id, versionId),
        ),
      );
    assertBlog(row, "NOT_FOUND");
    return { ...row.header, ...row.payload };
  }
  async function storeHistory(
    tx: BlogsTransaction,
    articleId: string,
    version: BlogHistoryVersion,
  ) {
    const { content, shared, ...header } = version;
    const saved = await tx
      .insert(historyTable)
      .values({
        id: version.id,
        articleId,
        locale: version.locale,
        number: version.number,
        header,
        payload: { content, shared },
        assetIds: historyAssetIds({ content, shared }),
      })
      .onConflictDoUpdate({
        target: historyTable.id,
        set: { header },
        setWhere: and(
          eq(historyTable.articleId, articleId),
          eq(historyTable.locale, version.locale),
          eq(historyTable.number, version.number),
        ),
      })
      .returning({ id: historyTable.id });
    assertBlog(saved.length === 1, "CONFLICT");
  }
  async function removeHistory(tx: BlogsTransaction, id: string, language: string, ids: string[]) {
    if (ids.length)
      await tx
        .delete(historyTable)
        .where(
          and(
            eq(historyTable.articleId, id),
            eq(historyTable.locale, language),
            inArray(historyTable.id, ids),
          ),
        );
  }
  async function seedHistory(tx: BlogsTransaction, article: BlogArticle, language: string) {
    const translation = article.translations[language];
    if (!translation || translation.history) return false;
    const state = {
      lastNumber: 0,
      lastPublicationOrder: 0,
      currentId: null as string | null,
      publishedId: null as string | null,
    };
    const draftSettings = draftShared(article, language);
    const seed = (
      revision: BlogRevision,
      settings: BlogShared,
      published: boolean,
    ): BlogHistoryVersion => {
      const id = randomUUID();
      const content: BlogRevision = {
        title: revision.title,
        slug: revision.slug,
        summary: revision.summary,
        markdown: revision.markdown,
        thumbnailAlt: revision.thumbnailAlt,
        bannerAlt: revision.bannerAlt,
        revisionId: revision.revisionId,
        assetIds: [...revision.assetIds],
        editor: { id: revision.editor.id, name: revision.editor.name },
        updatedAt: revision.updatedAt,
      };
      const shared: BlogShared = {
        thumbnailId: settings.thumbnailId,
        bannerId: settings.bannerId,
        categoryIds: [...settings.categoryIds],
        author: settings.author
          ? { id: settings.author.id, name: settings.author.name }
          : undefined,
      };
      return {
        id,
        locale: language,
        number: ++state.lastNumber,
        state: published ? "publication" : "draft",
        savedAt: revision.updatedAt,
        savedBy: { ...content.editor },
        author: shared.author,
        repriseId: published ? null : id,
        sourcePublicationId: published ? null : state.publishedId,
        sourcePublicationOrder: published ? null : state.lastPublicationOrder || null,
        publicationOrder: published ? ++state.lastPublicationOrder : null,
        publishedAt: published ? translation.published!.publishedAt : null,
        omittedAssetIds: published ? [...(translation.published!.omittedAssetIds ?? [])] : [],
        content,
        shared,
      };
    };
    if (translation.published) {
      const publication = seed(translation.published, translation.published.shared, true);
      state.publishedId = publication.id;
      state.currentId = publication.id;
      await storeHistory(tx, article.id, publication);
    }
    if (
      !translation.published ||
      !sameBlogInputs(
        { content: translation.draft, shared: draftSettings },
        { content: translation.published, shared: translation.published.shared },
      )
    ) {
      const draft = seed(translation.draft, draftSettings, false);
      state.currentId = draft.id;
      await storeHistory(tx, article.id, draft);
    }
    translation.shared = structuredClone(draftSettings);
    translation.history = state;
    return true;
  }
  /** Server-only migration hook. Call inside the host's reviewed migration transaction. */
  async function backfillHistory(tx: BlogsTransaction) {
    await lock(tx);
    const records = await tx
      .select({ document: articles.document })
      .from(articles)
      .orderBy(articles.id);
    let updated = 0;
    for (const { document } of records) {
      let changed = false;
      for (const language of Object.keys(document.translations))
        changed = (await seedHistory(tx, document, language)) || changed;
      if (changed) {
        await saveRecord(tx, document);
        updated++;
      }
    }
    return { updated };
  }
  async function object(tx: BlogsTransaction, id: string, articleId: string) {
    const [row] = await tx
      .select()
      .from(objects)
      .where(and(eq(objects.id, id), eq(objects.articleId, articleId), eq(objects.state, "ready")));
    assertBlog(row, "NOT_FOUND");
    return row;
  }
  async function get(context: Context, id: string) {
    id = parseBlogInput(blogIdSchema, id);
    await access(context, "read", id);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const article = await metadata(tx, id);
        await refreshAuthorNames(tx, authorFields(article));
        return article;
      }),
    );
  }
  async function reserve(
    context: Context,
    permission: BlogsPermission,
    articleId: string,
    name: string,
    contentType: string,
    size: number,
  ) {
    await access(context, permission, articleId);
    assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
    const id = randomUUID(),
      key = `${prefix}${articleId}/${id}/${storageFilename(name, "blog", contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length))}`;
    await guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        await access(context, permission, articleId);
        await metadata(tx, articleId);
        await tx
          .insert(objects)
          .values({ id, articleId, key, kind: "image", name, contentType, size, state: "pending" });
      }),
    );
    return { id, key };
  }
  async function put(
    tx: BlogsTransaction,
    reserved: { id: string; key: string },
    bytes: Uint8Array,
    contentType: string,
  ) {
    assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
    await verifyBucket();
    const [pending] = await tx
      .select({ id: objects.id })
      .from(objects)
      .where(and(eq(objects.id, reserved.id), eq(objects.state, "pending")));
    assertBlog(pending, "CONFLICT");
    // Each upload reserves a fresh UUID key; some S3 providers reject conditional PUTs.
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: scopedKey(reserved.key),
        Body: bytes,
        ContentType: contentType,
        ContentLength: bytes.length,
      }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
    await tx.update(objects).set({ state: "ready" }).where(eq(objects.id, reserved.id));
  }
  async function write<T>(
    context: Context,
    permission: BlogsPermission,
    articleId: string | undefined,
    input: BlogMutation,
    operation: string,
    action: (
      tx: BlogsTransaction,
      editor: Awaited<ReturnType<typeof options.resolveEditor>>,
    ) => Promise<T>,
  ): Promise<T> {
    validId(input.requestId);
    await access(context, permission, articleId);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([operation, input]))
      .digest("hex");
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        await access(context, permission, articleId);
        const editor = await options.resolveEditor(context);
        assertBlog(
          editor &&
            typeof editor.id === "string" &&
            editor.id.length > 0 &&
            editor.id.length <= 250 &&
            typeof editor.name === "string" &&
            editor.name.trim() &&
            editor.name.length <= 250,
        );
        const [previous] = await tx
          .select()
          .from(mutations)
          .where(eq(mutations.id, input.requestId));
        if (previous) {
          assertBlog(
            previous.actorId === editor.id && previous.fingerprint === fingerprint,
            "CONFLICT",
          );
          // The actor, operation and exact input fingerprint identify this server-written result.
          return previous.result as T;
        }
        const result = await action(tx, { id: editor.id, name: editor.name });
        await tx
          .insert(mutations)
          .values({ id: input.requestId, actorId: editor.id, fingerprint, result });
        return result;
      }),
    );
  }
  async function current(tx: BlogsTransaction, input: Pick<BlogPostMutation, "id" | "version">) {
    assertBlog(Number.isSafeInteger(input.version) && input.version >= 1);
    const article = await metadata(tx, input.id);
    assertBlog(article.version === input.version, "CONFLICT");
    return article;
  }
  async function saveRecord(tx: BlogsTransaction, article: BlogArticle) {
    await tx
      .update(articles)
      .set({ document: article, version: article.version, updatedAt: new Date(article.updatedAt) })
      .where(eq(articles.id, article.id));
    await updateBlogProjections(tx, article);
    return { id: article.id };
  }
  async function uniqueSlug(tx: BlogsTransaction, id: string, l: string, slug: string) {
    if (!slug) return;
    const existing = await tx
      .select({ id: translations.articleId })
      .from(translations)
      .where(
        and(
          ne(translations.articleId, id),
          eq(translations.locale, l),
          eq(translations.slug, slug),
        ),
      )
      .limit(1);
    assertBlog(!existing.length, "CONFLICT");
  }
  async function create(context: Context, input: BlogMutation & { title: string; locale: string }) {
    input = parseBlogInput(blogInputs.create, input);
    locale(input.locale);
    const result = await write(
      context,
      "create",
      undefined,
      input,
      "create",
      async (tx, editor) => {
        const id = randomUUID(),
          now = new Date().toISOString();
        const article = createArticle(id, input.title, input.locale, editor, now);
        const draft = article.translations[input.locale].draft;
        if (!draft.slug) draft.slug = `post-${id.slice(0, 8)}`;
        try {
          await uniqueSlug(tx, id, input.locale, draft.slug);
        } catch (error) {
          if (!(error instanceof BlogsError) || error.code !== "CONFLICT") throw error;
          draft.slug = `${draft.slug.slice(0, 100)}-${id.slice(0, 8)}`;
        }
        await uniqueSlug(tx, id, input.locale, draft.slug);
        await tx
          .insert(articles)
          .values({ id, version: 1, document: article, updatedAt: new Date(now) });
        await updateBlogProjections(tx, article);
        return { id };
      },
    );
    return get(context, result.id);
  }
  async function save(context: Context, input: BlogSaveInput) {
    input = parseBlogInput(blogInputs.save, input);
    locale(input.locale);
    validateContent(input.content, maxMarkdown);
    const result = await write(context, "edit", input.id, input, "save", async (tx, editor) => {
      const article = await current(tx, input),
        categories = await allCategories(tx);
      await seedHistory(tx, article, input.locale);
      if (input.origin) {
        assertBlog(typeof input.origin === "object" && !Array.isArray(input.origin));
        validId(input.origin.versionId);
        if (input.origin.repriseId !== undefined) validId(input.origin.repriseId);
        await access(context, "publish", input.id);
      }
      const sourceId =
        input.origin?.versionId ?? article.translations[input.locale]?.history?.currentId;
      const source = sourceId ? await historyVersion(tx, input.id, input.locale, sourceId) : null;
      const currentAuthor = source
        ? source.shared.author
        : draftShared(article, input.locale).author;
      const authorId = input.shared?.author?.id ?? currentAuthor?.id;
      if (input.shared?.author !== undefined)
        assertBlog(typeof authorId === "string" && authorId.length > 0 && authorId.length <= 250);
      if (source && !source.shared.author && authorId && (input.origin || article.shared.author))
        await access(context, "reviewLegacyAuthor", input.id);
      if (authorId && authorId !== currentAuthor?.id) {
        assertBlog(options.resolveAuthor, "FORBIDDEN");
        await access(context, "changeAuthor", input.id);
      }
      const resolvedAuthor = authorId
        ? options.resolveAuthor
          ? await options.resolveAuthor(context, authorId, tx)
          : authorId === editor.id
            ? editor
            : null
        : null;
      const author = resolvedAuthor ?? (authorId === currentAuthor?.id ? currentAuthor : undefined);
      assertBlog(!authorId || (author && author.id === authorId), "NOT_FOUND");
      const images = await tx
        .select({ id: objects.id })
        .from(objects)
        .where(
          and(
            eq(objects.articleId, input.id),
            eq(objects.kind, "image"),
            eq(objects.state, "ready"),
          ),
        );
      const recorded = saveBlogDraft(
        article,
        { ...input, shared: { ...input.shared, author } },
        {
          categories,
          assets: new Set(images.map((i) => i.id)),
          revisionId: randomUUID(),
          editor,
          now: new Date().toISOString(),
          maxBytes: maxMarkdown,
          headers: await historyHeaders(tx, input.id, input.locale),
          source,
        },
      );
      await uniqueSlug(
        tx,
        input.id,
        input.locale,
        recorded.article.translations[input.locale].draft.slug,
      );
      if (recorded.saved) await storeHistory(tx, input.id, recorded.saved);
      await removeHistory(tx, input.id, input.locale, recorded.removedIds);
      return saveRecord(tx, recorded.article);
    });
    return get(context, result.id);
  }
  async function commitPublication(
    tx: BlogsTransaction,
    article: BlogArticle,
    target: BlogHistoryVersion,
    headers: BlogHistoryHeader[],
    editor: BlogEditor,
    now: string,
    omittedAssetIds: string[],
  ) {
    await refreshAuthorNames(tx, [target.shared]);
    const result = publishBlogVersion(
      article,
      target,
      headers,
      await allCategories(tx),
      editor,
      now,
      omittedAssetIds,
      maxMarkdown,
    );
    await uniqueSlug(
      tx,
      article.id,
      target.locale,
      result.article.translations[target.locale].published!.slug,
    );
    await storeHistory(tx, article.id, result.saved);
    await removeHistory(
      tx,
      article.id,
      target.locale,
      result.discarded.map((header) => header.id),
    );
    return saveRecord(tx, result.article);
  }
  async function publish(context: Context, input: BlogPublishInput, remove = false) {
    input = parseBlogInput(blogInputs.publish, input);
    locale(input.locale);
    const result = await write(
      context,
      "publish",
      input.id,
      input,
      remove ? "unpublish" : "publish",
      async (tx, editor) => {
        const article = await current(tx, input),
          now = new Date().toISOString();
        if (remove) return saveRecord(tx, unpublishArticle(article, input.locale, editor, now));
        await seedHistory(tx, article, input.locale);
        const targetId = article.translations[input.locale]?.history?.currentId;
        assertBlog(targetId);
        const target = await historyVersion(tx, input.id, input.locale, targetId);
        const headers = await historyHeaders(tx, input.id, input.locale);
        assertBlog(
          !blogPublicationDiscard(target, headers).historicalReturn,
          "HISTORY_CONFIRMATION_REQUIRED",
        );
        const missing = await inspectHistoryImages(tx, input.id, target);
        assertBlog(!missing.length, "NOT_FOUND");
        return commitPublication(tx, article, target, headers, editor, now, []);
      },
    );
    return get(context, result.id);
  }
  async function inspectHistoryImages(
    tx: BlogsTransaction,
    articleId: string,
    version: BlogHistoryVersion,
  ) {
    const ids = [
      ...new Set(
        [...version.content.assetIds, version.shared.thumbnailId, version.shared.bannerId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const missing: string[] = [];
    const records: ObjectRow[] = [];
    for (const id of ids) {
      validId(id);
      const [record] = await tx.select().from(objects).where(eq(objects.id, id));
      if (!record) {
        missing.push(id);
        continue;
      }
      assertBlog(record.articleId === articleId && record.kind === "image", "FORBIDDEN");
      assertBlog(record.state === "ready", "INVALID");
      records.push(record);
    }
    for (const record of records) {
      assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
      try {
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: scopedKey(record.key) }),
          { abortSignal: AbortSignal.timeout(30000) },
        );
        assertBlog(
          head.ContentLength === record.size && head.ContentType === record.contentType,
          "STORAGE",
        );
      } catch (error) {
        const status =
          error && typeof error === "object" && "$metadata" in error
            ? (error.$metadata as { httpStatusCode?: number })?.httpStatusCode
            : undefined;
        if (status !== 404 || (error instanceof Error && error.name === "NoSuchBucket"))
          throw error;
        // Confirm the bucket still exists before treating a 404 as a missing illustration.
        const versioning = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }), {
          abortSignal: AbortSignal.timeout(30000),
        });
        assertBlog(!versioning.Status, "STORAGE");
        missing.push(record.id);
      }
    }
    return missing.sort();
  }
  async function publicationPlan(tx: BlogsTransaction, input: BlogHistoryTarget) {
    locale(input.locale);
    const article = await current(tx, input);
    const target = await historyVersion(tx, input.id, input.locale, input.versionId);
    assertBlog(target.shared.author && article.shared.author, "AUTHOR_REQUIRED");
    validateContent(target.content, maxMarkdown, true);
    const headers = await historyHeaders(tx, input.id, input.locale);
    const discard = blogPublicationDiscard(target, headers);
    const missingAssetIds = await inspectHistoryImages(tx, input.id, target);
    await refreshAuthorNames(tx, headers);
    const plan: BlogHistoryPlan = {
      target: {
        id: input.id,
        version: article.version,
        locale: input.locale,
        versionId: target.id,
      },
      ...discard,
      missingAssetIds,
      token: createHash("sha256")
        .update(
          JSON.stringify([
            input.id,
            article.version,
            input.locale,
            target.id,
            discard.discarded.map((header) => header.id).sort(),
            missingAssetIds,
          ]),
        )
        .digest("hex"),
    };
    return { article, target, headers, plan };
  }
  function historyClient(context: Context): NonNullable<BlogsClient["history"]> {
    return {
      list: async (input) => {
        input = parseBlogInput(blogInputs.historyList, input);
        locale(input.locale);
        await access(context, "read", input.id);
        return guard(() =>
          db.transaction(async (tx) => {
            await lock(tx);
            await access(context, "read", input.id);
            await metadata(tx, input.id);
            const headers = await historyHeaders(tx, input.id, input.locale);
            await refreshAuthorNames(tx, headers);
            return headers;
          }),
        );
      },
      get: async (input) => {
        input = parseBlogInput(blogInputs.historyGet, input);
        locale(input.locale);
        await access(context, "read", input.id);
        return guard(() =>
          db.transaction(async (tx) => {
            await lock(tx);
            await access(context, "read", input.id);
            const version = await historyVersion(tx, input.id, input.locale, input.versionId);
            await refreshAuthorNames(tx, [version.shared]);
            version.author = version.shared.author;
            return version;
          }),
        );
      },
      plan: async (input) => {
        input = parseBlogInput(blogInputs.historyTarget, input);
        await access(context, "publish", input.id);
        return guard(() =>
          db.transaction(async (tx) => {
            await lock(tx);
            await access(context, "publish", input.id);
            return (await publicationPlan(tx, input)).plan;
          }),
        );
      },
      publish: async (input) => {
        input = parseBlogInput(blogInputs.historyPublish, input);
        assertBlog(typeof input.token === "string" && typeof input.omitMissingImages === "boolean");
        const result = await write(
          context,
          "publish",
          input.id,
          input,
          "history-publish",
          async (tx, editor) => {
            const { article, target, headers, plan } = await publicationPlan(tx, input);
            assertBlog(input.token === plan.token, "CONFLICT");
            assertBlog(
              !plan.missingAssetIds.length || input.omitMissingImages,
              "HISTORY_CONFIRMATION_REQUIRED",
            );
            return commitPublication(
              tx,
              article,
              target,
              headers,
              editor,
              new Date().toISOString(),
              plan.missingAssetIds,
            );
          },
        );
        return get(context, result.id);
      },
      delete: async (input) => {
        input = parseBlogInput(blogInputs.historyMutation, input);
        locale(input.locale);
        const result = await write(
          context,
          "delete",
          input.id,
          input,
          "history-delete",
          async (tx, editor) => {
            const article = await current(tx, input);
            const target = await historyVersion(tx, input.id, input.locale, input.versionId);
            const headers = await historyHeaders(tx, input.id, input.locale);
            const remaining = headers.filter((header) => header.id !== target.id);
            const fallbackId =
              remaining.find((header) => header.state === "draft")?.id ??
              article.translations[input.locale]?.history?.publishedId;
            const fallback = fallbackId
              ? await historyVersion(tx, input.id, input.locale, fallbackId)
              : null;
            const next = deleteBlogVersion(
              article,
              target,
              headers,
              fallback,
              editor,
              new Date().toISOString(),
            );
            await removeHistory(tx, input.id, input.locale, [target.id]);
            return saveRecord(tx, next);
          },
        );
        return get(context, result.id);
      },
    };
  }
  async function upload(context: Context, input: BlogImageInput): Promise<BlogAsset> {
    input = parseBlogInput(blogInputs.image, input);
    assertBlog(
      input.bytes instanceof Uint8Array && input.bytes.length > 0 && input.bytes.length <= maxImage,
    );
    assertBlog(imageType(input.bytes) === input.contentType);
    assertBlog(
      typeof input.name === "string" &&
        input.name.trim() &&
        input.name.length <= 255 &&
        !input.name.split("").some((character) => character.charCodeAt(0) < 32),
    );
    const reserved = await reserve(
      context,
      "upload",
      input.id,
      input.name,
      input.contentType,
      input.bytes.length,
    );
    const descriptor = {
      id: input.id,
      requestId: input.requestId,
      name: input.name,
      contentType: input.contentType,
      hash: createHash("sha256").update(input.bytes).digest("hex"),
    };
    return write(context, "upload", input.id, descriptor, "upload", async (tx) => {
      await metadata(tx, input.id);
      await put(tx, reserved, input.bytes, input.contentType);
      return asset(await object(tx, reserved.id, input.id));
    });
  }
  async function list(context: Context, input: BlogQuery) {
    input = parseBlogInput(blogInputs.query, input);
    await access(context, "read");
    const { page, pageSize, search } = query(input);
    return guard(async () => {
      // Per-record checks prevent a list-level permission from exposing restricted articles.
      // shortcut: host authorization is an arbitrary callback, so admin pagination
      // filters matching metadata in memory; add a typed host visibility predicate when this outgrows memory.
      const records = await db
        .select({ document: articles.document })
        .from(articles)
        .where(
          exists(
            db
              .select({ id: translations.articleId })
              .from(translations)
              .where(
                and(
                  eq(translations.articleId, articles.id),
                  eq(translations.kind, "draft"),
                  ilike(translations.searchText, containsPattern(search)),
                ),
              ),
          ),
        )
        .orderBy(desc(articles.updatedAt), articles.id);
      const allowed: BlogArticle[] = [];
      for (const { document } of records)
        if (await options.authorize(context, "read", document.id)) allowed.push(document);
      const categories = await allCategories(db);
      const visible = allowed.slice((page - 1) * pageSize, page * pageSize);
      await refreshAuthorNames(db, visible.flatMap(authorFields));
      const items = visible.map((document) => articleListItem(document, input.locale, categories));
      return { items, total: allowed.length, page, pageSize };
    });
  }
  async function saveCategory(context: Context, input: BlogCategoryInput) {
    input = parseBlogInput(blogInputs.category, input);
    if (input.id) validId(input.id);
    return write(context, "manageCategories", undefined, input, "category", async (tx) => {
      const categories = await allCategories(tx),
        previous = categories.find((c) => c.id === input.id);
      if (input.id) assertBlog(previous && previous.version === input.version, "CONFLICT");
      if (previous && previous.parentId !== input.parentId) {
        const used = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(arrayContains(articles.categoryIds, [previous.id]))
          .limit(1);
        assertBlog(!used.length, "IN_USE");
      }
      const category: BlogCategory = {
        id: input.id ?? randomUUID(),
        version: (previous?.version ?? 0) + 1,
        parentId: input.parentId,
        translations: validateCategory(input, categories, options.locales),
      };
      await tx
        .insert(categoriesTable)
        .values({ id: category.id, document: category })
        .onConflictDoUpdate({ target: categoriesTable.id, set: { document: category } });
      return category;
    });
  }
  function client(context: Context): BlogsClient {
    return {
      history: historyClient(context),
      list: (input) => list(context, input),
      get: (id) => get(context, id),
      categories: async () => {
        await access(context, "read");
        return guard(() => allCategories(db));
      },
      assets: async (id) => {
        id = parseBlogInput(blogIdSchema, id);
        await access(context, "read", id);
        return guard(async () => {
          await metadata(db, id);
          return (
            await db
              .select()
              .from(objects)
              .where(
                and(
                  eq(objects.articleId, id),
                  eq(objects.kind, "image"),
                  eq(objects.state, "ready"),
                ),
              )
              .orderBy(desc(objects.createdAt))
          ).map(asset);
        });
      },
      create: (input) => create(context, input),
      save: (input) => save(context, input),
      publish: (input) => publish(context, input),
      unpublish: (input) => publish(context, input, true),
      delete: async (input) => {
        input = parseBlogInput(blogInputs.post, input);
        await write(context, "delete", input.id, input, "delete", async (tx) => {
          await current(tx, input);
          await tx.delete(articles).where(eq(articles.id, input.id));
          return { id: input.id };
        });
      },
      upload: async (input) => {
        input = parseBlogInput(blogInputs.file, input);
        assertBlog(input.file.size > 0 && input.file.size <= maxImage);
        return upload(context, {
          id: input.id,
          requestId: input.requestId,
          name: input.file.name,
          contentType: input.file.type,
          bytes: new Uint8Array(await input.file.arrayBuffer()),
        });
      },
      saveCategory: (input) => saveCategory(context, input),
      deleteCategory: async (input) => {
        input = parseBlogInput(blogInputs.post, input);
        validId(input.id);
        await write(
          context,
          "manageCategories",
          undefined,
          input,
          "delete-category",
          async (tx) => {
            const categories = await allCategories(tx),
              category = categories.find((c) => c.id === input.id);
            assertBlog(category, "NOT_FOUND");
            assertBlog(category.version === input.version, "CONFLICT");
            assertBlog(!categories.some((c) => c.parentId === input.id), "IN_USE");
            const used = await tx
              .select({ id: articles.id })
              .from(articles)
              .where(arrayContains(articles.categoryIds, [input.id]))
              .limit(1);
            assertBlog(!used.length, "IN_USE");
            await tx.delete(categoriesTable).where(eq(categoriesTable.id, input.id));
            return { id: input.id };
          },
        );
      },
    };
  }
  async function listPublished(input: BlogPublicQuery) {
    input = parseBlogInput(blogInputs.publicQuery, input);
    const { page, pageSize, search } = query(input);
    if (input.categoryId) validId(input.categoryId);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const visible = and(
          eq(translations.locale, input.locale),
          eq(translations.kind, "publication"),
          isNotNull(translations.publication),
        );
        const filtered = and(
          visible,
          ilike(translations.searchText, containsPattern(search)),
          input.categoryId
            ? arrayContains(translations.categoryIds, [input.categoryId])
            : undefined,
        );
        const [{ total }] = await tx.select({ total: count() }).from(translations).where(filtered);
        const selected = await tx
          .select({ id: translations.articleId, publication: translations.publication })
          .from(translations)
          .where(filtered)
          .orderBy(desc(translations.publishedAt), translations.articleId)
          .limit(pageSize)
          .offset((page - 1) * pageSize);
        const documents = selected.map((row) => {
          assertBlog(row.publication, "STORAGE");
          return { ...row, publication: row.publication };
        });
        const counts = await tx
          .select({ id: publicationCategories.categoryId, count: count() })
          .from(publicationCategories)
          .where(eq(publicationCategories.locale, input.locale))
          .groupBy(publicationCategories.categoryId);
        await refreshAuthorNames(
          tx,
          documents.map((row) => row.publication.shared),
        );
        const items = documents.map((row) => {
          const { markdown: _markdown, ...publication } = row.publication;
          return { ...publication, id: row.id, locale: input.locale };
        });
        return {
          items,
          total,
          page,
          pageSize,
          categoryCounts: Object.fromEntries(counts.map((c) => [c.id, c.count])),
        };
      }),
    );
  }
  async function getPublished(l: string, slug: string): Promise<BlogPost | null> {
    l = parseBlogInput(z.string(), l);
    slug = parseBlogInput(z.string().max(120), slug);
    locale(l);
    assertBlog(typeof slug === "string" && slug.length <= 120);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const [row] = await tx
          .select({ id: translations.articleId, publication: translations.publication })
          .from(translations)
          .where(
            and(
              eq(translations.locale, l),
              eq(translations.kind, "publication"),
              eq(translations.slug, slug),
            ),
          )
          .limit(1);
        if (row) {
          assertBlog(row.publication, "STORAGE");
          await refreshAuthorNames(tx, [row.publication.shared]);
        }
        return row?.publication
          ? {
              ...row.publication,
              id: row.id,
              locale: l,
            }
          : null;
      }),
    );
  }
  async function readImage(id: string, context?: Context) {
    id = parseBlogInput(blogIdSchema, id);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const [record] = await tx
          .select()
          .from(objects)
          .where(and(eq(objects.id, id), eq(objects.kind, "image"), eq(objects.state, "ready")));
        assertBlog(record, "NOT_FOUND");
        const document = await metadata(tx, record.articleId);
        const visible = Object.values(document.translations).some((t) =>
          t.published?.assetIds.includes(id),
        );
        if (!visible) {
          assertBlog(context !== undefined, "NOT_FOUND");
          await access(context, "read", record.articleId);
        }
        assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
        const result = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: scopedKey(record.key) }),
          {
            abortSignal: AbortSignal.timeout(30000),
          },
        );
        assertBlog(
          result.Body && result.ContentLength === record.size && record.size <= maxImage,
          "STORAGE",
        );
        const bytes = await result.Body.transformToByteArray();
        assertBlog(
          bytes.length === record.size && imageType(bytes) === record.contentType,
          "STORAGE",
        );
        return {
          bytes,
          contentType: record.contentType,
          cacheControl: "no-store",
          contentDisposition: "inline",
          nosniff: true,
        };
      }),
    );
  }
  /** Trusted server scheduler only. A 24-hour grace period lets authors attach new uploads. */
  async function maintenance(limit = 100) {
    limit = parseBlogInput(z.number().int().min(1).max(1000), limit);
    assertBlog(s3 && bucket, "STORAGE_NOT_CONFIGURED");
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        await verifyBucket();
        const candidates = await tx
          .select()
          .from(objects)
          .where(
            and(eq(objects.kind, "image"), lt(objects.createdAt, new Date(Date.now() - 86400000))),
          )
          .orderBy(objects.checkedAt, objects.id)
          .limit(limit);
        let removed = 0;
        const failed: string[] = [];
        for (const candidate of candidates) {
          await tx
            .update(objects)
            .set({ checkedAt: new Date() })
            .where(eq(objects.id, candidate.id));
          const [row] = await tx
            .select({ document: articles.document })
            .from(articles)
            .where(eq(articles.id, candidate.articleId));
          if (row && references(row.document).has(candidate.id)) continue;
          const retained = await tx
            .select({ id: historyTable.id })
            .from(historyTable)
            .where(
              and(
                eq(historyTable.articleId, candidate.articleId),
                arrayContains(historyTable.assetIds, [candidate.id]),
              ),
            )
            .limit(1);
          if (retained.length) continue;
          try {
            await s3.send(
              new DeleteObjectCommand({ Bucket: bucket, Key: scopedKey(candidate.key) }),
              {
                abortSignal: AbortSignal.timeout(30000),
              },
            );
          } catch {
            failed.push(candidate.id);
            continue;
          }
          await tx.delete(objects).where(eq(objects.id, candidate.id));
          removed++;
        }
        return { examined: candidates.length, removed, failed };
      }),
    );
  }
  return {
    client,
    preflight,
    upload,
    listPublished,
    getPublished,
    snapshotAuthorName,
    backfillHistory,
    publicCategories: () => guard(() => allCategories(db)),
    readImage,
    maintenance,
  };
}

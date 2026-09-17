import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { sql } from "drizzle-orm";

import {
  createArticle,
  publishArticle,
  saveArticle,
  unpublishArticle,
  validateCategory,
} from "@/components/plugins/blogs/model";
import type {
  BlogImageInput,
  BlogsPermission,
  BlogsStorageOptions,
  BlogsTransaction,
} from "@/components/plugins/blogs/server/types";
import type {
  BlogArticle,
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
} from "@/components/plugins/blogs/types";
import {
  articleListItem,
  assertBlog,
  BlogsError,
  imageType,
  MAX_IMAGE_BYTES,
  MAX_MARKDOWN_BYTES,
  validId,
} from "@/components/plugins/blogs/utils";

type StoredArticle = Omit<BlogArticle, "translations"> & {
  translations: Record<
    string,
    {
      draft: Omit<BlogArticle["translations"][string]["draft"], "markdown">;
      published: Omit<
        NonNullable<BlogArticle["translations"][string]["published"]>,
        "markdown"
      > | null;
    }
  >;
};
type ObjectRow = {
  id: string;
  article_id: string;
  key: string;
  kind: string;
  name: string;
  content_type: string;
  size: number;
  state: string;
};
function stored(article: BlogArticle): StoredArticle {
  return {
    ...article,
    translations: Object.fromEntries(
      Object.entries(article.translations).map(([locale, t]) => {
        const { markdown: _draft, ...draft } = t.draft;
        if (!t.published) return [locale, { draft, published: null }];
        const { markdown: _published, ...published } = t.published;
        return [locale, { draft, published }];
      }),
    ),
  };
}
async function rows<T>(tx: BlogsTransaction, query: ReturnType<typeof sql>) {
  return (await tx.execute(query)) as unknown as T[];
}
function references(article: StoredArticle) {
  const refs = new Set(
    [article.shared.thumbnailId, article.shared.bannerId].filter((v): v is string => Boolean(v)),
  );
  for (const t of Object.values(article.translations))
    for (const revision of [t.draft, t.published])
      if (revision) {
        if (revision.revisionId) refs.add(revision.revisionId);
        for (const id of revision.assetIds) refs.add(id);
      }
  return refs;
}
const asset = (row: ObjectRow): BlogAsset => ({
  id: row.id,
  postId: row.article_id,
  name: row.name,
  size: row.size,
  contentType: row.content_type,
});

export function createBlogsStorage<Context>(options: BlogsStorageOptions<Context>) {
  const { db, s3, bucket } = options;
  const prefix = options.keyPrefix ?? "blogs/";
  const maxImage = options.maxImageBytes ?? MAX_IMAGE_BYTES;
  const maxMarkdown = options.maxMarkdownBytes ?? MAX_MARKDOWN_BYTES;
  let bucketVerified: Promise<void> | undefined;
  function verifyBucket() {
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
  assertBlog(bucket && /^[\w/-]+\/$/.test(prefix) && !prefix.includes(".."));
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
      return await action();
    } catch (error) {
      if (error instanceof BlogsError) throw error;
      if (error && typeof error === "object" && "code" in error && error.code === "23505")
        throw new BlogsError("CONFLICT");
      throw new BlogsError("STORAGE");
    }
  }
  // ponytail: serialize blog writes and maintenance per database; use per-article locks
  // plus transactional taxonomy/slug indexes if a host needs high write throughput.
  async function lock(tx: BlogsTransaction) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('forge-blogs'))`);
  }
  async function metadata(tx: BlogsTransaction, id: string) {
    const [row] = await rows<{ document: StoredArticle }>(
      tx,
      sql`select document from blogs_article where id=${id}`,
    );
    assertBlog(row, "NOT_FOUND");
    return row.document;
  }
  async function allCategories(tx: BlogsTransaction) {
    return (
      await rows<{ document: BlogCategory }>(
        tx,
        sql`select document from blogs_category order by id`,
      )
    ).map((r) => r.document);
  }
  async function object(tx: BlogsTransaction, id: string, articleId: string) {
    const [row] = await rows<ObjectRow>(
      tx,
      sql`select * from blogs_object where id=${id} and article_id=${articleId} and state='ready'`,
    );
    assertBlog(row, "NOT_FOUND");
    return row;
  }
  async function markdown(tx: BlogsTransaction, id: string | null, articleId: string) {
    if (!id) return "";
    const record = await object(tx, id, articleId);
    assertBlog(record.kind === "markdown" && record.size <= maxMarkdown);
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: record.key }), {
      abortSignal: AbortSignal.timeout(30000),
    });
    assertBlog(result.ContentLength === record.size && result.Body, "STORAGE");
    const bytes = await result.Body.transformToByteArray();
    assertBlog(bytes.length === record.size && bytes.length <= maxMarkdown, "STORAGE");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  async function hydrate(tx: BlogsTransaction, document: StoredArticle): Promise<BlogArticle> {
    const sources = new Map<string, Promise<string>>();
    function source(id: string | null) {
      if (!id) return Promise.resolve("");
      if (!sources.has(id)) sources.set(id, markdown(tx, id, document.id));
      return sources.get(id)!;
    }
    const translations = await Promise.all(
      Object.entries(document.translations).map(
        async ([l, t]) =>
          [
            l,
            {
              draft: { ...t.draft, markdown: await source(t.draft.revisionId) },
              published: t.published
                ? { ...t.published, markdown: await source(t.published.revisionId) }
                : null,
            },
          ] as const,
      ),
    );
    return { ...document, translations: Object.fromEntries(translations) };
  }
  async function get(context: Context, id: string) {
    await access(context, "read", id);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        return hydrate(tx, await metadata(tx, id));
      }),
    );
  }
  async function reserve(
    context: Context,
    permission: BlogsPermission,
    articleId: string,
    kind: "image" | "markdown",
    name: string,
    contentType: string,
    size: number,
  ) {
    await access(context, permission, articleId);
    const id = randomUUID(),
      key = `${prefix}${articleId}/${id}/${kind === "markdown" ? "README.md" : "image"}`;
    await guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        await access(context, permission, articleId);
        await metadata(tx, articleId);
        await tx.execute(
          sql`insert into blogs_object (id,article_id,key,kind,name,content_type,size,state) values (${id},${articleId},${key},${kind},${name},${contentType},${size},'pending')`,
        );
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
    await verifyBucket();
    const [pending] = await rows<{ id: string }>(
      tx,
      sql`select id from blogs_object where id=${reserved.id} and state='pending'`,
    );
    assertBlog(pending, "CONFLICT");
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: reserved.key,
        Body: bytes,
        ContentType: contentType,
        ContentLength: bytes.length,
        IfNoneMatch: "*",
      }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
    await tx.execute(sql`update blogs_object set state='ready' where id=${reserved.id}`);
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
        const [previous] = await rows<{ actor_id: string; fingerprint: string; result: T }>(
          tx,
          sql`select * from blogs_mutation where id=${input.requestId}`,
        );
        if (previous) {
          assertBlog(
            previous.actor_id === editor.id && previous.fingerprint === fingerprint,
            "CONFLICT",
          );
          return previous.result;
        }
        const result = await action(tx, { id: editor.id, name: editor.name });
        await tx.execute(
          sql`insert into blogs_mutation (id,actor_id,fingerprint,result) values (${input.requestId},${editor.id},${fingerprint},${JSON.stringify(result)}::jsonb)`,
        );
        return result;
      }),
    );
  }
  async function current(tx: BlogsTransaction, input: BlogPostMutation) {
    assertBlog(Number.isSafeInteger(input.version) && input.version >= 1);
    const article = await metadata(tx, input.id);
    assertBlog(article.version === input.version, "CONFLICT");
    return hydrate(tx, article);
  }
  async function saveRecord(tx: BlogsTransaction, article: BlogArticle) {
    await tx.execute(
      sql`update blogs_article set document=${JSON.stringify(stored(article))}::jsonb,version=${article.version},updated_at=${article.updatedAt} where id=${article.id}`,
    );
    return { id: article.id };
  }
  async function uniqueSlug(tx: BlogsTransaction, id: string, l: string, slug: string) {
    if (!slug) return;
    const existing = await rows<{ id: string }>(
      tx,
      sql`select id from blogs_article where id<>${id} and (document->'translations'->${l}->'draft'->>'slug'=${slug} or document->'translations'->${l}->'published'->>'slug'=${slug}) limit 1`,
    );
    assertBlog(!existing.length, "CONFLICT");
  }
  async function create(context: Context, input: BlogMutation & { title: string; locale: string }) {
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
        await tx.execute(
          sql`insert into blogs_article (id,version,document,updated_at) values (${id},1,${JSON.stringify(stored(article))}::jsonb,${now})`,
        );
        return { id };
      },
    );
    return get(context, result.id);
  }
  async function save(context: Context, input: BlogSaveInput) {
    locale(input.locale);
    assertBlog(input.content && typeof input.content.markdown === "string");
    const bytes = new TextEncoder().encode(input.content.markdown);
    assertBlog(bytes.length <= maxMarkdown);
    const reserved = await reserve(
      context,
      "edit",
      input.id,
      "markdown",
      "README.md",
      "text/markdown; charset=utf-8",
      bytes.length,
    );
    const result = await write(context, "edit", input.id, input, "save", async (tx, editor) => {
      const article = await current(tx, input),
        categories = await allCategories(tx);
      const images = await rows<{ id: string }>(
        tx,
        sql`select id from blogs_object where article_id=${input.id} and kind='image' and state='ready'`,
      );
      const next = saveArticle(
        article,
        input,
        categories,
        new Set(images.map((i) => i.id)),
        reserved.id,
        editor,
        new Date().toISOString(),
        maxMarkdown,
      );
      await uniqueSlug(tx, input.id, input.locale, next.translations[input.locale].draft.slug);
      await put(tx, reserved, bytes, "text/markdown; charset=utf-8");
      return saveRecord(tx, next);
    });
    return get(context, result.id);
  }
  async function publish(context: Context, input: BlogPublishInput, remove = false) {
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
        const next = publishArticle(
          article,
          input.locale,
          await allCategories(tx),
          editor,
          now,
          maxMarkdown,
        );
        const publication = next.translations[input.locale].published!;
        for (const id of publication.assetIds) {
          const record = await object(tx, id, input.id);
          assertBlog(record.kind === "image");
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: record.key }), {
            abortSignal: AbortSignal.timeout(30000),
          });
          assertBlog(
            head.ContentLength === record.size && head.ContentType === record.content_type,
            "STORAGE",
          );
        }
        await uniqueSlug(tx, input.id, input.locale, publication.slug);
        return saveRecord(tx, next);
      },
    );
    return get(context, result.id);
  }
  async function upload(context: Context, input: BlogImageInput): Promise<BlogAsset> {
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
      "image",
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
    await access(context, "read");
    const { page, pageSize, search } = query(input);
    return guard(async () => {
      // Per-record checks prevent a list-level permission from exposing restricted articles.
      // ponytail: host authorization is an arbitrary callback, so admin pagination
      // filters matching metadata in memory; inject a SQL visibility predicate at scale.
      const records = await rows<{ document: StoredArticle }>(
        db,
        sql`select document from blogs_article where exists (select 1 from jsonb_each(document->'translations') t where position(lower(${search}) in lower(coalesce(t.value->'draft'->>'title','') || ' ' || coalesce(t.value->'draft'->>'summary',''))) > 0) order by updated_at desc,id`,
      );
      const allowed: StoredArticle[] = [];
      for (const { document } of records)
        if (await options.authorize(context, "read", document.id)) allowed.push(document);
      const items = allowed.slice((page - 1) * pageSize, page * pageSize).map((document) =>
        articleListItem(
          {
            ...document,
            translations: Object.fromEntries(
              Object.entries(document.translations).map(([l, t]) => [
                l,
                {
                  draft: { ...t.draft, markdown: "" },
                  published: t.published ? { ...t.published, markdown: "" } : null,
                },
              ]),
            ),
          },
          input.locale,
        ),
      );
      return { items, total: allowed.length, page, pageSize };
    });
  }
  async function saveCategory(context: Context, input: BlogCategoryInput) {
    if (input.id) validId(input.id);
    return write(context, "manageCategories", undefined, input, "category", async (tx) => {
      const categories = await allCategories(tx),
        previous = categories.find((c) => c.id === input.id);
      if (input.id) assertBlog(previous && previous.version === input.version, "CONFLICT");
      if (previous && previous.parentId !== input.parentId) {
        const used = await rows<{ id: string }>(
          tx,
          sql`select id from blogs_article where document::text like ${`%${previous.id}%`} limit 1`,
        );
        assertBlog(!used.length, "IN_USE");
      }
      const category: BlogCategory = {
        id: input.id ?? randomUUID(),
        version: (previous?.version ?? 0) + 1,
        parentId: input.parentId,
        translations: validateCategory(input, categories, options.locales),
      };
      await tx.execute(
        sql`insert into blogs_category (id,document) values (${category.id},${JSON.stringify(category)}::jsonb) on conflict(id) do update set document=excluded.document`,
      );
      return category;
    });
  }
  function client(context: Context): BlogsClient {
    return {
      list: (input) => list(context, input),
      get: (id) => get(context, id),
      categories: async () => {
        await access(context, "read");
        return guard(() => allCategories(db));
      },
      assets: async (id) => {
        await access(context, "read", id);
        return guard(async () => {
          await metadata(db, id);
          return (
            await rows<ObjectRow>(
              db,
              sql`select * from blogs_object where article_id=${id} and kind='image' and state='ready' order by created_at desc`,
            )
          ).map(asset);
        });
      },
      create: (input) => create(context, input),
      save: (input) => save(context, input),
      publish: (input) => publish(context, input),
      unpublish: (input) => publish(context, input, true),
      delete: async (input) => {
        await write(context, "delete", input.id, input, "delete", async (tx) => {
          await current(tx, input);
          await tx.execute(sql`delete from blogs_article where id=${input.id}`);
          return { id: input.id };
        });
      },
      upload: async (input) => {
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
            const used = await rows<{ id: string }>(
              tx,
              sql`select id from blogs_article where document::text like ${`%${input.id}%`} limit 1`,
            );
            assertBlog(!used.length, "IN_USE");
            await tx.execute(sql`delete from blogs_category where id=${input.id}`);
            return { id: input.id };
          },
        );
      },
    };
  }
  async function listPublished(input: BlogPublicQuery) {
    const { page, pageSize, search } = query(input);
    if (input.categoryId) validId(input.categoryId);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const published = sql`document->'translations'->${input.locale}->'published'`;
        const visible = sql`${published} is not null and ${published}<>'null'::jsonb`;
        const filtered = sql`${visible} and position(lower(${search}) in lower((${published}->>'title') || ' ' || (${published}->>'summary'))) > 0 ${input.categoryId ? sql`and ${published}->'shared'->'categoryIds' @> ${JSON.stringify([input.categoryId])}::jsonb` : sql``}`;
        const [{ total }] = await rows<{ total: number }>(
          tx,
          sql`select count(*)::int as total from blogs_article where ${filtered}`,
        );
        const documents = await rows<{
          id: string;
          publication: NonNullable<StoredArticle["translations"][string]["published"]>;
        }>(
          tx,
          sql`select id,${published} as publication from blogs_article where ${filtered} order by ${published}->>'publishedAt' desc,id limit ${pageSize} offset ${(page - 1) * pageSize}`,
        );
        const counts = await rows<{ id: string; count: number }>(
          tx,
          sql`select category.id,count(*)::int as count from blogs_article cross join lateral jsonb_array_elements_text(${published}->'shared'->'categoryIds') as category(id) where ${visible} group by category.id`,
        );
        const items = documents.map((row) => ({
          ...row.publication,
          id: row.id,
          locale: input.locale,
        }));
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
    locale(l);
    assertBlog(typeof slug === "string" && slug.length <= 120);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const [row] = await rows<{
          id: string;
          publication: NonNullable<StoredArticle["translations"][string]["published"]>;
        }>(
          tx,
          sql`select id,document->'translations'->${l}->'published' as publication from blogs_article where document->'translations'->${l}->'published'->>'slug'=${slug} limit 1`,
        );
        return row
          ? {
              ...row.publication,
              id: row.id,
              locale: l,
              markdown: await markdown(tx, row.publication.revisionId, row.id),
            }
          : null;
      }),
    );
  }
  async function readImage(id: string, context?: Context) {
    validId(id);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        const [record] = await rows<ObjectRow>(
          tx,
          sql`select * from blogs_object where id=${id} and kind='image' and state='ready'`,
        );
        assertBlog(record, "NOT_FOUND");
        const document = await metadata(tx, record.article_id);
        const visible = Object.values(document.translations).some((t) =>
          t.published?.assetIds.includes(id),
        );
        if (!visible) {
          assertBlog(context !== undefined, "NOT_FOUND");
          await access(context, "read", record.article_id);
        }
        const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: record.key }), {
          abortSignal: AbortSignal.timeout(30000),
        });
        assertBlog(
          result.Body && result.ContentLength === record.size && record.size <= maxImage,
          "STORAGE",
        );
        const bytes = await result.Body.transformToByteArray();
        assertBlog(
          bytes.length === record.size && imageType(bytes) === record.content_type,
          "STORAGE",
        );
        return {
          bytes,
          contentType: record.content_type,
          cacheControl: "no-store",
          contentDisposition: "inline",
          nosniff: true,
        };
      }),
    );
  }
  /** Trusted server scheduler only. A 24-hour grace period lets authors attach new uploads. */
  async function maintenance(limit = 100) {
    assertBlog(Number.isSafeInteger(limit) && limit > 0 && limit <= 1000);
    return guard(() =>
      db.transaction(async (tx) => {
        await lock(tx);
        await verifyBucket();
        const candidates = await rows<ObjectRow>(
          tx,
          sql`select * from blogs_object where created_at < now()-interval '24 hours' order by checked_at,id limit ${limit}`,
        );
        let removed = 0;
        const failed: string[] = [];
        for (const candidate of candidates) {
          await tx.execute(
            sql`update blogs_object set checked_at=clock_timestamp() where id=${candidate.id}`,
          );
          const [row] = await rows<{ document: StoredArticle }>(
            tx,
            sql`select document from blogs_article where id=${candidate.article_id}`,
          );
          if (row && references(row.document).has(candidate.id)) continue;
          try {
            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: candidate.key }), {
              abortSignal: AbortSignal.timeout(30000),
            });
          } catch {
            failed.push(candidate.id);
            continue;
          }
          await tx.execute(sql`delete from blogs_object where id=${candidate.id}`);
          removed++;
        }
        return { examined: candidates.length, removed, failed };
      }),
    );
  }
  return {
    client,
    upload,
    listPublished,
    getPublished,
    publicCategories: () => guard(() => allCategories(db)),
    readImage,
    maintenance,
  };
}

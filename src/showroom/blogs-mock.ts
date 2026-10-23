import type {
  BlogArticle,
  BlogAsset,
  BlogCategory,
  BlogEditor,
  BlogsClient,
  BlogHistoryVersion,
  BlogHistoryTarget,
  BlogHistoryPlan,
} from "@/components/plugins/blogs";
import {
  createArticle,
  sameBlogInputs,
  recordBlogSave,
  publishBlogVersion,
  deleteBlogVersion,
  blogPublicationDiscard,
  publishArticle,
  saveArticle,
  unpublishArticle,
  validateCategory,
} from "@/components/plugins/blogs/model";
import { canAccessBlog } from "@/components/plugins/blogs/permissions";
import {
  articleListItem,
  assertBlog,
  emptyContent,
  imageType,
  MAX_IMAGE_BYTES,
  publicPosts,
  slugify,
} from "@/components/plugins/blogs/utils";

export const blogLocales = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];
const key = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const initialEditor = { id: "jordan", name: "Jordan Lee" };
const date = "2026-09-10T10:00:00.000Z";
function seed() {
  const categories: BlogCategory[] = [
    {
      id: key(10),
      version: 1,
      parentId: null,
      translations: {
        en: { name: "Ideas & practice", slug: "ideas-practice" },
        fr: { name: "Idées et pratique", slug: "idees-pratique" },
      },
    },
    {
      id: key(11),
      version: 1,
      parentId: key(10),
      translations: {
        en: { name: "Design", slug: "design" },
        fr: { name: "Design", slug: "design" },
      },
    },
    {
      id: key(12),
      version: 1,
      parentId: null,
      translations: {
        en: { name: "Inside the studio", slug: "studio" },
        fr: { name: "Au studio", slug: "studio" },
      },
    },
  ];
  const assets: BlogAsset[] = [
    { name: "the_corner-illustration_lightbulb.webp", postId: key(1) },
    { name: "the_corner-illustration_coffee-mug.webp", postId: key(2) },
    { name: "the_corner-illustration_plant-rounded.webp", postId: key(3) },
    { name: "the_corner-illustration_pencil-cup.webp", postId: key(1) },
    { name: "the_corner-illustration_desk-lamp.webp", postId: key(2) },
    { name: "the_corner-illustration_plant-tall.webp", postId: key(3) },
  ].map((asset, index) => ({
    ...asset,
    id: key(101 + index),
    contentType: "image/webp",
    size: 1024,
  }));
  const articles = [
    {
      title: "Make room for better ideas",
      thumbnailAlt: "Hand-drawn lightbulb with radiating lines",
      bannerAlt: "Hand-drawn cup holding four pencils",
      summary: "A little space, a slower pace, and the habits that help thoughtful work happen.",
      markdown:
        "## Begin with a question\n\nGood ideas often start with **paying attention**. Before opening another tool, take a moment to describe the problem in plain language.\n\n> A useful question is often more valuable than a quick answer.\n\n## A small practice\n\n- Write down what you notice.\n- Talk with someone who sees things differently.\n- Make something small and learn from it.\n\n![Hand-drawn lightbulb with radiating lines](./assets/" +
        key(101) +
        ")\n\n### Keep it simple\n\nLeave room for what comes next.",
    },
    {
      title: "A quieter kind of productivity",
      thumbnailAlt: "Hand-drawn coffee mug",
      bannerAlt: "Hand-drawn adjustable desk lamp",
      summary: "Building routines that leave room for focus, curiosity, and the unexpected.",
      markdown:
        "## Protect your attention\n\nStart with one meaningful task. Leave the rest for later.\n\n### What helps\n\n1. Clear priorities\n2. Space between meetings\n3. Time to reflect",
    },
    {
      title: "Notes from our workbench",
      thumbnailAlt: "Hand-drawn potted plant with rounded leaves",
      bannerAlt: "Hand-drawn tall potted plant with pointed leaves",
      summary: "An open look at the materials, experiments, and conversations behind our work.",
      markdown:
        "## Work in progress\n\nThe best part of a studio is the work you cannot see in a finished photograph.\n\n| Practice | Purpose |\n| --- | --- |\n| Sketching | Explore possibilities |\n| Prototyping | Learn by making |",
    },
  ].map((content, index) => {
    const n = index + 1,
      id = key(n),
      image = key(100 + n),
      banner = key(103 + n);
    let article = createArticle(id, content.title, "en", initialEditor, date);
    article = saveArticle(
      article,
      {
        id,
        version: 1,
        requestId: key(200 + n),
        locale: "en",
        content: {
          ...emptyContent,
          ...content,
          slug: slugify(content.title),
        },
        shared: {
          thumbnailId: image,
          bannerId: banner,
          categoryIds: [index === 2 ? key(12) : key(11)],
        },
      },
      categories,
      new Set([image, banner]),
      key(300 + n),
      initialEditor,
      date,
    );
    return publishArticle(article, "en", categories, initialEditor, date);
  });
  let first = articles[0];
  first = saveArticle(
    first,
    {
      id: first.id,
      version: first.version,
      requestId: key(400),
      locale: "fr",
      shared: first.shared,
      content: {
        ...emptyContent,
        title: "Faire de la place aux idées",
        slug: "faire-place-idees",
        summary: "Du temps, de l’espace et quelques habitudes pour mieux créer.",
        markdown:
          "## Commencer par une question\n\nLes bonnes idées commencent par **l’attention**. Prenez le temps de décrire le problème simplement.\n\n> Une question utile vaut parfois mieux qu’une réponse rapide.",
        thumbnailAlt: "Une ampoule dessinée à la main avec des rayons",
        bannerAlt: "Un pot contenant quatre crayons dessinés à la main",
      },
    },
    categories,
    new Set([key(101), key(104)]),
    key(401),
    initialEditor,
    date,
  );
  articles[0] = publishArticle(first, "fr", categories, initialEditor, date);
  const legacy = createArticle(key(4), "An idea for tomorrow", "en", initialEditor, date);
  delete legacy.shared.author;
  articles.push(legacy);
  return { articles, categories, assets };
}
export function createBlogsMock() {
  const initial = seed();
  const versions = new Map<string, BlogHistoryVersion[]>();
  for (const article of initial.articles) {
    const retained: BlogHistoryVersion[] = [];
    for (const [locale, translation] of Object.entries(article.translations)) {
      const state = {
        lastNumber: 0,
        lastPublicationOrder: 0,
        currentId: null as string | null,
        publishedId: null as string | null,
      };
      const capture = (published: boolean) => {
        const content = published ? translation.published! : translation.draft;
        const shared = published
          ? translation.published!.shared
          : (translation.shared ?? article.shared);
        const id = crypto.randomUUID();
        retained.push({
          id,
          number: ++state.lastNumber,
          locale,
          state: published ? "publication" : "draft",
          savedAt: content.updatedAt,
          savedBy: content.editor,
          author: shared.author,
          repriseId: published ? null : id,
          sourcePublicationId: state.publishedId,
          sourcePublicationOrder: state.lastPublicationOrder || null,
          publicationOrder: published ? ++state.lastPublicationOrder : null,
          publishedAt: published ? translation.published!.publishedAt : null,
          omittedAssetIds: [],
          content: structuredClone(content),
          shared: structuredClone(shared),
        });
        state.currentId = id;
        if (published) state.publishedId = id;
      };
      if (translation.published) capture(true);
      if (
        !translation.published ||
        !sameBlogInputs(
          { content: translation.draft, shared: translation.shared ?? article.shared },
          { content: translation.published, shared: translation.published.shared },
        )
      )
        capture(false);
      translation.history = state;
      translation.shared ??= structuredClone(article.shared);
    }
    versions.set(article.id, retained);
  }
  let articles = initial.articles,
    categories = initial.categories,
    assets = initial.assets,
    revision = 0;
  const urls = new Map(
    initial.assets.map((a) => [a.id, `https://assets.the-corner.io/images/${a.name}`]),
  );
  const listeners = new Set<() => void>();
  const requests = new Map<string, { fingerprint: string; result: unknown }>();
  const emit = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  const get = (id: string) => {
    const value = articles.find((a) => a.id === id);
    assertBlog(value, "NOT_FOUND");
    return structuredClone(value);
  };
  function client(config: {
    editor: BlogEditor;
    admin?: boolean;
    readOnly: boolean;
    fail: boolean;
    failUpload: boolean;
    consumeUploadFailure: () => void;
    missingImages?: boolean;
  }): BlogsClient {
    async function mutate<T>(
      name: string,
      input: { requestId: string; id?: string },
      run: () => T | Promise<T>,
    ): Promise<T> {
      assertBlog(!config.readOnly, "FORBIDDEN");
      const article = input.id && !name.includes("category") ? get(input.id) : undefined;
      const permission =
        name === "save"
          ? "edit"
          : name === "unpublish"
            ? "publish"
            : name.includes("category")
              ? "manageCategories"
              : (name as "create" | "publish" | "delete" | "upload");
      assertBlog(
        canAccessBlog(
          { id: config.editor.id, admin: config.admin ?? true },
          permission,
          article?.shared.author?.id,
        ),
        "FORBIDDEN",
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      assertBlog(!config.fail, "STORAGE");
      const fingerprint = JSON.stringify([name, config.editor.id, input]),
        previous = requests.get(input.requestId);
      if (previous) {
        assertBlog(previous.fingerprint === fingerprint, "CONFLICT");
        return structuredClone(previous.result) as T;
      }
      const result = await run();
      requests.set(input.requestId, { fingerprint, result: structuredClone(result) });
      emit();
      return structuredClone(result);
    }
    function current(input: { id: string; version: number }) {
      const article = get(input.id);
      assertBlog(article.version === input.version, "CONFLICT");
      return article;
    }
    function replace(article: BlogArticle) {
      articles = articles.map((a) => (a.id === article.id ? article : a));
      return article;
    }
    function unique(article: BlogArticle, locale: string) {
      const slug = article.translations[locale]?.draft.slug;
      assertBlog(
        !slug ||
          !articles.some(
            (a) =>
              a.id !== article.id &&
              (a.translations[locale]?.draft.slug === slug ||
                a.translations[locale]?.published?.slug === slug),
          ),
        "CONFLICT",
      );
    }
    function historyVersion(input: { id: string; locale: string; versionId: string }) {
      const version = versions
        .get(input.id)
        ?.find((value) => value.id === input.versionId && value.locale === input.locale);
      assertBlog(version, "NOT_FOUND");
      return version;
    }
    function historyHeaders(id: string, locale: string) {
      return (versions.get(id) ?? [])
        .filter((version) => version.locale === locale)
        .map(({ content: _content, shared: _shared, ...header }) => structuredClone(header));
    }
    function plan(input: BlogHistoryTarget): BlogHistoryPlan {
      input = {
        id: input.id,
        version: input.version,
        locale: input.locale,
        versionId: input.versionId,
      };
      const article = current(input);
      const version = historyVersion(input);
      assertBlog(version.shared.author, "AUTHOR_REQUIRED");
      const result = blogPublicationDiscard(version, historyHeaders(input.id, input.locale));
      const missingAssetIds = config.missingImages
        ? [
            ...new Set(
              [
                ...version.content.assetIds,
                version.shared.thumbnailId,
                version.shared.bannerId,
              ].filter((id): id is string => !!id),
            ),
          ]
        : [];
      return {
        target: input,
        ...result,
        missingAssetIds,
        token: JSON.stringify([
          article.version,
          input,
          result.discarded.map((header) => header.id),
          missingAssetIds,
        ]),
      };
    }
    function publishVersion(input: BlogHistoryTarget, missingAssetIds: string[] = []) {
      const result = publishBlogVersion(
        current(input),
        historyVersion(input),
        historyHeaders(input.id, input.locale),
        categories,
        config.editor,
        new Date().toISOString(),
        missingAssetIds,
      );
      unique(result.article, input.locale);
      versions.set(input.id, [
        ...(versions.get(input.id) ?? []).filter(
          (version) =>
            version.id !== result.saved.id &&
            !result.discarded.some((header) => header.id === version.id),
        ),
        result.saved,
      ]);
      return replace(result.article);
    }
    function readHistory(id: string) {
      assertBlog(!config.readOnly && !config.fail, config.readOnly ? "FORBIDDEN" : "STORAGE");
      get(id);
    }
    return {
      history: {
        list: async (input) => {
          readHistory(input.id);
          return historyHeaders(input.id, input.locale);
        },
        get: async (input) => {
          readHistory(input.id);
          return structuredClone(historyVersion(input));
        },
        plan: async (input) => {
          readHistory(input.id);
          assertBlog(
            canAccessBlog(
              { id: config.editor.id, admin: config.admin ?? true },
              "publish",
              get(input.id).shared.author?.id,
            ),
            "FORBIDDEN",
          );
          return plan(input);
        },
        publish: (input) =>
          mutate("publish", input, () => {
            const latest = plan(input);
            assertBlog(latest.token === input.token, "CONFLICT");
            assertBlog(!latest.missingAssetIds.length || input.omitMissingImages, "INVALID");
            return publishVersion(input, latest.missingAssetIds);
          }),
        delete: (input) =>
          mutate("delete", input, () => {
            const article = current(input),
              target = historyVersion(input),
              headers = historyHeaders(input.id, input.locale);
            const fallbackId =
              headers
                .filter((header) => header.state === "draft" && header.id !== target.id)
                .sort((a, b) => b.number - a.number)[0]?.id ??
              article.translations[input.locale].history?.publishedId;
            const fallback = fallbackId
              ? historyVersion({ ...input, versionId: fallbackId })
              : null;
            const result = deleteBlogVersion(
              article,
              target,
              headers,
              fallback,
              config.editor,
              new Date().toISOString(),
            );
            versions.set(
              input.id,
              (versions.get(input.id) ?? []).filter((version) => version.id !== target.id),
            );
            return replace(result);
          }),
      },
      list: async (q) => {
        assertBlog(!config.fail, "STORAGE");
        const filtered = articles.filter((a) =>
          Object.values(a.translations).some((t) =>
            t.draft.title.toLowerCase().includes((q.search ?? "").toLowerCase()),
          ),
        );
        const page = q.page ?? 1,
          pageSize = q.pageSize ?? 12;
        return {
          items: filtered
            .slice((page - 1) * pageSize, page * pageSize)
            .map((a) => articleListItem(a, q.locale, categories)),
          total: filtered.length,
          page,
          pageSize,
        };
      },
      get: async (id) => get(id),
      categories: async () => structuredClone(categories),
      assets: async (id) => structuredClone(assets.filter((a) => a.postId === id)),
      create: (input) =>
        mutate("create", input, () => {
          const article = createArticle(
            crypto.randomUUID(),
            input.title,
            input.locale,
            config.editor,
            new Date().toISOString(),
          );
          if (!article.translations[input.locale].draft.slug)
            article.translations[input.locale].draft.slug = `post-${article.id.slice(0, 8)}`;
          unique(article, input.locale);
          articles = [article, ...articles];
          return article;
        }),
      save: (input) =>
        mutate("save", input, () => {
          const previous = current(input);
          const headers = historyHeaders(input.id, input.locale);
          const source = input.origin
            ? historyVersion({ ...input, versionId: input.origin.versionId })
            : previous.translations[input.locale]?.history?.currentId
              ? historyVersion({
                  ...input,
                  versionId: previous.translations[input.locale].history!.currentId!,
                })
              : null;
          if (input.origin)
            assertBlog(
              canAccessBlog(
                { id: config.editor.id, admin: config.admin ?? true },
                "publish",
                previous.shared.author?.id,
              ),
              "FORBIDDEN",
            );
          if (input.origin && !source?.shared.author && input.shared.author)
            assertBlog(config.admin ?? true, "FORBIDDEN");
          if (
            input.shared.author &&
            input.shared.author.id !==
              (source ? source.shared.author?.id : previous.shared.author?.id)
          )
            assertBlog(
              canAccessBlog(
                { id: config.editor.id, admin: config.admin ?? true },
                "changeAuthor",
                previous.shared.author?.id,
              ),
              "FORBIDDEN",
            );
          const result = saveArticle(
            current(input),
            input,
            categories,
            new Set(assets.filter((a) => a.postId === input.id).map((a) => a.id)),
            crypto.randomUUID(),
            config.editor,
            new Date().toISOString(),
          );
          const recorded = recordBlogSave(previous, result, input, headers, source);
          unique(recorded.article, input.locale);
          if (recorded.saved)
            versions.set(input.id, [
              ...(versions.get(input.id) ?? []).filter(
                (version) => !recorded.removedIds.includes(version.id),
              ),
              recorded.saved,
            ]);
          return replace(recorded.article);
        }),
      publish: (input) =>
        mutate("publish", input, () => {
          const article = current(input),
            versionId = article.translations[input.locale]?.history?.currentId;
          assertBlog(versionId, "NOT_FOUND");
          const target = { ...input, versionId },
            latest = plan(target);
          assertBlog(!latest.historicalReturn, "HISTORY_CONFIRMATION_REQUIRED");
          assertBlog(!latest.missingAssetIds.length, "INVALID");
          return publishVersion(target);
        }),
      unpublish: (input) =>
        mutate("unpublish", input, () =>
          replace(
            unpublishArticle(current(input), input.locale, config.editor, new Date().toISOString()),
          ),
        ),
      delete: (input) =>
        mutate("delete", input, () => {
          current(input);
          articles = articles.filter((a) => a.id !== input.id);
          versions.delete(input.id);
        }),
      upload: (input) =>
        mutate(
          "upload",
          {
            requestId: input.requestId,
            id: input.id,
            name: input.file.name,
            size: input.file.size,
          } as { requestId: string },
          async () => {
            get(input.id);
            if (config.failUpload) {
              config.consumeUploadFailure();
              throw Object.assign(new Error("STORAGE"), { code: "STORAGE" });
            }
            const bytes = new Uint8Array(await input.file.arrayBuffer());
            assertBlog(bytes.length <= MAX_IMAGE_BYTES && imageType(bytes) === input.file.type);
            const result = {
              id: crypto.randomUUID(),
              postId: input.id,
              name: input.file.name,
              contentType: input.file.type,
              size: bytes.length,
            };
            urls.set(result.id, URL.createObjectURL(input.file));
            assets = [...assets, result];
            return result;
          },
        ),
      saveCategory: (input) =>
        mutate("category", input, () => {
          const existing = categories.find((c) => c.id === input.id);
          if (input.id) assertBlog(existing?.version === input.version, "CONFLICT");
          const value = {
            id: input.id ?? crypto.randomUUID(),
            version: (existing?.version ?? 0) + 1,
            parentId: input.parentId,
            translations: validateCategory(
              input,
              categories,
              blogLocales.map((l) => l.code),
            ),
          };
          categories = [...categories.filter((c) => c.id !== value.id), value];
          return value;
        }),
      deleteCategory: (input) =>
        mutate("delete-category", input, () => {
          assertBlog(
            categories.find((c) => c.id === input.id)?.version === input.version,
            "CONFLICT",
          );
          assertBlog(
            !categories.some((c) => c.parentId === input.id) &&
              !articles.some(
                (a) =>
                  a.shared.categoryIds.includes(input.id) ||
                  Object.values(a.translations).some((t) =>
                    t.published?.shared.categoryIds.includes(input.id),
                  ),
              ),
            "IN_USE",
          );
          categories = categories.filter((c) => c.id !== input.id);
        }),
    };
  }
  return {
    client,
    applyConcurrentCorrection: (id: string) => {
      const article = get(id),
        locale = Object.keys(article.translations)[0],
        translation = article.translations[locale];
      const input = {
        id: article.id,
        version: article.version,
        requestId: crypto.randomUUID(),
        locale,
        content: {
          ...translation.draft,
          summary: `Concurrent correction ${article.version}`,
        },
        shared: translation.shared ?? article.shared,
      };
      const retained = versions.get(article.id) ?? [];
      const source =
        retained.find((version) => version.id === translation.history?.currentId) ?? null;
      const saved = saveArticle(
        article,
        input,
        categories,
        new Set(assets.filter((asset) => asset.postId === article.id).map((asset) => asset.id)),
        crypto.randomUUID(),
        initialEditor,
        new Date().toISOString(),
      );
      const result = recordBlogSave(article, saved, input, retained, source);
      articles = articles.map((value) => (value.id === article.id ? result.article : value));
      if (result.saved)
        versions.set(article.id, [
          ...retained.filter((version) => !result.removedIds.includes(version.id)),
          result.saved,
        ]);
      emit();
    },
    loadHistoryExample: (id: string) => {
      let article = get(id);
      const examples: BlogHistoryVersion[] = [];
      for (const { code: locale } of blogLocales) {
        const french = locale === "fr";
        const title = french
          ? ({
              [key(1)]: "Faire de la place aux idées",
              [key(2)]: "Travailler avec plus de calme",
              [key(3)]: "Notes de notre atelier",
              [key(4)]: "Une idée pour demain",
            }[id] ?? "Un nouvel article")
          : "A new article";
        article.translations[locale] ??= createArticle(
          id,
          title,
          locale,
          initialEditor,
          new Date().toISOString(),
        ).translations[locale];
        const original = structuredClone(article.translations[locale].draft);
        const settings = structuredClone(article.translations[locale].shared ?? article.shared);
        settings.author ??= initialEditor;
        const retained: BlogHistoryVersion[] = [];
        article.translations[locale].history = {
          lastNumber: 17,
          lastPublicationOrder: 0,
          currentId: null,
          publishedId: null,
        };
        // Reset even when the previous live text already matches the first sample.
        article.translations[locale].draft.markdown = "";
        const save = (markdown: string, source?: BlogHistoryVersion) => {
          const input = {
            id: article.id,
            version: article.version,
            requestId: crypto.randomUUID(),
            locale,
            content: { ...original, markdown },
            shared: settings,
            origin: source ? { versionId: source.id, repriseId: crypto.randomUUID() } : undefined,
          };
          const previous = article,
            currentId = article.translations[locale].history!.currentId;
          const current = source ?? retained.find((version) => version.id === currentId) ?? null;
          const result = recordBlogSave(
            previous,
            saveArticle(
              previous,
              input,
              categories,
              new Set(
                assets.filter((asset) => asset.postId === article.id).map((asset) => asset.id),
              ),
              crypto.randomUUID(),
              initialEditor,
              new Date().toISOString(),
            ),
            input,
            retained,
            current,
          );
          article = result.article;
          if (result.saved) retained.push(result.saved);
        };
        for (const word of french
          ? ["l’attention", "la curiosité", "le soin", "l’écoute", "la pratique"]
          : ["attention", "curiosity", "care", "listening", "practice"]) {
          save(
            french
              ? `## Commencer par une question\n\nLes bonnes idées commencent par **${word}**. Prenez un instant pour décrire le problème simplement.\n\nGardez de la place pour la suite.`
              : `## Begin with a question\n\nGood ideas start with **${word}**. Take a moment to describe the problem in plain language.\n\nLeave room for what comes next.`,
          );
          const result = publishBlogVersion(
            article,
            retained.at(-1)!,
            retained,
            categories,
            initialEditor,
            new Date().toISOString(),
          );
          article = result.article;
          retained[retained.length - 1] = result.saved;
        }
        const publications = [...retained];
        for (const source of [publications[0], publications[2], publications[4], publications[4]])
          save(
            source.content.markdown.replace(
              french ? "un instant" : "a moment",
              french ? "un instant au calme" : "a quiet moment",
            ),
            source,
          );
        examples.push(...retained);
      }
      versions.set(article.id, [
        ...(versions.get(article.id) ?? []).filter(
          (version) => !blogLocales.some((locale) => locale.code === version.locale),
        ),
        ...examples,
      ]);
      articles = articles.map((value) => (value.id === article.id ? article : value));
      emit();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => revision,
    get,
    categories: () => structuredClone(categories),
    assets: (id: string) => structuredClone(assets.filter((a) => a.postId === id)),
    assetUrl: (id: string) => urls.get(id) ?? "",
    listPublished: (q: Parameters<typeof publicPosts>[1]) => publicPosts(articles, q),
    getPublished: (locale: string, slug: string) => {
      const article = articles.find((a) => a.translations[locale]?.published?.slug === slug);
      const publication = article?.translations[locale]?.published;
      return article && publication
        ? { ...structuredClone(publication), id: article.id, locale }
        : null;
    },
    all: () => structuredClone(articles),
    dispose: () => {
      for (const url of urls.values()) if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    },
  };
}

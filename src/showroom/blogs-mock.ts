import type {
  BlogArticle,
  BlogAsset,
  BlogCategory,
  BlogEditor,
  BlogsClient,
} from "@/components/plugins/blogs";
import {
  createArticle,
  publishArticle,
  saveArticle,
  unpublishArticle,
  validateCategory,
} from "@/components/plugins/blogs/model";
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
export const demoBlogId = key(1);
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
  const assets: BlogAsset[] = [1, 2, 3].map((n) => ({
    id: key(100 + n),
    postId: key(n),
    name: `studio-${n}.png`,
    contentType: "image/png",
    size: 1024,
  }));
  const articles = [
    {
      title: "Make room for better ideas",
      summary: "A little space, a slower pace, and the habits that help thoughtful work happen.",
      markdown:
        "## Begin with a question\n\nGood ideas often start with **paying attention**. Before opening another tool, take a moment to describe the problem in plain language.\n\n> A useful question is often more valuable than a quick answer.\n\n## A small practice\n\n- Write down what you notice.\n- Talk with someone who sees things differently.\n- Make something small and learn from it.\n\n![A study in warm colors](./assets/" +
        key(101) +
        ")\n\n### Keep it simple\n\nLeave room for what comes next.",
    },
    {
      title: "A quieter kind of productivity",
      summary: "Building routines that leave room for focus, curiosity, and the unexpected.",
      markdown:
        "## Protect your attention\n\nStart with one meaningful task. Leave the rest for later.\n\n### What helps\n\n1. Clear priorities\n2. Space between meetings\n3. Time to reflect",
    },
    {
      title: "Notes from our workbench",
      summary: "An open look at the materials, experiments, and conversations behind our work.",
      markdown:
        "## Work in progress\n\nThe best part of a studio is the work you cannot see in a finished photograph.\n\n| Practice | Purpose |\n| --- | --- |\n| Sketching | Explore possibilities |\n| Prototyping | Learn by making |",
    },
  ].map((content, index) => {
    const n = index + 1,
      id = key(n),
      image = key(100 + n);
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
          thumbnailAlt: "A geometric color study",
          bannerAlt: "A geometric color study",
        },
        shared: {
          thumbnailId: image,
          bannerId: image,
          categoryIds: [index === 2 ? key(12) : key(11)],
        },
      },
      categories,
      new Set([image]),
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
        thumbnailAlt: "Une étude de couleurs",
        bannerAlt: "Une étude de couleurs",
      },
    },
    categories,
    new Set([key(101)]),
    key(401),
    initialEditor,
    date,
  );
  articles[0] = publishArticle(first, "fr", categories, initialEditor, date);
  articles.push(createArticle(key(4), "An idea for tomorrow", "en", initialEditor, date));
  return { articles, categories, assets };
}
export function createBlogsMock() {
  const initial = seed();
  let articles = initial.articles,
    categories = initial.categories,
    assets = initial.assets,
    revision = 0;
  const urls = new Map(initial.assets.map((a, index) => [a.id, `/blogs/studio-${index + 1}.png`]));
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
    readOnly: boolean;
    fail: boolean;
    failUpload: boolean;
    consumeUploadFailure: () => void;
  }): BlogsClient {
    async function mutate<T>(
      name: string,
      input: { requestId: string },
      run: () => T | Promise<T>,
    ): Promise<T> {
      assertBlog(!config.readOnly, "FORBIDDEN");
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
    return {
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
            .map((a) => articleListItem(a, q.locale)),
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
          const result = saveArticle(
            current(input),
            input,
            categories,
            new Set(assets.filter((a) => a.postId === input.id).map((a) => a.id)),
            crypto.randomUUID(),
            config.editor,
            new Date().toISOString(),
          );
          unique(result, input.locale);
          return replace(result);
        }),
      publish: (input) =>
        mutate("publish", input, () =>
          replace(
            publishArticle(
              current(input),
              input.locale,
              categories,
              config.editor,
              new Date().toISOString(),
            ),
          ),
        ),
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

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { BlogCategoriesPage, BlogEditPage } from "@/components/plugins/blogs";
import { BlogCategoryEditor } from "@/components/plugins/blogs/editor";
import { blogsLabels } from "@/components/plugins/blogs/labels";
import { blogCapabilities } from "@/components/plugins/blogs/permissions";
import type { BlogsClient } from "@/components/plugins/blogs/types";
import { blogLocales, createBlogsMock } from "@/showroom/blogs-mock";

import "../../src/styles/globals.css";

const mock = createBlogsMock();
const id = mock.all()[0].id;
const legacy = new URLSearchParams(location.search).has("legacy");
if (!legacy) mock.loadHistoryExample(id);
const actor = { id: "jordan", name: "Jordan Lee" };
const adapter = mock.client({
  editor: actor,
  admin: true,
  readOnly: false,
  fail: false,
  failUpload: false,
  consumeUploadFailure: () => {},
});
type Kind =
  | "list"
  | "body"
  | "save"
  | "article"
  | "publish"
  | "unpublish"
  | "plan"
  | "historyPublish"
  | "historyDelete"
  | "upload"
  | "delete"
  | "saveCategory"
  | "deleteCategory";
const held = new Set<Kind>(legacy ? [] : ["list", "body"]);
const calls: Record<
  Kind,
  { input: unknown; resolve: () => Promise<void>; reject: (code: string) => void }[]
> = {
  list: [],
  body: [],
  save: [],
  article: [],
  publish: [],
  unpublish: [],
  plan: [],
  historyPublish: [],
  historyDelete: [],
  upload: [],
  delete: [],
  saveCategory: [],
  deleteCategory: [],
};
function controlled<T>(kind: Kind, input: unknown, read: () => Promise<T>) {
  // Reads capture their response now; mutations execute only when explicitly resolved.
  const snapshot = ["list", "body", "article", "plan"].includes(kind) ? read() : undefined;
  void snapshot?.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const request = {
      input,
      resolve: async () => {
        await (snapshot ?? read()).then(resolve, reject);
      },
      reject: (code: string) => reject({ code }),
    };
    calls[kind].push(request);
    if (!held.has(kind)) void request.resolve();
  });
}
const client: BlogsClient = {
  ...adapter,
  get: (id) => controlled("article", id, () => adapter.get(id)),
  save: (input) => controlled("save", input, () => adapter.save(input)),
  publish: (input) => controlled("publish", input, () => adapter.publish(input)),
  unpublish: (input) => controlled("unpublish", input, () => adapter.unpublish(input)),
  upload: (input) => controlled("upload", input, () => adapter.upload(input)),
  delete: (input) => controlled("delete", input, () => adapter.delete(input)),
  saveCategory: (input) => controlled("saveCategory", input, () => adapter.saveCategory(input)),
  deleteCategory: (input) =>
    controlled("deleteCategory", input, () => adapter.deleteCategory(input)),
  history: legacy
    ? undefined
    : {
        ...adapter.history!,
        list: (input) => controlled("list", input, () => adapter.history!.list(input)),
        get: (input) => controlled("body", input, () => adapter.history!.get(input)),
        plan: (input) => controlled("plan", input, () => adapter.history!.plan(input)),
        publish: (input) =>
          controlled("historyPublish", input, () => adapter.history!.publish(input)),
        delete: (input) => controlled("historyDelete", input, () => adapter.history!.delete(input)),
      },
};
const editableCategory = new URLSearchParams(location.search).has("category")
  ? await adapter.saveCategory({
      requestId: crypto.randomUUID(),
      parentId: null,
      translations: { en: { name: "Unused category", slug: "unused-category" } },
    })
  : mock.categories()[0];
const accepted: string[] = [];
const deleted: string[] = [];
const clients = [client, { ...client }];
const dirtyChanges: boolean[] = [];
const onDirtyChange = (value: boolean) => dirtyChanges.push(value);
declare global {
  interface Window {
    draftTest: {
      calls: typeof calls;
      dirtyChanges: boolean[];
      accepted: string[];
      deleted: string[];
      hold: (kind: Kind, value: boolean) => void;
      replaceClient: (generation?: number) => void;
      correct: () => void;
      rerenderArticle: () => void;
      switchArticle: (index?: number) => void;
      unmount: () => void;
      current: () => ReturnType<typeof mock.get>;
    };
  }
}
function Fixture() {
  const [article, setArticle] = useState(() => mock.get(id));
  const [generation, setGeneration] = useState(0);
  const [visible, setVisible] = useState(true);
  const [category, setCategory] = useState(editableCategory);
  const currentClient = clients[generation % clients.length];
  useEffect(() => {
    window.draftTest = {
      calls,
      dirtyChanges,
      accepted,
      deleted,
      hold: (kind, value) => {
        if (value) held.add(kind);
        else held.delete(kind);
      },
      replaceClient: (generation) => setGeneration((value) => generation ?? value + 1),
      correct: () => mock.applyConcurrentCorrection(id),
      rerenderArticle: () => setArticle(mock.get(id)),
      switchArticle: (index = 1) => setArticle(mock.all()[index]),
      unmount: () => flushSync(() => setVisible(false)),
      current: () => mock.get(id),
    };
  }, []);
  if (!visible) return null;
  if (new URLSearchParams(location.search).has("category-page"))
    return (
      <BlogCategoriesPage
        assetUrl={mock.assetUrl}
        categories={mock.categories()}
        locales={blogLocales}
        client={currentClient}
        capabilities={blogCapabilities({ id: actor.id, admin: true })}
        backHref="#posts"
        onChanged={() => {
          accepted.push("category-change");
          setCategory(mock.categories().at(-1)!);
        }}
      />
    );
  if (new URLSearchParams(location.search).has("category"))
    return (
      <BlogCategoryEditor
        category={category}
        categories={mock.categories()}
        locales={blogLocales}
        client={currentClient}
        disabled={false}
        labels={blogsLabels}
        onSaved={(saved) => {
          accepted.push(saved.id);
          setCategory(saved);
        }}
        onDeleted={() => {
          deleted.push(category.id);
        }}
      />
    );
  return (
    <BlogEditPage
      client={currentClient}
      imageDimensions={false}
      article={article}
      categories={mock.categories()}
      assets={mock.assets(article.id)}
      locales={blogLocales}
      defaultLocale="en"
      backHref="#posts"
      categoriesHref="#categories"
      authors={[actor, { id: "alex", name: "Alex Morgan" }]}
      capabilities={blogCapabilities({ id: actor.id, admin: true }, actor.id)}
      assetUrl={mock.assetUrl}
      onSaved={(saved) => {
        accepted.push(saved.id);
        setArticle(saved);
      }}
      onDirtyChange={onDirtyChange}
      onDeleted={() => {
        deleted.push(article.id);
      }}
    />
  );
}
const root = createRoot(document.getElementById("factory-blog-draft-fixture")!);
root.render(
  <ActionToastProvider>
    <Fixture />
  </ActionToastProvider>,
);

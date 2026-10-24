import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { BlogEditPage } from "@/components/plugins/blogs";
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
type Kind = "list" | "body" | "save" | "article";
const held = new Set<Kind>(legacy ? [] : ["list", "body"]);
const calls: Record<
  Kind,
  { input: unknown; resolve: () => void; reject: (code: string) => void }[]
> = { list: [], body: [], save: [], article: [] };
function controlled<T>(kind: Kind, input: unknown, read: () => Promise<T>) {
  // Reads capture their response now; mutations execute only when explicitly resolved.
  const snapshot = kind === "save" ? undefined : read();
  void snapshot?.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const request = {
      input,
      resolve: () => {
        void (snapshot ?? read()).then(resolve, reject);
      },
      reject: (code: string) => reject({ code }),
    };
    calls[kind].push(request);
    if (!held.has(kind)) request.resolve();
  });
}
const client: BlogsClient = {
  ...adapter,
  get: (id) => controlled("article", id, () => adapter.get(id)),
  save: (input) => controlled("save", input, () => adapter.save(input)),
  history: legacy
    ? undefined
    : {
        ...adapter.history!,
        list: (input) => controlled("list", input, () => adapter.history!.list(input)),
        get: (input) => controlled("body", input, () => adapter.history!.get(input)),
      },
};
const dirtyChanges: boolean[] = [];
const onDirtyChange = (value: boolean) => dirtyChanges.push(value);
declare global {
  interface Window {
    draftTest: {
      calls: typeof calls;
      dirtyChanges: boolean[];
      hold: (kind: Kind, value: boolean) => void;
      replaceClient: () => void;
      correct: () => void;
      rerenderArticle: () => void;
      switchArticle: () => void;
      unmount: () => void;
      current: () => ReturnType<typeof mock.get>;
    };
  }
}
function Fixture() {
  const [article, setArticle] = useState(() => mock.get(id));
  const [generation, setGeneration] = useState(0);
  const currentClient = useMemo(() => ({ ...client, generation }), [generation]);
  useEffect(() => {
    window.draftTest = {
      calls,
      dirtyChanges,
      hold: (kind, value) => {
        if (value) held.add(kind);
        else held.delete(kind);
      },
      replaceClient: () => setGeneration((value) => value + 1),
      correct: () => mock.applyConcurrentCorrection(id),
      rerenderArticle: () => setArticle(mock.get(id)),
      switchArticle: () => setArticle(mock.all()[1]),
      unmount: () => root.unmount(),
      current: () => mock.get(id),
    };
  }, []);
  return (
    <BlogEditPage
      client={currentClient}
      article={article}
      categories={mock.categories()}
      assets={mock.assets(article.id)}
      locales={blogLocales}
      defaultLocale="en"
      backHref="#posts"
      authors={[actor, { id: "alex", name: "Alex Morgan" }]}
      capabilities={blogCapabilities({ id: actor.id, admin: true }, actor.id)}
      assetUrl={mock.assetUrl}
      onSaved={setArticle}
      onDirtyChange={onDirtyChange}
      onDeleted={() => {}}
    />
  );
}
const root = createRoot(document.getElementById("factory-blog-draft-fixture")!);
root.render(<Fixture />);

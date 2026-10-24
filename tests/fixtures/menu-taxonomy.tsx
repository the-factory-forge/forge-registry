import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { MenuTaxonomyPage } from "@/components/plugins/menus";
import type { MenuCategory, MenuLabel, MenusClient } from "@/components/plugins/menus/types";

import "../../src/styles/globals.css";

type Scope = "A" | "B";
type Kind =
  | "categories"
  | "labels"
  | "saveCategory"
  | "saveLabel"
  | "removeCategory"
  | "removeLabel";
function initial(scope: Scope): { categories: MenuCategory[]; labels: MenuLabel[] } {
  return {
    categories: [{ id: "category", position: 0, translations: { en: `${scope} category` } }],
    labels: [
      {
        id: "label",
        position: 0,
        kind: "dietary",
        icon: "leaf",
        translations: { en: `${scope} label` },
      },
    ],
  };
}
const data = { A: initial("A"), B: initial("B") };
const calls: {
  scope: Scope;
  kind: Kind;
  input: unknown;
  resolve: () => void;
  reject: () => void;
}[] = [];
let holdReads = false;
function request<T>(scope: Scope, kind: Kind, input: unknown, result: () => T, read = false) {
  const snapshot = read ? structuredClone(result()) : undefined;
  return new Promise<T>((resolve, reject) => {
    const call = {
      scope,
      kind,
      input,
      resolve: () => resolve(read ? snapshot! : result()),
      reject: () => reject(new Error("Controlled failure")),
    };
    calls.push(call);
    if (read && !holdReads) call.resolve();
  });
}
function client(scope: Scope): MenusClient {
  const unused = async () => {
    throw new Error("Unused client operation");
  };
  return {
    list: unused,
    get: unused,
    create: unused,
    save: unused,
    remove: unused,
    categories: () => request(scope, "categories", null, () => data[scope].categories, true),
    labels: () => request(scope, "labels", null, () => data[scope].labels, true),
    saveCategory: (input) =>
      request(scope, "saveCategory", input, () => {
        const saved = { ...input, id: input.id ?? "new-category", position: input.position + 1 };
        data[scope].categories = [
          ...data[scope].categories.filter((row) => row.id !== saved.id),
          saved,
        ];
        return saved;
      }),
    saveLabel: (input) =>
      request(scope, "saveLabel", input, () => {
        const saved = { ...input, id: input.id ?? "new-label", position: input.position + 1 };
        data[scope].labels = [...data[scope].labels.filter((row) => row.id !== saved.id), saved];
        return saved;
      }),
    removeCategory: (id) =>
      request(scope, "removeCategory", id, () => {
        data[scope].categories = data[scope].categories.filter((row) => row.id !== id);
      }),
    removeLabel: (id) =>
      request(scope, "removeLabel", id, () => {
        data[scope].labels = data[scope].labels.filter((row) => row.id !== id);
      }),
  };
}
const clients = { A: client("A"), B: client("B") };
declare global {
  interface Window {
    taxonomyTest: {
      calls: typeof calls;
      holdReads: (hold: boolean) => void;
      switchClient: (scope: Scope) => void;
    };
  }
}
function Fixture() {
  const [scope, setScope] = useState<Scope>("A");
  useEffect(() => {
    window.taxonomyTest = {
      calls,
      holdReads: (hold) => {
        holdReads = hold;
      },
      switchClient: setScope,
    };
  }, []);
  return (
    <MenuTaxonomyPage
      client={clients[scope]}
      baseLocale="en"
      locales={[{ code: "en", name: "English" }]}
      backHref="#items"
    />
  );
}
createRoot(document.getElementById("factory-menu-taxonomy-fixture")!).render(<Fixture />);

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { MenuItemsPage } from "@/components/plugins/menus";
import type { MenuItem, MenusClient } from "@/components/plugins/menus/types";

import "../../src/styles/globals.css";

type Scope = "A" | "B";
type Kind = "list" | "categories" | "reorder" | "remove";
function initial(scope: Scope): MenuItem[] {
  return ["First", "Second", "Third"].map((name, position) => ({
    id: String(position + 1),
    version: 1,
    categoryId: "category",
    position,
    priceMinor: 1000,
    visible: true,
    soldOut: false,
    imageEntryId: null,
    labelIds: [],
    translations: { en: { name: `${scope} ${name}`, description: "" } },
  }));
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
    throw new Error("Unused operation");
  };
  return {
    get: unused,
    create: unused,
    save: unused,
    labels: unused,
    saveCategory: unused,
    removeCategory: unused,
    saveLabel: unused,
    removeLabel: unused,
    list: () => request(scope, "list", null, () => data[scope], true),
    categories: () =>
      request(
        scope,
        "categories",
        null,
        () => [{ id: "category", position: 0, translations: { en: `${scope} category` } }],
        true,
      ),
    reorder: (order) =>
      request(scope, "reorder", order, () => {
        data[scope] = order.map(({ id }, position) => {
          const item = data[scope].find((entry) => entry.id === id)!;
          return { ...item, position, version: item.version + 1 };
        });
        return structuredClone(data[scope]);
      }),
    remove: (id) =>
      request(scope, "remove", id, () => {
        data[scope] = data[scope].filter((item) => item.id !== id);
      }),
  };
}
const clients = { A: client("A"), B: client("B") };
declare global {
  interface Window {
    menuItemsTest: {
      calls: typeof calls;
      holdReads: (hold: boolean) => void;
      switchClient: (scope: Scope) => void;
    };
  }
}
function Fixture() {
  const [scope, setScope] = useState<Scope>("A");
  useEffect(() => {
    window.menuItemsTest = {
      calls,
      holdReads: (hold) => {
        holdReads = hold;
      },
      switchClient: setScope,
    };
  }, []);
  return (
    <MenuItemsPage
      client={clients[scope]}
      baseLocale="en"
      newHref="#new"
      taxonomyHref="#categories"
      getEditHref={(item) => `#${item.id}`}
    />
  );
}
createRoot(document.getElementById("factory-menu-items-fixture")!).render(<Fixture />);

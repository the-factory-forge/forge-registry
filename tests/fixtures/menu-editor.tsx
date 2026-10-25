import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { MenuItemEditorPage } from "@/components/plugins/menus";
import type { MenuItem, MenuItemInput, MenusClient } from "@/components/plugins/menus/types";

import "../../src/styles/globals.css";

type Scope = "A" | "B";
function initial(scope: Scope, id = "first"): MenuItem {
  return {
    id,
    version: 1,
    categoryId: "category",
    position: 0,
    priceMinor: 1000,
    visible: false,
    soldOut: false,
    imageEntryId: null,
    labelIds: [],
    translations: { en: { name: `${scope} ${id}`, description: "" } },
  };
}
const calls: {
  scope: Scope;
  id?: string;
  version?: number;
  input: MenuItemInput;
  resolve: () => void;
  reject: () => void;
}[] = [];
const saved: MenuItem[] = [];
function client(scope: Scope): MenusClient {
  const unused = async () => {
    throw new Error("Unused operation");
  };
  function request(input: MenuItemInput, id?: string, version?: number) {
    return new Promise<MenuItem>((resolve, reject) => {
      const snapshot = structuredClone(input);
      calls.push({
        scope,
        id,
        version,
        input: snapshot,
        resolve: () => resolve({ ...snapshot, id: id ?? "created", version: (version ?? 0) + 1 }),
        reject: () => reject(new Error("Controlled failure")),
      });
    });
  }
  return {
    create: (input) => request(input),
    save: (id, version, input) => request(input, id, version),
    list: unused,
    get: unused,
    remove: unused,
    categories: unused,
    labels: unused,
    saveCategory: unused,
    removeCategory: unused,
    saveLabel: unused,
    removeLabel: unused,
  };
}
const clients = { A: client("A"), B: client("B") };
declare global {
  interface Window {
    menuEditorTest: {
      calls: typeof calls;
      saved: typeof saved;
      select: (id?: string, scope?: Scope) => void;
      refresh: () => void;
      folder: () => void;
      unmount: () => void;
    };
  }
}
function Fixture() {
  const [scope, setScope] = useState<Scope>("A");
  const [item, setItem] = useState<MenuItem | undefined>(() => initial("A"));
  const [folder, setFolder] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    window.menuEditorTest = {
      calls,
      saved,
      select: (id, nextScope = "A") => {
        setScope(nextScope);
        setItem(id ? initial(nextScope, id) : undefined);
      },
      refresh: () =>
        setItem((current) => current && { ...initial(scope, current.id), version: 99 }),
      folder: () => setFolder("another-folder"),
      unmount: () => setVisible(false),
    };
  }, [scope]);
  return (
    <ActionToastProvider>
      {visible && (
        <MenuItemEditorPage
          client={clients[scope]}
          item={item}
          categories={[{ id: "category", position: 0, translations: { en: "Food" } }]}
          labelsData={[]}
          locales={[
            { code: "en", name: "English" },
            { code: "fr", name: "French" },
          ]}
          baseLocale="en"
          currency="CHF"
          backHref="#back"
          photoFolderId={folder}
          onSaved={(result) => saved.push(result)}
        />
      )}
    </ActionToastProvider>
  );
}
createRoot(document.getElementById("factory-menu-editor-fixture")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);

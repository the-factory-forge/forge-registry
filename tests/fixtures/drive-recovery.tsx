import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { DriveBrowser } from "@/components/plugins/drive";
import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveTrashEntry,
} from "@/components/plugins/drive/types";

import "../../src/styles/globals.css";

const capabilities = {
  upload: false,
  createFolder: false,
  rename: true,
  delete: true,
  download: false,
  restore: true,
};
const entry: DriveEntry = {
  id: "report",
  parentId: null,
  name: "Report.txt",
  kind: "file",
  size: 5,
  contentType: "text/plain",
  updatedAt: "2026-01-01",
  state: "ready",
};
const archived: DriveTrashEntry = {
  ...entry,
  id: "archived",
  name: "Archived.txt",
  state: "trashed",
  originalParentId: null,
  originalPath: "Files",
  deletedAt: "2026-01-01",
  expiresAt: "2099-01-01",
};
const stores = new Map<string, { files: DriveEntry[]; trash: DriveTrashEntry[] }>();
function data(scope: DriveScope) {
  if (!stores.has(scope.id))
    stores.set(scope.id, { files: [structuredClone(entry)], trash: [structuredClone(archived)] });
  return stores.get(scope.id)!;
}
type Input = Parameters<NonNullable<DriveClient["restoreEntry"]>>[0];
const calls: {
  adapter: string;
  kind: "trash" | "restore" | "delete";
  input: Input;
  resolve: () => void;
  reject: (code?: string) => void;
}[] = [];
const reads: { adapter: string; scope: string; kind: "files" | "trash" }[] = [];
function client(adapter: string): DriveClient {
  const unused = async (): Promise<never> => {
    throw new Error("Unused operation");
  };
  function request(kind: "trash" | "restore" | "delete", input: Input) {
    return new Promise<void>((resolve, reject) => {
      calls.push({
        adapter,
        kind,
        input: structuredClone(input),
        reject: (code = "STORAGE") => reject({ code }),
        resolve: () => {
          const store = data(input.scope);
          if (kind === "trash") {
            const file = store.files.find((file) => file.id === input.entryId)!;
            store.files = store.files.filter((file) => file.id !== input.entryId);
            store.trash.push({
              ...file,
              state: "trashed",
              originalParentId: file.parentId,
              originalPath: "Files",
              deletedAt: "2026-01-01",
              expiresAt: "2099-01-01",
            });
          } else if (kind === "restore") {
            const file = store.trash.find((file) => file.id === input.entryId)!;
            store.trash = store.trash.filter((file) => file.id !== input.entryId);
            store.files.push({
              ...file,
              name: input.name ?? file.name,
              parentId: input.parentId === undefined ? file.originalParentId : input.parentId,
              state: "ready",
            });
          } else {
            store.trash = store.trash.filter((file) => file.id !== input.entryId);
          }
          resolve();
        },
      });
    });
  }
  return {
    listSpaces: unused,
    listEntries: async ({ scope, parentId, search, sort }) => {
      reads.push({ adapter, scope: scope.id, kind: "files" });
      return {
        space: { scope, name: "Recovery space", capabilities },
        breadcrumbs: parentId ? [{ id: parentId, name: "Other folder" }] : [],
        maxFileBytes: 1000,
        items: sort
          ? data(scope).files.filter(
              (file) => file.parentId === parentId && (!search || file.name.includes(search)),
            )
          : [],
      };
    },
    listTrash: async ({ scope, search }) => {
      reads.push({ adapter, scope: scope.id, kind: "trash" });
      return {
        space: { scope, name: "Recovery space", capabilities },
        items: data(scope).trash.filter((file) => !search || file.name.includes(search)),
      };
    },
    previewDelete: async () => ({ token: "preview", files: 1, folders: 0 }),
    trashEntry: (input) => request("trash", input),
    restoreEntry: (input) => request("restore", input),
    deleteEntry: (input) => request("delete", input),
    rename: unused,
    createFolder: unused,
    prepareUpload: unused,
    completeUpload: unused,
    cancelUpload: unused,
    getDownload: unused,
  };
}
const clients = { A: client("A"), B: client("B") };
declare global {
  interface Window {
    recoveryTest: {
      calls: typeof calls;
      reads: typeof reads;
      replaceClient: () => void;
      addTrash: () => void;
      leave: (destination: "unmount" | "folder" | "space") => void;
    };
  }
}
function Fixture() {
  const [adapter, setAdapter] = useState<"A" | "B">("A");
  const [visible, setVisible] = useState(true);
  const [scope, setScope] = useState<DriveScope>({ type: "project", id: "first" });
  const [parentId, setParentId] = useState<string | null>(null);
  useEffect(() => {
    window.recoveryTest = {
      calls,
      reads,
      replaceClient: () => setAdapter("B"),
      addTrash: () =>
        data({ type: "project", id: "first" }).trash.push({
          ...archived,
          id: "second-archive",
          name: "Second archive.txt",
        }),
      leave: (destination) => {
        if (destination === "unmount") setVisible(false);
        else if (destination === "folder") setParentId("other");
        else setScope({ type: "project", id: "second" });
      },
    };
  }, []);
  return (
    <ActionToastProvider>
      {visible && (
        <DriveBrowser
          client={clients[adapter]}
          scope={scope}
          parentId={parentId}
          getFolderHref={() => "#files"}
        />
      )}
    </ActionToastProvider>
  );
}
createRoot(document.getElementById("factory-drive-recovery-fixture")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);

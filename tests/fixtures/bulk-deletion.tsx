import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { AgentKeys } from "@/components/plugins/auth/agent-keys";
import { DriveBulkDelete } from "@/components/plugins/drive/bulk-delete";
import { driveLabels } from "@/components/plugins/drive/labels";
import type { DriveClient, DriveDeletePreview } from "@/components/plugins/drive/types";
import { EntryDialog } from "@/components/plugins/drive/ui";
import {
  TableBulkDelete,
  TableSelectionCheckbox,
  useTableSelection,
} from "@/components/table-selection";

import "../../src/styles/globals.css";

const initial = ["Alpha", "Beta"].map((name) => ({
  id: name.toLowerCase(),
  name,
  createdAt: "2026-01-01",
  lastUsedAt: null,
  expiresAt: "2027-01-01",
  expired: false,
  parentId: null,
  kind: "file" as const,
  size: 1,
  contentType: "text/plain",
  updatedAt: "2026-01-01",
  state: "ready" as const,
}));
const calls: { id: string; requestId: string; view: number; scope?: string }[] = [];
const requests: { resolve: () => void; reject: (code?: string) => void }[] = [];
const previews: { resolve: (preview: DriveDeletePreview) => void; reject: () => void }[] = [];
const kind = new URLSearchParams(location.search).get("kind") ?? "table";
const delayedPreview = new URLSearchParams(location.search).has("preview");
function preview() {
  return new Promise<DriveDeletePreview>((resolve, reject) => {
    previews.push({ resolve, reject: () => reject(new Error("Preview failed")) });
  });
}
declare global {
  interface Window {
    bulkTest: {
      calls: typeof calls;
      previewCount: () => number;
      resolvePreview: (index: number, token: string, files?: number) => void;
      rejectPreview: (index: number) => void;
      resolve: (index: number) => void;
      reject: (index: number, code?: string) => void;
      changeView: () => void;
      remove: (id: string) => void;
      showControl: (show: boolean) => void;
    };
  }
}
function Fixture() {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState(0);
  const [control, setControl] = useState(true);
  const selection = useTableSelection(items, String(view));
  const onDelete = (id: string, requestId = "", scope?: string) => {
    calls.push({ id, requestId, view, scope });
    return new Promise<void>((resolve, reject) => {
      requests.push({
        resolve,
        reject: (code) => reject(code ? { code } : new Error("Delete failed")),
      });
    });
  };
  useEffect(() => {
    window.bulkTest = {
      calls,
      previewCount: () => previews.length,
      resolvePreview: (index, token, files = 1) =>
        previews[index].resolve({ token, files, folders: 0 }),
      rejectPreview: (index) => previews[index].reject(),
      resolve: (index) => requests[index].resolve(),
      reject: (index, code) => requests[index].reject(code),
      changeView: () => setView((value) => value + 1),
      remove: (id) => setItems((rows) => rows.filter((item) => item.id !== id)),
      showControl: setControl,
    };
  }, []);
  const unused = async (): Promise<never> => {
    throw new Error("Unexpected Drive call");
  };
  const client: DriveClient = {
    listSpaces: unused,
    listEntries: unused,
    createFolder: unused,
    rename: unused,
    prepareUpload: unused,
    completeUpload: unused,
    cancelUpload: unused,
    getDownload: unused,
    previewDelete: preview,
    deleteEntry: ({ entryId, token, scope }) => onDelete(entryId, token, scope.id),
    trashEntry: ({ entryId, token, scope }) => onDelete(entryId, token, scope.id),
  };
  if (kind === "single")
    return (
      control && (
        <EntryDialog
          client={client}
          scope={{ type: "test", id: String(view) }}
          parentId={null}
          entry={initial[0]}
          deleting
          trashing={new URLSearchParams(location.search).has("trash")}
          labels={driveLabels}
          refresh={() => {}}
        >
          Delete Alpha
        </EntryDialog>
      )
    );
  if (kind === "auth")
    return control && <AgentKeys keys={items} onDelete={onDelete} onRetry={() => {}} />;
  return (
    <main>
      <TableSelectionCheckbox
        label="Select all rows"
        checked={selection.all}
        mixed={selection.mixed}
        disabled={selection.pending}
        onChange={selection.toggleAll}
      />
      {items
        .filter((item) => !selection.isDeleting(item.id))
        .map((item) => (
          <div key={item.id}>
            <TableSelectionCheckbox
              label={`Select ${item.name}`}
              checked={selection.selected.includes(item)}
              disabled={selection.pending}
              onChange={(checked) => selection.toggle(item.id, checked)}
            />
            {item.name}
          </div>
        ))}
      {control &&
        (kind === "drive" ? (
          <DriveBulkDelete
            client={client}
            scope={{ type: "test", id: String(view) }}
            selection={selection}
            labels={driveLabels}
            disabled={false}
            onDeleted={() => {}}
          />
        ) : (
          <TableBulkDelete
            selection={selection}
            getName={(item) => item.name}
            onDelete={(item, requestId) => onDelete(item.id, requestId)}
            prepare={delayedPreview ? async () => (await preview()).token : undefined}
          />
        ))}
    </main>
  );
}
createRoot(document.getElementById("factory-bulk-deletion-fixture")!).render(
  <ActionToastProvider>
    <Fixture />
  </ActionToastProvider>,
);

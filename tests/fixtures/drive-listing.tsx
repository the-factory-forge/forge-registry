import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { Link } from "@/components/link";
import { DriveBrowser, DrivePage } from "@/components/plugins/drive";
import { DriveFolderTree } from "@/components/plugins/drive/folder-tree";
import { driveLabels } from "@/components/plugins/drive/labels";
import { useDriveRecovery } from "@/components/plugins/drive/recovery";
import type { DriveClient, DriveFolderResult, DriveScope } from "@/components/plugins/drive/types";
import { useDriveListing } from "@/components/plugins/drive/use-listing";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";

import "../../src/styles/globals.css";

const kind = new URLSearchParams(location.search).get("kind") ?? "hook";
const scope: DriveScope = { type: "project", id: "listing" };
const space = {
  scope,
  name: "Listing space",
  capabilities: {
    upload: true,
    createFolder: true,
    rename: true,
    delete: true,
    download: true,
    restore: true,
  },
};
function folder(name: string): DriveFolderResult {
  return {
    space,
    breadcrumbs: [],
    maxFileBytes: 1000,
    nextCursor: "next",
    items: [
      {
        id: "entry",
        parentId: null,
        name,
        kind: kind === "trash" ? "folder" : "file",
        size: 1,
        contentType: "text/plain",
        updatedAt: "2026-01-01",
        state: "ready",
      },
    ],
  };
}
const requests: {
  signal?: AbortSignal;
  cursor?: string;
  resolveFolder?: (data: DriveFolderResult) => void;
  resolve: (name: string) => void;
  reject: (code: string) => void;
}[] = [];
function read<T>(signal: AbortSignal | undefined, result: (name: string) => T) {
  // Deliberately ignore cancellation: the listing must reject late adapter responses itself.
  return new Promise<T>((resolve, reject) => {
    requests.push({
      signal,
      resolve: (name) => resolve(result(name)),
      reject: (code) => reject({ code }),
    });
  });
}
const unused = async (): Promise<never> => {
  throw new Error("Unexpected mutation");
};
const client: DriveClient = {
  listSpaces: ({ signal }) =>
    read(signal, (name) => ({ items: [{ ...space, name }], nextCursor: "next" })),
  listEntries: (query) =>
    kind === "tree"
      ? new Promise<DriveFolderResult>((resolve, reject) => {
          requests.push({
            signal: query.signal,
            cursor: query.cursor,
            resolve: (name) => resolve(folder(name)),
            resolveFolder: resolve,
            reject: (code) => reject({ code }),
          });
        })
      : kind === "folder" && query.sort === undefined
        ? Promise.resolve({ ...folder("Tree"), items: [], nextCursor: undefined })
        : read(query.signal, folder),
  listTrash: ({ signal }) =>
    read(signal, (name) => ({
      space,
      nextCursor: "next",
      items: [
        {
          ...folder(name).items[0],
          state: "trashed",
          originalParentId: null,
          originalPath: "All files",
          deletedAt: "2026-01-01",
          expiresAt: "2099-01-01",
        },
      ],
    })),
  restoreEntry: async () => {
    throw { code: "RESTORE_CONFLICT" };
  },
  trashEntry: unused,
  createFolder: unused,
  rename: unused,
  previewDelete: unused,
  deleteEntry: unused,
  prepareUpload: unused,
  completeUpload: unused,
  cancelUpload: unused,
  getDownload: unused,
};
let rejectMutation: () => void;
let mutate: () => void;
declare global {
  interface Window {
    listingTest: {
      requests: typeof requests;
      refresh: () => void;
      replaceClient: () => void;
      unmount: () => void;
      mutate: () => void;
      rejectMutation: () => void;
    };
  }
}
function Hook({ revision, generation }: { revision: number; generation: number }) {
  const load = useCallback(
    (signal: AbortSignal) => read(signal, (name) => ({ name, generation })),
    [generation],
  );
  const listing = useDriveListing(load, revision);
  const optimistic = useOptimisticAction(listing.data, generation);
  useEffect(() => {
    mutate = () => {
      void optimistic
        .run(
          (value) => value && { ...value, name: "Optimistic" },
          () =>
            new Promise((_, reject) => {
              rejectMutation = () => reject(new Error("Mutation failed"));
            }),
        )
        .catch(() => {});
    };
  });
  return (
    <output>
      {JSON.stringify({ ...listing, data: optimistic.value, pending: optimistic.pending })}
    </output>
  );
}
function Fixture() {
  const [revision, setRevision] = useState(0);
  const [generation, setGeneration] = useState(0);
  const currentClient = useMemo(() => ({ ...client, generation }), [generation]);
  useEffect(() => {
    window.listingTest = {
      ...window.listingTest,
      requests,
      refresh: () => setRevision((value) => value + 1),
      replaceClient: () => setGeneration((value) => value + 1),
      unmount: () => root.unmount(),
      mutate: () => mutate(),
      rejectMutation: () => rejectMutation(),
    };
  }, []);
  return (
    <main className="p-4">
      {kind === "hook" ? (
        <Hook revision={revision} generation={generation} />
      ) : kind === "tree" ? (
        <DriveFolderTree
          client={currentClient}
          scope={scope}
          parentId={null}
          currentFolderId={null}
          breadcrumbs={[]}
          labels={driveLabels}
          getFolderHref={(id) => `#${id}`}
          linkComponent={Link}
          refreshKey={revision}
          onLoadingChange={() => {}}
          filesActive
          onNavigate={() => {}}
          renderActions={(entry, disabled) => (
            <button type="button" disabled={disabled}>
              Action: {entry.name}
            </button>
          )}
        />
      ) : kind === "spaces" ? (
        <DrivePage client={currentClient} getSpaceHref={() => "#space"} />
      ) : kind === "folder" ? (
        <DriveBrowser client={currentClient} scope={scope} getFolderHref={() => "#folder"} />
      ) : (
        <TrashListingFixture
          client={currentClient}
          scope={scope}
          labels={driveLabels}
          refreshKey={revision}
        />
      )}
    </main>
  );
}
function TrashListingFixture({
  client,
  scope,
  labels,
  refreshKey,
}: {
  client: DriveClient;
  scope: DriveScope;
  labels: typeof driveLabels;
  refreshKey: number;
}) {
  const recovery = useDriveRecovery({
    client,
    scope,
    labels,
    parentId: null,
    visible: true,
    refreshKey,
    onChanged: () => {},
    onDeleted: () => {},
    onUndoRestored: () => {},
    onOpenTrash: () => {},
    onUndo: (_entry, restore) => restore(),
  });
  return recovery.trash;
}
const root = createRoot(document.getElementById("factory-drive-listing-fixture")!);
root.render(
  <ActionToastProvider>
    <Fixture />
  </ActionToastProvider>,
);

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { DriveBrowser } from "@/components/plugins/drive";
import type { DriveClient, DriveEntry, DriveUploadInput } from "@/components/plugins/drive/types";

import "../../src/styles/globals.css";

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
const reads: { parentId: string | null; tree: boolean }[] = [];
const uploads: {
  input: DriveUploadInput;
  resolve?: () => void;
  aborted?: boolean;
  completed?: boolean;
  cancelled?: boolean;
}[] = [];
const unused = async (): Promise<never> => {
  throw new Error("Unused operation");
};
const client: DriveClient = {
  listSpaces: unused,
  listEntries: async ({ scope, parentId, sort }) => {
    reads.push({ parentId, tree: !sort });
    return {
      space: {
        scope,
        name: "Files",
        capabilities: {
          upload: true,
          createFolder: false,
          rename: false,
          delete: false,
          download: false,
        },
      },
      breadcrumbs: parentId ? [{ id: parentId, name: "Other folder" }] : [],
      maxFileBytes: 1000,
      items: sort && !parentId ? [entry] : [],
    };
  },
  prepareUpload: async (input) => {
    uploads.push({ input });
    return { id: input.requestId, completed: false };
  },
  completeUpload: async ({ uploadId }) => {
    uploads.find((job) => job.input.requestId === uploadId)!.completed = true;
  },
  cancelUpload: async ({ uploadId }) => {
    uploads.find((job) => job.input.requestId === uploadId)!.cancelled = true;
  },
  createFolder: unused,
  rename: unused,
  previewDelete: unused,
  deleteEntry: unused,
  getDownload: unused,
};
declare global {
  interface Window {
    navigationTest: {
      reads: typeof reads;
      uploads: typeof uploads;
      openFolder: () => void;
    };
  }
}
function Fixture() {
  const [parentId, setParentId] = useState<string | null>(null);
  useEffect(() => {
    window.navigationTest = { reads, uploads, openFolder: () => setParentId("other") };
  }, []);
  return (
    <DriveBrowser
      client={client}
      scope={{ type: "project", id: "first" }}
      parentId={parentId}
      getFolderHref={() => "#files"}
      transferUpload={(ticket, _file, { signal }) =>
        new Promise<void>((resolve) => {
          const job = uploads.find((job) => job.input.requestId === ticket.id)!;
          job.resolve = resolve;
          signal.addEventListener(
            "abort",
            () => {
              job.aborted = true;
            },
            { once: true },
          );
        })
      }
    />
  );
}
createRoot(document.getElementById("factory-drive-navigation-fixture")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);

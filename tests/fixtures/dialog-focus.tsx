import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { driveLabels } from "@/components/plugins/drive/labels";
import type { DriveClient } from "@/components/plugins/drive/types";
import { EntryDialog } from "@/components/plugins/drive/ui";

import "../../src/styles/globals.css";

const client = {
  createFolder: async () => {
    throw new Error("Save failed");
  },
  previewDelete: async () => ({ token: "preview", files: 1, folders: 0 }),
} as unknown as DriveClient;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {(["create", "rename", "duplicate", "delete"] as const).map((mode) => (
      <EntryDialog
        key={mode}
        client={client}
        scope={{ type: "project", id: "focus" }}
        parentId={null}
        entry={mode === "create" ? undefined : { id: "entry", name: "Existing folder" }}
        deleting={mode === "delete"}
        duplicating={mode === "duplicate"}
        labels={driveLabels}
        refresh={() => {}}
      >
        {mode}
      </EntryDialog>
    ))}
  </StrictMode>,
);

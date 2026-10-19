"use client";

import { useRef } from "react";

import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveTrashEntry,
} from "@/components/plugins/drive/types";
import { messageFor } from "@/components/plugins/drive/ui";
import { TableBulkDelete, type TableBulkDeleteProps } from "@/components/table-selection";

export function DriveBulkDelete<T extends DriveEntry | DriveTrashEntry>({
  client,
  scope,
  selection,
  labels,
  disabled,
  trashEnabled = false,
  onDeleted,
}: {
  client: DriveClient;
  scope: DriveScope;
  selection: TableBulkDeleteProps<T>["selection"];
  labels: DriveLabels;
  disabled: boolean;
  trashEnabled?: boolean;
  onDeleted: (entry: T) => void;
}) {
  const tokens = useRef(new Map<string, string>());
  return (
    <TableBulkDelete
      selection={selection}
      getName={(entry) => entry.name}
      disabled={disabled}
      labels={{
        ...labels,
        bulkDeleted: "",
        bulkConfirm:
          trashEnabled && selection.selected.every((entry) => entry.state === "ready")
            ? labels.moveToTrash
            : labels.confirmDelete,
      }}
      description={trashEnabled ? labels.trashHint : labels.bulkDeleteDescription}
      errorMessage={(error) => messageFor(error, labels)}
      prepare={async (entries) => {
        const previews = await Promise.all(
          entries.map(async (entry) => ({
            entry,
            preview: await client.previewDelete({ scope, entryId: entry.id }),
          })),
        );
        tokens.current = new Map(previews.map(({ entry, preview }) => [entry.id, preview.token]));
        return (
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {previews.map(({ entry, preview }) => (
              <li key={entry.id} className="break-words">
                {(trashEnabled && entry.state === "ready"
                  ? labels.trashDescription
                  : labels.deleteDescription)(entry.name, preview.files, preview.folders)}
              </li>
            ))}
          </ul>
        );
      }}
      onDelete={async (entry) => {
        const token = tokens.current.get(entry.id);
        if (!token) throw new Error("Deletion preview is unavailable");
        const input = { scope, entryId: entry.id, token };
        if (trashEnabled && entry.state === "ready") await client.trashEntry!(input);
        else await client.deleteEntry(input);
        onDeleted(entry);
      }}
    />
  );
}

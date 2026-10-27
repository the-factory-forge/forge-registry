"use client";

import type { DriveLabels } from "@/components/plugins/drive/labels";
import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveTrashEntry,
} from "@/components/plugins/drive/types";
import { messageFor } from "@/components/plugins/drive/ui";
import { useDriveDeletion } from "@/components/plugins/drive/use-deletion";
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
  const deletion = useDriveDeletion(client, scope);
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
        const previews = await deletion.prepare(entries.map((entry) => entry.id));
        return (
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {entries.map((entry, index) => (
              <li key={entry.id} className="break-words">
                {(trashEnabled && entry.state === "ready"
                  ? labels.trashDescription
                  : labels.deleteDescription)(
                  entry.name,
                  previews[index].files,
                  previews[index].folders,
                )}
              </li>
            ))}
          </ul>
        );
      }}
      onDelete={async (entry) => {
        await deletion.remove(entry.id, trashEnabled && entry.state === "ready");
        onDeleted(entry);
      }}
    />
  );
}

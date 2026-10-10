"use client";

import {
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  FolderUpIcon,
} from "lucide-react";
import { useRef } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { IconTooltip } from "@/components/icon-tooltip";
import type { DriveLabels } from "@/components/plugins/drive/labels";
import type { DriveCapabilities, DriveClient, DriveEntry } from "@/components/plugins/drive/types";
import { buttonClass } from "@/components/plugins/drive/ui";
import { cn } from "@/components/utils/cn";

export interface DriveFolderMenuProps {
  entry: DriveEntry;
  capabilities?: DriveCapabilities;
  client: DriveClient;
  trashEnabled: boolean;
  disabled: boolean;
  labels: DriveLabels;
  onUpload: (entry: DriveEntry, directory: boolean) => void;
  onAction: (
    entry: DriveEntry,
    action: "rename" | "duplicate" | "trash",
    trigger: HTMLButtonElement | null,
  ) => void;
}

export function DriveFolderMenu({
  entry,
  capabilities,
  client,
  trashEnabled,
  disabled,
  labels,
  onUpload,
  onAction,
}: DriveFolderMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const duplicate =
    !!client.duplicateEntry &&
    capabilities?.download &&
    capabilities.upload &&
    capabilities.createFolder;
  const trash = trashEnabled && capabilities?.delete;
  if (!capabilities?.upload && !capabilities?.rename && !duplicate && !trash) return null;
  const label = `${labels.actions}: ${entry.name}`;
  const itemClass = "min-h-10 rounded-md md:min-h-8";
  return (
    <DropdownMenu>
      <IconTooltip label={label}>
        <DropdownMenuTrigger
          ref={trigger}
          disabled={disabled}
          aria-label={label}
          className={cn(buttonClass, "size-10 shrink-0 p-0 md:size-8")}
        >
          <EllipsisVerticalIcon className="size-4 shrink-0" aria-hidden="true" />
        </DropdownMenuTrigger>
      </IconTooltip>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl motion-reduce:animate-none">
        <p className="max-w-64 truncate px-2 py-2 text-sm font-semibold">{entry.name}</p>
        <DropdownMenuSeparator />
        {capabilities?.upload && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={itemClass}>
              <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.add}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48 rounded-xl motion-reduce:animate-none">
              <DropdownMenuItem className={itemClass} onClick={() => onUpload(entry, false)}>
                <UploadIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.uploadFile}
              </DropdownMenuItem>
              {capabilities.createFolder && client.prepareFolderUpload && (
                <DropdownMenuItem className={itemClass} onClick={() => onUpload(entry, true)}>
                  <FolderUpIcon className="size-4 shrink-0" aria-hidden="true" />
                  {labels.uploadFolder}
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {capabilities?.rename && (
          <DropdownMenuItem
            className={itemClass}
            onClick={() => onAction(entry, "rename", trigger.current)}
          >
            <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.rename}
          </DropdownMenuItem>
        )}
        {duplicate && (
          <DropdownMenuItem
            className={itemClass}
            onClick={() => onAction(entry, "duplicate", trigger.current)}
          >
            <CopyIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.duplicate}
          </DropdownMenuItem>
        )}
        {trash && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className={itemClass}
              onClick={() => onAction(entry, "trash", trigger.current)}
            >
              <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
              {labels.moveToTrash}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

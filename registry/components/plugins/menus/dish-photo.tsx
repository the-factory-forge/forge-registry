"use client";

import { UnlinkIcon } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { ImageCropDialog } from "@/components/image-crop";
import { ImageWithFallback } from "@/components/image-with-fallback";
import type { DriveClient } from "@/components/plugins/drive/types";
import type { MenusLabels } from "@/components/plugins/menus/labels";
import {
  dishPhotoMaxBytes,
  dishPhotoMimeTypes,
  prepareDishPhoto,
  type PendingDishPhoto,
} from "@/components/plugins/menus/save-with-photo";
import { field, outlineButton } from "@/components/plugins/menus/ui";
import { cn } from "@/components/utils/cn";

export function DishPhotoField({
  labels,
  pending,
  itemId,
  entryId,
  entryName,
  getPhotoUrl,
  driveClient,
  photo,
  onPick,
  onRemove,
  settings,
}: {
  labels: MenusLabels;
  pending: boolean;
  itemId?: string;
  entryId: string | null;
  entryName?: string;
  getPhotoUrl?: (itemId: string, entryId: string) => string | undefined;
  driveClient?: DriveClient;
  photo?: PendingDishPhoto;
  onPick: (photo: PendingDishPhoto) => void;
  onRemove: () => void;
  settings?: ReactNode;
}) {
  const id = `factory-dish-photo-${useId()}`;
  const [crop, setCrop] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const sourceKey = photo?.requestId ?? (entryId && itemId ? `${itemId}:${entryId}` : "");
  const providedSrc = !photo && entryId && itemId ? getPhotoUrl?.(itemId, entryId) : undefined;
  const [preview, setPreview] = useState<{ key: string; url: string }>();

  useEffect(() => {
    let active = true;
    if (photo) {
      const url = URL.createObjectURL(photo.file);
      void Promise.resolve().then(() => {
        if (active) setPreview({ key: sourceKey, url });
      });
      return () => {
        active = false;
        URL.revokeObjectURL(url);
      };
    }
    if (providedSrc || !entryId || !itemId || !driveClient) return;
    void driveClient
      .getDownload({ scope: { type: "menu-item", id: itemId }, entryId })
      .then(({ url }) => {
        if (active) setPreview({ key: sourceKey, url });
      })
      .catch(() => {
        if (active) setPreview(undefined);
      });
    return () => {
      active = false;
    };
  }, [driveClient, entryId, itemId, photo, providedSrc, sourceKey]);

  const src = providedSrc ?? (preview?.key === sourceKey ? preview?.url : undefined) ?? "";
  function choose(file?: File) {
    if (!file) return;
    const valid =
      dishPhotoMimeTypes.includes(file.type) && file.size > 0 && file.size <= dishPhotoMaxBytes;
    setInvalid(!valid);
    if (valid) setCrop(file);
  }

  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-border p-4" disabled={pending}>
      <legend className="px-1 font-medium">
        {labels.photo}{" "}
        <span className="text-sm font-normal text-muted-foreground">{labels.photoOptional}</span>
      </legend>
      <div
        data-menu-photo-drop=""
        className={cn(
          "flex flex-wrap items-start gap-4 rounded-lg border-2 border-dashed p-3 transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-border",
        )}
        onDragOver={(event) => {
          if (!driveClient || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = pending ? "none" : "copy";
          setDragging(!pending);
        }}
        onDragLeave={(event) => {
          if (
            !(
              event.relatedTarget instanceof Node &&
              event.currentTarget.contains(event.relatedTarget)
            )
          )
            setDragging(false);
        }}
        onDrop={(event) => {
          if (!driveClient || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(false);
          if (!pending) choose(event.dataTransfer.files[0]);
        }}
      >
        <ImageWithFallback
          key={src}
          src={src}
          alt={labels.photo}
          fallbackLabel={labels.noPhoto}
          className="aspect-[3/2] w-full shrink-0 rounded-md object-cover sm:w-40"
        />
        <div className="min-w-0 flex-1 space-y-3">
          {driveClient && (
            <>
              <label className="grid gap-2 text-sm">
                <span>{labels.choosePhoto}</span>
                <input
                  type="file"
                  accept={dishPhotoMimeTypes.join(",")}
                  className={cn(field, "min-w-0 file:mr-2")}
                  aria-describedby={`${id}-photo-help`}
                  onChange={(event) => {
                    choose(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <p id={`${id}-photo-help`} className="text-sm text-muted-foreground">
                {labels.photoHelp}
              </p>
            </>
          )}
          {invalid && (
            <p role="alert" className="text-sm text-destructive">
              {labels.photoInvalid}
            </p>
          )}
          {entryName && !photo && <p className="text-sm wrap-anywhere">{entryName}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {(photo || entryId) && (
              <button type="button" className={outlineButton} onClick={onRemove}>
                <UnlinkIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.removePhoto}
              </button>
            )}
            {settings}
          </div>
        </div>
      </div>
      <ImageCropDialog
        file={crop}
        width={1200}
        height={800}
        maxFileBytes={dishPhotoMaxBytes}
        onCancel={() => setCrop(null)}
        onConfirm={(file) => {
          onPick(prepareDishPhoto(file));
          setCrop(null);
        }}
        labels={{ confirm: labels.selectPhoto, cancel: labels.cancel, ...labels.photoCrop }}
      />
    </fieldset>
  );
}

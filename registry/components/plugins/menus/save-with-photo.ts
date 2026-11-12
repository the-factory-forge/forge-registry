import { transferDriveUpload, type DriveTransfer } from "@/components/plugins/drive/transfer";
import type { DriveClient } from "@/components/plugins/drive/types";
import type { MenuItem, MenuItemInput, MenusClient } from "@/components/plugins/menus/types";

export const dishPhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const dishPhotoMaxBytes = 10_000_000;

export interface PendingDishPhoto {
  file: File;
  requestId: string;
  entryId?: string;
  completed?: boolean;
}

export function prepareDishPhoto(file: File): PendingDishPhoto {
  const requestId = crypto.randomUUID();
  const filename = Array.from(file.name.replace(/\.webp$/i, ""))
    .filter(
      (char) =>
        char !== "/" && char !== "\\" && char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
    )
    .join("")
    .trim()
    .slice(0, 200);
  return {
    requestId,
    file: new File([file], `${filename || "photo"}-${requestId.slice(0, 8)}.webp`, {
      type: file.type,
    }),
  };
}

/** Keep the item and upload identities across retries after a partial save. */
export async function saveDishWithPhoto({
  client,
  drive,
  state,
  input,
  photo,
  visibleOnCreate,
  transfer = transferDriveUpload,
  signal,
}: {
  client: Pick<MenusClient, "save" | "create">;
  drive?: Pick<DriveClient, "prepareUpload" | "completeUpload">;
  state: { item?: MenuItem };
  input: MenuItemInput;
  photo?: PendingDishPhoto;
  visibleOnCreate: boolean;
  transfer?: DriveTransfer;
  signal: AbortSignal;
}): Promise<MenuItem> {
  if (photo && !drive) throw new Error("Photo storage is unavailable");
  if (!state.item) {
    state.item = await client.create(
      { ...input, imageEntryId: null, visible: photo ? false : input.visible },
      visibleOnCreate ? { visibleOnCreate: true } : undefined,
    );
    if (!photo) return state.item;
  }
  let imageEntryId = input.imageEntryId;
  if (photo && drive) {
    signal.throwIfAborted();
    const scope = { type: "menu-item", id: state.item.id };
    if (!photo.completed) {
      const ticket = await drive.prepareUpload({
        scope,
        parentId: null,
        requestId: photo.requestId,
        name: photo.file.name,
        size: photo.file.size,
        contentType: photo.file.type,
      });
      if (!ticket.entryId) throw new Error("The upload did not identify its file entry");
      photo.entryId = ticket.entryId;
      if (!ticket.completed) {
        await transfer(ticket, photo.file, { signal, onProgress: () => {} });
        signal.throwIfAborted();
        await drive.completeUpload({ scope, uploadId: ticket.id });
      }
      photo.completed = true;
    }
    if (!photo.entryId) throw new Error("The photo was not uploaded");
    imageEntryId = photo.entryId;
  }
  signal.throwIfAborted();
  state.item = await client.save(state.item.id, state.item.version, { ...input, imageEntryId });
  return state.item;
}

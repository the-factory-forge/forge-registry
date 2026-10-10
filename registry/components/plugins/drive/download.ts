import { zipSync } from "fflate";

import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveSpace,
} from "@/components/plugins/drive/types";
import { DriveError, safeDownloadUrl, validName } from "@/components/plugins/drive/utils";

// shortcut: browser ZIPs hold bytes in memory; use server streaming for larger archives.
const MAX_BYTES = 100_000_000;
const MAX_ENTRIES = 1000;

export async function downloadFolder(
  client: DriveClient,
  scope: DriveScope,
  folder: DriveEntry | DriveSpace,
  signal: AbortSignal,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = Object.create(null);
  const pending: { entry: DriveEntry; path: string }[] = [];
  const visited = new Set<string | null>();
  let expectedBytes = 0;
  let receivedBytes = 0;

  async function collect(entry: DriveEntry | DriveSpace, prefix: string, depth: number) {
    signal.throwIfAborted();
    const id = "kind" in entry ? entry.id : null;
    if (("kind" in entry && entry.state !== "ready") || visited.has(id))
      throw new DriveError("CONFLICT");
    if (entry.name !== validName(entry.name)) throw new DriveError("INVALID");
    visited.add(id);
    if (visited.size > MAX_ENTRIES || depth > 100) throw new DriveError("DOWNLOAD_LIMIT");
    const isFile = "kind" in entry && entry.kind === "file";
    const path = `${prefix}${entry.name}${isFile ? "" : "/"}`;
    if (Object.hasOwn(files, path)) throw new DriveError("CONFLICT");
    files[path] = new Uint8Array();
    if (isFile) {
      if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new DriveError("INVALID");
      expectedBytes += entry.size;
      if (expectedBytes > MAX_BYTES) throw new DriveError("DOWNLOAD_LIMIT");
      pending.push({ entry, path });
      return;
    }
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      const page = await client.listEntries({ scope, parentId: id, cursor, signal });
      if (!page.space.capabilities.download) throw new DriveError("FORBIDDEN");
      for (const child of page.items) {
        if (child.parentId !== id) throw new DriveError("CONFLICT");
        await collect(child, path, depth + 1);
      }
      cursor = page.nextCursor;
      if (cursor && cursors.has(cursor)) throw new DriveError("CONFLICT");
      if (cursor) cursors.add(cursor);
    } while (cursor);
  }

  if ("kind" in folder && folder.kind !== "folder") throw new DriveError("INVALID");
  await collect(folder, "", 0);
  for (const { entry, path } of pending) {
    signal.throwIfAborted();
    const result = await client.getDownload({ scope, entryId: entry.id });
    const url = safeDownloadUrl(result.url);
    if (!url) throw new DriveError("INVALID");
    const response = await fetch(url, { signal, credentials: "omit" });
    if (!response.ok || !response.body) throw new DriveError("STORAGE");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_BYTES) throw new DriveError("DOWNLOAD_LIMIT");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    files[path] = bytes;
  }
  signal.throwIfAborted();
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}

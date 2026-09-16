import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveSpace,
  DriveUploadInput,
} from "@/components/plugins/drive/types";
import {
  DEFAULT_MAX_FILE_BYTES,
  DriveError,
  scopeKey,
  validName,
} from "@/components/plugins/drive/utils";

type MockEntry = DriveEntry & { scope: DriveScope; blob?: Blob };
export function createDriveMock() {
  const entries: MockEntry[] = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      scope: { type: "workspace", id: "handbook" },
      parentId: null,
      kind: "file",
      name: "Welcome.txt",
      size: 28,
      contentType: "text/plain",
      updatedAt: "2026-09-16T09:00:00Z",
      state: "ready",
    },
  ];
  const uploads = new Map<
    string,
    {
      input: DriveUploadInput;
      blob?: Blob;
      entryId: string;
      completed?: boolean;
      cancelled?: boolean;
    }
  >();
  const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  let failNextTransfer = false;
  let failNextDeletion = false;
  function owned(scope: DriveScope) {
    return entries.filter((entry) => scopeKey(entry.scope) === scopeKey(scope));
  }
  function find(scope: DriveScope, id: string) {
    const entry = owned(scope).find((item) => item.id === id);
    if (!entry) throw new DriveError("NOT_FOUND");
    return entry;
  }
  function descendants(scope: DriveScope, id: string): MockEntry[] {
    const entry = find(scope, id);
    return [
      entry,
      ...owned(scope)
        .filter((child) => child.parentId === id)
        .flatMap((child) => descendants(scope, child.id)),
    ];
  }
  function checkParent(scope: DriveScope, parentId: string | null) {
    if (!parentId) return;
    const parent = find(scope, parentId);
    if (parent.kind !== "folder" || parent.state !== "ready") throw new DriveError("CONFLICT");
    checkParent(scope, parent.parentId);
  }
  function available(scope: DriveScope, parentId: string | null, name: string, except?: string) {
    checkParent(scope, parentId);
    if (
      owned(scope).some(
        (entry) => entry.parentId === parentId && entry.name === name && entry.id !== except,
      ) ||
      [...uploads.values()].some(
        (upload) =>
          !upload.completed &&
          !upload.cancelled &&
          scopeKey(upload.input.scope) === scopeKey(scope) &&
          upload.input.parentId === parentId &&
          upload.input.name === name &&
          upload.entryId !== except,
      )
    )
      throw new DriveError("CONFLICT");
  }
  function token(rows: MockEntry[]) {
    return rows
      .map((entry) => `${entry.id}:${entry.name}:${entry.state}`)
      .sort()
      .join("|");
  }
  const transfer: DriveTransfer = async (ticket, file, { signal, onProgress }) => {
    const upload = uploads.get(ticket.id);
    if (!upload) throw new DriveError("NOT_FOUND");
    for (let value = 10; value <= 100; value += 10) {
      await delay(90);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      onProgress(value);
      if (failNextTransfer && value === 50) {
        failNextTransfer = false;
        throw new DriveError("STORAGE");
      }
    }
    upload.blob = file;
  };
  return {
    transfer,
    failUpload() {
      failNextTransfer = true;
    },
    failDeletion() {
      failNextDeletion = true;
    },
    assertEmpty(scope: DriveScope) {
      if (
        owned(scope).length ||
        [...uploads.values()].some(
          (upload) =>
            scopeKey(upload.input.scope) === scopeKey(scope) &&
            !upload.cancelled &&
            !upload.completed,
        )
      )
        throw new DriveError("CONFLICT");
    },
    client(spaces: DriveSpace[], failActions: boolean, directoryState: string): DriveClient {
      const authorize = (scope: DriveScope, capability?: keyof DriveSpace["capabilities"]) => {
        const space = spaces.find((item) => scopeKey(item.scope) === scopeKey(scope));
        if (!space) throw new DriveError("NOT_FOUND");
        if (capability && !space.capabilities[capability]) throw new DriveError("FORBIDDEN");
        return space;
      };
      async function mutation(scope: DriveScope, capability: keyof DriveSpace["capabilities"]) {
        authorize(scope, capability);
        await delay();
        if (failActions) throw new DriveError("STORAGE");
      }
      async function listing() {
        if (directoryState === "loading") await new Promise(() => {});
        await delay(80);
        if (directoryState === "error") throw new DriveError("STORAGE");
      }
      const paginate = <T>(items: T[], cursor?: string) => {
        const offset = Number(cursor ?? 0);
        return {
          items: items.slice(offset, offset + 10),
          nextCursor: items.length > offset + 10 ? String(offset + 10) : undefined,
        };
      };
      return {
        async listSpaces({ search = "", cursor }) {
          await listing();
          return paginate(
            spaces.filter((space) => space.name.toLowerCase().includes(search.toLowerCase())),
            cursor,
          );
        },
        async listEntries({ scope, parentId, search = "", cursor }) {
          const space = authorize(scope);
          await listing();
          checkParent(scope, parentId);
          const breadcrumbs: { id: string; name: string }[] = [];
          let id = parentId;
          while (id) {
            const parent = find(scope, id);
            breadcrumbs.unshift({ id, name: parent.name });
            id = parent.parentId;
          }
          return {
            space,
            breadcrumbs,
            maxFileBytes: DEFAULT_MAX_FILE_BYTES,
            ...paginate(
              owned(scope)
                .filter(
                  (entry) =>
                    entry.parentId === parentId &&
                    entry.name.toLowerCase().includes(search.toLowerCase()),
                )
                .sort((a, b) => b.kind.localeCompare(a.kind) || a.name.localeCompare(b.name)),
              cursor,
            ),
          };
        },
        async createFolder({ scope, parentId, name: input }) {
          await mutation(scope, "createFolder");
          const name = validName(input);
          available(scope, parentId, name);
          entries.push({
            id: crypto.randomUUID(),
            scope,
            parentId,
            name,
            kind: "folder",
            size: 0,
            contentType: "",
            state: "ready",
            updatedAt: new Date().toISOString(),
          });
        },
        async rename({ scope, entryId, name: input }) {
          await mutation(scope, "rename");
          const entry = find(scope, entryId);
          if (entry.state !== "ready") throw new DriveError("CONFLICT");
          const name = validName(input);
          available(scope, entry.parentId, name, entryId);
          entry.name = name;
          entry.updatedAt = new Date().toISOString();
        },
        async previewDelete({ scope, entryId }) {
          authorize(scope, "delete");
          await delay();
          const rows = descendants(scope, entryId);
          return {
            token: token(rows),
            files: rows.filter((entry) => entry.kind === "file").length,
            folders: rows.filter((entry) => entry.kind === "folder").length,
          };
        },
        async deleteEntry({ scope, entryId, token: expected }) {
          await mutation(scope, "delete");
          if (!owned(scope).some((item) => item.id === entryId)) return;
          const rows = descendants(scope, entryId);
          if (find(scope, entryId).state !== "deleting" && token(rows) !== expected)
            throw new DriveError("CONFLICT");
          rows.forEach((entry) => {
            entry.state = "deleting";
          });
          if (failNextDeletion) {
            failNextDeletion = false;
            throw new DriveError("DELETE_PENDING");
          }
          for (const entry of rows) entries.splice(entries.indexOf(entry), 1);
        },
        async prepareUpload(input) {
          await mutation(input.scope, "upload");
          if (input.size > DEFAULT_MAX_FILE_BYTES) throw new DriveError("INVALID");
          const existing = uploads.get(input.requestId);
          if (existing) {
            if (existing.cancelled) throw new DriveError("EXPIRED");
            return { id: input.requestId, completed: Boolean(existing.completed) };
          }
          const name = validName(input.name);
          available(input.scope, input.parentId, name);
          uploads.set(input.requestId, { input: { ...input, name }, entryId: crypto.randomUUID() });
          return { id: input.requestId, completed: false };
        },
        async completeUpload({ scope, uploadId }) {
          await mutation(scope, "upload");
          const upload = uploads.get(uploadId);
          if (!upload || scopeKey(upload.input.scope) !== scopeKey(scope))
            throw new DriveError("NOT_FOUND");
          if (upload.completed) return;
          if (upload.cancelled || !upload.blob) throw new DriveError("STORAGE");
          checkParent(scope, upload.input.parentId);
          entries.push({
            id: upload.entryId,
            scope,
            parentId: upload.input.parentId,
            kind: "file",
            name: upload.input.name,
            size: upload.blob.size,
            contentType: upload.blob.type,
            state: "ready",
            updatedAt: new Date().toISOString(),
            blob: upload.blob,
          });
          upload.completed = true;
        },
        async cancelUpload({ scope, uploadId }) {
          authorize(scope, "upload");
          await delay();
          const upload = uploads.get(uploadId);
          if (upload && scopeKey(upload.input.scope) === scopeKey(scope) && !upload.completed) {
            upload.cancelled = true;
            upload.blob = undefined;
          }
        },
        async getDownload({ scope, entryId }) {
          await mutation(scope, "download");
          const entry = find(scope, entryId);
          if (entry.state !== "ready") throw new DriveError("CONFLICT");
          const url = URL.createObjectURL(
            entry.blob ?? new Blob(["Welcome to the Forge Drive.\n"], { type: "text/plain" }),
          );
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return { url };
        },
      };
    },
  };
}

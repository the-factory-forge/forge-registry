import { z } from "zod";

import {
  agentId,
  agentTools,
  agentOperation,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { AgentsError } from "@/components/plugins/agents/types";
import { driveInputs, driveScopeSchema } from "@/components/plugins/drive/server/input";
import type {
  DriveClient,
  DriveEntry,
  DriveScope,
  DriveTrashEntry,
} from "@/components/plugins/drive/types";

export interface DriveAgentOptions<Context> extends AgentConnectorOptions<Context, DriveClient> {
  /** Authorized exact lookup, used to detect changes between proposal and approval. */
  entry(
    context: Context,
    input: { scope: DriveScope; entryId: string },
  ): Promise<DriveEntry | DriveTrashEntry>;
  renameSpace?(context: Context, scope: DriveScope, name: string): Promise<void>;
  space?(context: Context, scope: DriveScope): Promise<{ name: string }>;
  /** Optional existing folder/archive download adapter; URLs are resolved only on a user click. */
  download?(
    context: Context,
    input: { scope: DriveScope; entryId: string },
  ): Promise<{ url: string; name: string }>;
}
export function createDriveAgentOperation<Context>(options: DriveAgentOptions<Context>) {
  const { read, write } = agentTools<Context>();
  const before = (c: Context, i: { scope: DriveScope; entryId: string }) => options.entry(c, i);
  const tools = [
    read("drive_list_spaces", driveInputs.query, (c, i) => options.client(c).listSpaces(i)),
    read("drive_list_entries", driveInputs.listing, (c, i) => options.client(c).listEntries(i)),
    read("drive_get_entry", driveInputs.entry, before),
    read("drive_list_trash", driveInputs.trash, (c, i) => {
      const client = options.client(c);
      if (!client.listTrash) throw new AgentsError("FORBIDDEN");
      return client.listTrash(i);
    }),
    read("drive_deletion_preview", driveInputs.entry, (c, i) => options.client(c).previewDelete(i)),
    write("drive_create_folder", driveInputs.folder, {
      before: async (c, i) =>
        i.parentId ? options.entry(c, { scope: i.scope, entryId: i.parentId }) : i.scope,
      run: (c, i) => options.client(c).createFolder(i),
    }),
    write("drive_rename", driveInputs.rename, {
      before,
      run: (c, i) => options.client(c).rename(i),
    }),
    write("drive_duplicate", driveInputs.rename, {
      before,
      run: (c, i) => {
        const client = options.client(c);
        if (!client.duplicateEntry) throw new AgentsError("FORBIDDEN");
        return client.duplicateEntry(i);
      },
      effects: ["Copies the entry and all descendants."],
    }),
    ...(["trash", "delete"] as const).map((action) =>
      write(`drive_${action}`, driveInputs.entry, {
        before: async (c, i) => {
          const entry = await before(c, i);
          const client = options.client(c);
          if (
            action === "trash"
              ? !client.trashEntry
              : !!client.trashEntry && entry.state !== "trashed"
          )
            throw new AgentsError("FORBIDDEN");
          return { entry, deletion: await client.previewDelete(i) };
        },
        run: async (c, i, _files, _requestId, prepared) => {
          const client = options.client(c);
          const preview = z
            .object({ before: z.object({ deletion: z.object({ token: z.string() }) }) })
            .parse(prepared).before.deletion;
          if (action === "trash") {
            if (!client.trashEntry) throw new AgentsError("FORBIDDEN");
            return client.trashEntry({ ...i, token: preview.token });
          }
          return client.deleteEntry({ ...i, token: preview.token });
        },
        effects: [
          action === "trash"
            ? "Moves this entry and descendants to trash."
            : "Permanently deletes this entry and descendants.",
        ],
      }),
    ),
    write("drive_restore", driveInputs.restore, {
      before,
      run: (c, i) => {
        const client = options.client(c);
        if (!client.restoreEntry) throw new AgentsError("FORBIDDEN");
        return client.restoreEntry(i);
      },
    }),
    write(
      "drive_upload",
      z.object({
        scope: driveScopeSchema,
        parentId: agentId.nullable(),
        attachmentId: agentId,
        relativePath: z.string().max(2000).optional(),
      }),
      {
        before: async (c, i) =>
          i.parentId ? options.entry(c, { scope: i.scope, entryId: i.parentId }) : i.scope,
        attachments: (i) => [i.attachmentId],
        run: async (c, i, files, requestId) => {
          const { metadata, bytes } = await files.get(i.attachmentId);
          const client = options.client(c);
          const input = {
            scope: i.scope,
            parentId: i.parentId,
            name: metadata.name,
            contentType: metadata.contentType,
            size: bytes.length,
            requestId,
          };
          const ticket = i.relativePath
            ? await client.prepareFolderUpload?.({ ...input, relativePath: i.relativePath })
            : await client.prepareUpload(input);
          if (!ticket) throw new AgentsError("FORBIDDEN");
          if (!ticket.completed) {
            if (!ticket.url) throw new AgentsError("STORAGE");
            const response = await fetch(ticket.url, {
              method: "PUT",
              headers: ticket.headers,
              body: new Uint8Array(bytes),
              signal: AbortSignal.timeout(60000),
              redirect: "error",
            });
            if (!response.ok) throw new AgentsError("STORAGE");
            await client.completeUpload({ scope: i.scope, uploadId: ticket.id });
          }
          return { uploadId: ticket.id, name: metadata.name };
        },
        effects: ["Uploads this attachment into the selected private file space."],
      },
    ),
  ];
  tools.push({
    name: "drive_download",
    description:
      "Prepare a download. The user opens it through an authorized download button; URLs are never sent to the model.",
    kind: "read",
    schema: driveInputs.entry,
    run: async (c, raw) => {
      const entry = await before(c, driveInputs.entry.parse(raw));
      return { name: entry.name };
    },
    download: async (c, raw) => {
      const input = driveInputs.entry.parse(raw);
      if (options.download) return options.download(c, input);
      const entry = await before(c, input);
      const result = await options.client(c).getDownload(input);
      return { ...result, name: entry.name };
    },
  });
  if (options.renameSpace && options.space)
    tools.push(
      write(
        "drive_rename_space",
        z.object({ scope: driveScopeSchema, name: z.string().min(1).max(250) }),
        {
          before: (c, i) => options.space!(c, i.scope),
          run: (c, i) => options.renameSpace!(c, i.scope, i.name),
        },
      ),
    );
  return agentOperation("drive", "Drive", options.authorize, tools);
}

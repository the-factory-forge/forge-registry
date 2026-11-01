import { z } from "zod";

import {
  agentId,
  agentVersion,
  agentRecord,
  agentTools,
  agentOperation,
  agentFile,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { AgentsError } from "@/components/plugins/agents/types";
import {
  menuItemInputSchema,
  menuCategoryInputSchema,
  menuLabelInputSchema,
  menuOrderSchema,
} from "@/components/plugins/menus/model";
import type { MenusClient } from "@/components/plugins/menus/types";

export interface MenusAgentOptions<Context> extends AgentConnectorOptions<Context, MenusClient> {
  /** Use the existing menu-item Drive scope, validate bytes and return the completed entry ID. */
  uploadImage?(
    context: Context,
    itemId: string,
    file: File,
    requestId: string,
  ): Promise<{ imageEntryId: string }>;
}
export function createMenusAgentOperation<Context>(options: MenusAgentOptions<Context>) {
  const { read, write } = agentTools<Context>();
  const before = (c: Context, i: { id: string }) => options.client(c).get(i.id);
  const tools = [
    read("menus_list", z.object({}), (c) => options.client(c).list()),
    read("menus_get", agentRecord, (c, i) => options.client(c).get(i.id)),
    read("menus_categories", z.object({}), (c) => options.client(c).categories()),
    read("menus_labels", z.object({}), (c) => options.client(c).labels()),
    write("menus_create", menuItemInputSchema, {
      before: async () => null,
      run: (c, i) => options.client(c).create(i),
    }),
    write(
      "menus_save",
      agentRecord.extend({ version: agentVersion, values: menuItemInputSchema }),
      {
        before,
        run: (c, i) => options.client(c).save(i.id, i.version, i.values),
        effects: ["Visible item changes affect public menus."],
      },
    ),
    write("menus_delete", agentRecord, {
      before,
      run: (c, i) => options.client(c).remove(i.id),
      effects: ["Deletes this menu item."],
    }),
    write("menus_reorder", z.object({ order: menuOrderSchema }), {
      before: (c) => options.client(c).list(),
      run: (c, i) => {
        const client = options.client(c);
        if (!client.reorder) throw new AgentsError("FORBIDDEN");
        return client.reorder(i.order);
      },
    }),
    write("menus_save_category", menuCategoryInputSchema.extend({ id: agentId.optional() }), {
      before: (c) => options.client(c).categories(),
      run: (c, i) => options.client(c).saveCategory(i),
    }),
    write("menus_delete_category", agentRecord, {
      before: (c) => options.client(c).categories(),
      run: (c, i) => options.client(c).removeCategory(i.id),
      effects: ["Deletes the selected category."],
    }),
    write("menus_save_label", menuLabelInputSchema.extend({ id: agentId.optional() }), {
      before: (c) => options.client(c).labels(),
      run: (c, i) => options.client(c).saveLabel(i),
    }),
    write("menus_delete_label", agentRecord, {
      before: (c) => options.client(c).labels(),
      run: (c, i) => options.client(c).removeLabel(i.id),
      effects: ["Deletes the selected label."],
    }),
  ];
  if (options.uploadImage)
    tools.push(
      write("menus_upload_image", agentRecord.extend({ attachmentId: agentId }), {
        before,
        attachments: (i) => [i.attachmentId],
        run: async (c, i, files, requestId) =>
          options.uploadImage!(c, i.id, await agentFile(files, i.attachmentId), requestId),
        effects: [
          "Uploads into the menu item's Drive space. Selecting it on the item requires a separate save.",
        ],
      }),
    );
  return agentOperation("menus", "Menus", options.authorize, tools);
}

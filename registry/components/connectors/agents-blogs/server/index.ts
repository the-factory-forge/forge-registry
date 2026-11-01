import { z } from "zod";

import {
  agentId,
  agentRecord,
  agentVersion,
  agentTools,
  agentOperation,
  agentFile,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import { blogInputs } from "@/components/plugins/blogs/server/input";
import type { BlogsClient } from "@/components/plugins/blogs/types";

export function createBlogsAgentOperation<Context>(
  options: AgentConnectorOptions<Context, BlogsClient>,
) {
  const { read, write } = agentTools<Context>();
  const before = (context: Context, input: { id: string }) => options.client(context).get(input.id);
  const post = blogInputs.publish.omit({ requestId: true });
  const category = z.object({
    id: agentId.optional(),
    version: agentVersion.optional(),
    parentId: agentId.nullable(),
    translations: z.record(z.string(), z.object({ name: z.string(), slug: z.string() })),
  });
  const tools = [
    read("blogs_list", blogInputs.query, (c, i) => options.client(c).list(i)),
    read("blogs_get", agentRecord, (c, i) => options.client(c).get(i.id)),
    read("blogs_categories", z.object({}), (c) => options.client(c).categories()),
    read("blogs_assets", agentRecord, (c, i) => options.client(c).assets(i.id)),
    write("blogs_create", blogInputs.create.omit({ requestId: true }), {
      before: async () => null,
      run: (c, i, _f, requestId) => options.client(c).create({ ...i, requestId }),
    }),
    write("blogs_save", blogInputs.save.omit({ requestId: true }), {
      before,
      run: (c, i, _f, requestId) => options.client(c).save({ ...i, requestId }),
    }),
    ...(["publish", "unpublish"] as const).map((method) =>
      write(`blogs_${method}`, post, {
        before,
        run: (c, i, _f, requestId) => options.client(c)[method]({ ...i, requestId }),
        effects: [
          method === "publish"
            ? "Changes the publicly visible article."
            : "Removes this language's public publication.",
        ],
      }),
    ),
    write("blogs_delete", blogInputs.post.omit({ requestId: true }), {
      before,
      run: (c, i, _f, requestId) => options.client(c).delete({ ...i, requestId }),
      effects: ["Deletes the article and its history."],
    }),
    write("blogs_save_category", category, {
      before: (c) => options.client(c).categories(),
      run: (c, i, _f, requestId) => options.client(c).saveCategory({ ...i, requestId }),
    }),
    write("blogs_delete_category", z.object({ id: agentId, version: agentVersion }), {
      before: (c) => options.client(c).categories(),
      run: (c, i, _f, requestId) => options.client(c).deleteCategory({ ...i, requestId }),
      effects: ["Deletes the selected category."],
    }),
    write("blogs_upload", z.object({ id: agentId, attachmentId: agentId }), {
      before,
      attachments: (i) => [i.attachmentId],
      run: async (c, i, f, requestId) =>
        options.client(c).upload({ id: i.id, file: await agentFile(f, i.attachmentId), requestId }),
      effects: [
        "Uploads the image to this article; saving its cover or Markdown is a separate action.",
      ],
    }),
  ];
  const history = (context: Context) => {
    const value = options.client(context).history;
    if (!value) throw new Error("History is unavailable.");
    return value;
  };
  tools.push(
    read("blogs_history_list", blogInputs.historyList, (c, i) => history(c).list(i)),
    read("blogs_history_get", blogInputs.historyGet, (c, i) => history(c).get(i)),
    read("blogs_history_plan", blogInputs.historyTarget, (c, i) => history(c).plan(i)),
    write("blogs_history_publish", blogInputs.historyPublish.omit({ requestId: true }), {
      before: async (c, i) => ({ article: await before(c, i), plan: await history(c).plan(i) }),
      run: (c, i, _f, requestId) => history(c).publish({ ...i, requestId }),
      effects: ["Replaces the current public publication with this historical version."],
    }),
    write("blogs_history_delete", blogInputs.historyMutation.omit({ requestId: true }), {
      before,
      run: (c, i, _f, requestId) => history(c).delete({ ...i, requestId }),
      effects: ["Deletes this historical publication."],
    }),
  );
  return {
    ...agentOperation("blogs", "Blogs", options.authorize, tools),
    attachmentOptions: [
      { label: "Thumbnail", crop: { width: 1200, height: 900 } },
      { label: "Banner", crop: { width: 1600, height: 900 } },
      { label: "Article image" },
    ],
  };
}

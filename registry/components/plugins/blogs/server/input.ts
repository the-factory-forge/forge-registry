import { z } from "zod";

import { BlogsError } from "@/components/plugins/blogs/utils";

export const blogIdSchema = z.string().regex(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
const id = blogIdSchema;
const version = z.number().int().positive();
const locale = z.string();
const mutation = z.object({ requestId: id });
const post = mutation.extend({ id, version });
const historyList = z.object({ id, locale });
const historyGet = historyList.extend({ versionId: id });
const historyTarget = historyGet.extend({ version });
const historyMutation = historyTarget.extend({ requestId: id });
const content = z.object({
  title: z.string().max(250),
  slug: z
    .string()
    .max(120)
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
  summary: z.string().max(2000),
  markdown: z.string(),
  thumbnailAlt: z.string().max(1000),
  bannerAlt: z.string().max(1000),
});
const query = z.object({
  locale,
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().max(250).optional(),
});
export const blogInputs = {
  query,
  publicQuery: query.extend({ categoryId: id.optional() }),
  create: mutation.extend({
    title: z
      .string()
      .max(250)
      .refine((value) => !!value.trim()),
    locale,
  }),
  save: post.extend({
    locale,
    content,
    shared: z.object({
      author: z.object({ id: z.string().min(1).max(250), name: z.string() }).optional(),
      thumbnailId: id.nullable(),
      bannerId: id.nullable(),
      categoryIds: z.array(id).max(100),
    }),
    origin: z.object({ versionId: id, repriseId: id.optional() }).optional(),
  }),
  publish: post.extend({ locale }),
  post,
  category: mutation
    .extend({
      id: id.optional(),
      version: version.optional(),
      parentId: id.nullable(),
      translations: z.record(
        z.string(),
        z.object({
          name: z
            .string()
            .max(150)
            .refine((value) => !!value.trim()),
          slug: z
            .string()
            .max(120)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        }),
      ),
    })
    .refine((value) => !value.id || value.version !== undefined),
  file: mutation.extend({ id, file: z.instanceof(File) }),
  image: mutation.extend({
    id,
    name: z
      .string()
      .max(255)
      .refine(
        (value) =>
          !!value.trim() && !value.split("").some((character) => character.charCodeAt(0) < 32),
      ),
    contentType: z.string(),
    bytes: z.instanceof(Uint8Array),
  }),
  historyList,
  historyGet,
  historyTarget,
  historyMutation,
  historyPublish: historyMutation.extend({ token: z.string(), omitMissingImages: z.boolean() }),
};
export function parseBlogInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BlogsError("INVALID");
  return result.data;
}

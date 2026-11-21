import { z } from "zod";

export const SUPPORT_PAGE_SIZE = 20;
export const SUPPORT_MAX_IMAGES = 5;
export const SUPPORT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const supportIdSchema = z.string().min(1).max(200);
export const supportStatusSchema = z.enum(["open", "closed", "canceled"]);
export const supportPrioritySchema = z.enum(["P0", "P1", "P2", "P3", "P4"]);
export type SupportPriority = z.infer<typeof supportPrioritySchema>;
const attachments = z
  .array(supportIdSchema)
  .max(SUPPORT_MAX_IMAGES)
  .refine((ids) => new Set(ids).size === ids.length);
export const supportCreateSchema = z.object({
  requestId: supportIdSchema,
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .max(5000)
    .refine((value) => value.trim().length > 0),
  type: z.enum(["bug", "feature", "support"]),
  priority: supportPrioritySchema.optional(),
  attachmentIds: attachments,
});
export const supportCommentSchema = z
  .object({
    requestId: supportIdSchema,
    id: supportIdSchema,
    body: z.string().max(5000),
    attachmentIds: attachments,
  })
  .refine((value) => value.body.trim().length > 0 || value.attachmentIds.length > 0);
export const SUPPORT_SORT_FIELDS = ["title", "status", "author", "updatedAt"] as const;
export const supportSortSchema = z.object({
  field: z
    .enum([...SUPPORT_SORT_FIELDS, "type"])
    .transform((field) => (field === "type" ? "title" : field)),
  direction: z.enum(["asc", "desc"]),
});
export type SupportSort = z.input<typeof supportSortSchema>;
export type SupportColumnSort = z.output<typeof supportSortSchema>;
export const SUPPORT_DEFAULT_SORT = {
  field: "updatedAt",
  direction: "desc",
} as const satisfies SupportSort;
export const supportQuerySchema = z.object({
  search: z.string().trim().max(250).default(""),
  page: z.number().int().min(1).max(1000000).default(1),
  sort: supportSortSchema.default(SUPPORT_DEFAULT_SORT),
});
export class SupportsError extends Error {
  code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "STORAGE" | "STORAGE_NOT_CONFIGURED";
  constructor(code: SupportsError["code"]) {
    super(code);
    this.code = code;
  }
}

/** Check bytes rather than trusting the filename or browser MIME declaration. */
export function supportImageType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    return "image/jpeg";
  if (
    bytes.length >= 20 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (
    bytes.length >= 14 &&
    ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6))) &&
    bytes.at(-1) === 59
  )
    return "image/gif";
}

import { z } from "zod";

import { DriveError } from "@/components/plugins/drive/utils";

export const driveIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const driveScopeSchema = z.object({
  type: z
    .string()
    .max(100)
    .refine((value) => !!value.trim()),
  id: z
    .string()
    .max(512)
    .refine((value) => !!value.trim()),
});
const name = z.string();
const scope = driveScopeSchema;
const parentId = driveIdSchema.nullable();
const entryId = driveIdSchema;
const query = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  sort: z
    .object({
      field: z.enum(["name", "updatedAt", "size", "owner"]),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
});
const entry = z.object({ scope, entryId });
const upload = z.object({
  scope,
  parentId,
  requestId: driveIdSchema,
  name,
  size: z.number().int().nonnegative(),
  contentType: z.string(),
});
export const driveInputs = {
  query,
  listing: query.extend({ scope, parentId }),
  trash: query.extend({ scope }),
  folder: z.object({ scope, parentId, name }),
  entry,
  rename: entry.extend({ name }),
  deletion: entry.extend({ token: z.string() }),
  restore: entry.extend({ parentId: parentId.optional(), name: name.optional() }),
  upload,
  folderUpload: upload.extend({ relativePath: z.string() }),
  uploadId: z.object({ scope, uploadId: driveIdSchema }),
  maintenance: z.object({ limit: z.number().int().min(1).max(1000).default(100) }),
};
export function parseDriveInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new DriveError("INVALID");
  return result.data;
}

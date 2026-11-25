import { z } from "zod";

export const projectStatusSchema = z.enum([
  "requested",
  "prospect",
  "under-construction",
  "production",
]);
export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  status: projectStatusSchema.default("requested"),
  description: z
    .string()
    .trim()
    .max(5000)
    .transform((value) => value || null),
});

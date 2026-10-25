import { z } from "zod";

export const previewDeviceSearch = z.object({
  previewDevice: z.enum(["phone", "tablet"]).optional().catch(undefined),
  previewEmbed: z.literal(true).optional().catch(undefined),
});

export const previewLocationMessage = z.object({
  type: z.literal("showroom-preview-location"),
  href: z
    .string()
    .startsWith("/")
    .refine((href) => !href.startsWith("//")),
});

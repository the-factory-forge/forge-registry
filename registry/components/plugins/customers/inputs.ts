import { z } from "zod";

const contactField = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => value || null);
export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  companyName: contactField,
  phoneNumber: contactField,
  street: contactField,
  city: contactField,
  addressComplement: contactField,
});

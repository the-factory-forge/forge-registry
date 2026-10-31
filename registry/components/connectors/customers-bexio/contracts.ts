import { z } from "zod";

// Bexio's two record types are an API detail, not a customer type selector.
export const bexioContactTypeSchema = z.enum(["company", "person"]);
export type BexioContactType = z.infer<typeof bexioContactTypeSchema>;
export const bexioSyncStatusSchema = z.enum(["linked", "pending", "synced", "error"]);
export type BexioSyncStatus = z.infer<typeof bexioSyncStatusSchema>;

export function isRealCustomerEmail(email: string) {
  return z.email().safeParse(email).success && !email.toLowerCase().endsWith(".invalid");
}

export const forgeCustomerSchema = z.object({
  localCustomerId: z.string().trim().min(1).max(200),
  fullName: z.string().trim().min(1),
  email: z.email(),
  language: z.string().trim().min(2).max(16),
  companyName: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable().default(null),
  addressComplement: z.string().nullable().default(null),
  postalCode: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  countryCode: z.string().nullable().default(null),
});
export type ForgeCustomer = z.infer<typeof forgeCustomerSchema>;

export const bexioContactSchema = z.object({
  id: z.number().int().positive(),
  contact_type_id: z.union([z.literal(1), z.literal(2)]),
  name_1: z.string(),
  name_2: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  phone_fixed: z.string().nullable().optional(),
  user_id: z.number().int().positive(),
  owner_id: z.number().int().positive(),
  updated_at: z.string().nullable().optional(),
});
export type BexioContact = z.infer<typeof bexioContactSchema>;

export const bexioRelationSchema = z.object({
  id: z.number().int().positive(),
  contact_id: z.number().int().positive(),
  contact_sub_id: z.number().int().positive(),
});
export type BexioRelation = z.infer<typeof bexioRelationSchema>;

export const bexioUserSchema = z.object({ id: z.number().int().positive(), email: z.email() });
export type BexioUser = z.infer<typeof bexioUserSchema>;

export const createBexioContactInputSchema = z.object({
  contactType: bexioContactTypeSchema,
  companyName: z.string().trim().min(1).nullable(),
  fullName: z.string().trim().min(1).nullable(),
  email: z.email().nullable(),
  language: z.string().trim().min(2).max(16),
  phone: z.string().trim().min(1).nullable(),
  street: z.string().trim().min(1).nullable(),
  addressComplement: z.string().trim().min(1).nullable(),
  postalCode: z.string().trim().min(1).nullable(),
  city: z.string().trim().min(1).nullable(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  ownerId: z.number().int().positive(),
});
export type CreateBexioContactInput = z.infer<typeof createBexioContactInputSchema>;
export const createAndLinkBexioContactInputSchema = z.object({
  localCustomerId: z.string().trim().min(1).max(200),
  contactType: bexioContactTypeSchema,
});
export type CreateAndLinkBexioContactInput = z.infer<typeof createAndLinkBexioContactInputSchema>;

export type BexioContactLink = {
  id: string;
  localCustomerId: string;
  bexioPersonId: number | null;
  bexioCompanyId: number | null;
  lastSyncedEmail: string | null;
  syncStatus: BexioSyncStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type UpsertBexioContactLinkInput = Omit<BexioContactLink, "id" | "createdAt" | "updatedAt">;
export type UpdateBexioSyncStateInput = Pick<
  BexioContactLink,
  "syncStatus" | "lastSyncedAt" | "lastError"
> & {
  lastSyncedEmail?: string | null;
};
export type BexioSyncResult =
  | { status: "not-linked" }
  | { status: "synced"; link: BexioContactLink }
  | { status: "error"; link: BexioContactLink; message: string };

export const forgeCustomerImportInputSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.email().refine(isRealCustomerEmail, "A real contact email is required"),
  companyName: z.string().trim().min(1).nullable(),
  phone: z.string().trim().min(1).nullable(),
});
export type ForgeCustomerImportInput = z.infer<typeof forgeCustomerImportInputSchema>;
export const confirmBexioImportSchema = z.object({
  localCustomerId: z.string().trim().min(1).max(200),
  bexioPersonId: z.number().int().positive(),
  bexioCompanyId: z.number().int().positive().nullable(),
  expectedLocalEmail: z.email(),
  expectedRemoteEmail: z.email(),
  contact: forgeCustomerImportInputSchema,
});
export type ConfirmBexioImportInput = z.infer<typeof confirmBexioImportSchema>;
export type BexioImportPreview = ConfirmBexioImportInput;
export interface BexioCredentialProvider {
  getAccessToken(): Promise<string>;
}
export interface BexioContactClient {
  searchContacts(
    query: string,
    contactType: BexioContactType,
    exact?: boolean,
  ): Promise<BexioContact[]>;
  getContact(contactId: number): Promise<BexioContact>;
  ensureRelation(companyId: number, personId: number): Promise<void>;
  getAuthenticatedUser(): Promise<BexioUser>;
  createContact(input: CreateBexioContactInput): Promise<BexioContact>;
  updateContact(
    contactId: number,
    customer: ForgeCustomer,
    contactType: BexioContactType,
  ): Promise<BexioContact>;
}
export interface BexioContactLinkStore {
  getByLocalCustomerId(localCustomerId: string): Promise<BexioContactLink | null>;
  list(): Promise<BexioContactLink[]>;
  upsert(input: UpsertBexioContactLinkInput): Promise<BexioContactLink>;
  updateSyncState(
    localCustomerId: string,
    input: UpdateBexioSyncStateInput,
  ): Promise<BexioContactLink>;
  deleteByLocalCustomerId(localCustomerId: string): Promise<void>;
}
export interface ForgeCustomerAdapter {
  getCustomer(localCustomerId: string): Promise<ForgeCustomer>;
}
export interface ForgeCustomerImportAdapter {
  updateCustomer(
    localCustomerId: string,
    input: ForgeCustomerImportInput,
    expectedEmail: string,
  ): Promise<ForgeCustomer>;
}
export interface BexioContactLinkActions {
  getLink(localCustomerId: string): Promise<BexioContactLink | null>;
  searchContacts(query: string, contactType: BexioContactType): Promise<BexioContact[]>;
  linkContact(
    localCustomerId: string,
    bexioContactId: number,
    contactType: BexioContactType,
  ): Promise<BexioContactLink>;
  createContact(input: CreateAndLinkBexioContactInput): Promise<BexioContactLink>;
  unlinkContact(localCustomerId: string, contactType: BexioContactType): Promise<void>;
  syncContact(localCustomerId: string): Promise<BexioSyncResult>;
  previewImport(localCustomerId: string): Promise<BexioImportPreview>;
  confirmImport(input: ConfirmBexioImportInput): Promise<BexioContactLink>;
}

export type BexioPermission = "read" | "write";
export interface BexioHostAdapter {
  authorize(permission: BexioPermission, customerId?: string): Promise<boolean>;
  /** undefined locks the installation for bulk import, excluding every customer writer. */
  runExclusive<T>(customerId: string | undefined, operation: () => Promise<T>): Promise<T>;
}

export type ForgeCustomerEmailMatch =
  | { status: "not-found" }
  | { status: "customer"; customer: ForgeCustomer }
  | { status: "conflict"; message: string };
export interface ForgeCustomerBulkImportAdapter extends ForgeCustomerImportAdapter {
  findCustomersByEmails(emails: string[]): Promise<Map<string, ForgeCustomerEmailMatch>>;
  createCustomer(input: ForgeCustomerImportInput): Promise<ForgeCustomer>;
}
export interface BexioBulkContactClient extends BexioContactClient {
  listContacts(): Promise<BexioContact[]>;
  listRelations(): Promise<BexioRelation[]>;
}
export type BexioBulkSyncResult = {
  total: number;
  created: number;
  linked: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: { bexioContactId: number; message: string }[];
};
export interface BexioCustomerDirectoryActions {
  listLinks(): Promise<BexioContactLink[]>;
  syncAllContacts(this: void): Promise<BexioBulkSyncResult>;
}

import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import type {
  CustomerUserTable,
  CustomersSchema,
} from "@/components/plugins/customers/server/schema";
import type { Customer } from "@/components/plugins/customers/types";
import {
  containsPattern,
  directoryQuerySchema,
  lockPlugin,
  type DatabaseTransaction,
  type DirectoryQuery,
  type PluginDatabase,
} from "@/components/utils/database";

const idSchema = z.string().min(1).max(250);
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
export type CustomersAction = "read" | "create" | "edit" | "delete" | "verify" | "invite";
export class CustomersError extends Error {
  code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IN_USE" | "STORAGE";
  constructor(code: CustomersError["code"]) {
    super(code);
    this.code = code;
  }
}
export interface CustomerAuthApi {
  createUser(input: {
    headers: Headers;
    body: { name: string; email: string; role: "user"; data: { mustChangePassword: true } };
  }): Promise<{ user: { id: string } }>;
  adminUpdateUser(input: {
    headers: Headers;
    body: { userId: string; data: { name?: string; email?: string; emailVerified?: boolean } };
  }): Promise<unknown>;
  removeUser(input: { headers: Headers; body: { userId: string } }): Promise<unknown>;
}
export interface CustomersServiceOptions<Context> {
  db: PluginDatabase;
  users: CustomerUserTable;
  customers: CustomersSchema;
  /** Every method and auth hook must use this transaction, never the outer connection. */
  authForTransaction(tx: DatabaseTransaction): CustomerAuthApi | Promise<CustomerAuthApi>;
  headers(context: Context): Headers;
  /** Fresh server authority; customer membership is not employee access. */
  authorize(context: Context, action: CustomersAction, id?: string): Promise<boolean>;
  sendInvitation(context: Context, customer: Customer): Promise<void>;
}

export function createCustomersService<Context>(options: CustomersServiceOptions<Context>) {
  const { db, users, customers } = options;
  const selection = {
    id: users.id,
    name: users.name,
    email: users.email,
    emailVerified: users.emailVerified,
    image: users.image,
    banned: users.banned,
    companyName: customers.companyName,
    phoneNumber: customers.phoneNumber,
    street: customers.street,
    city: customers.city,
    addressComplement: customers.addressComplement,
  };
  async function permit(context: Context, action: CustomersAction, id?: string) {
    if (id !== undefined) idSchema.parse(id);
    if (!(await options.authorize(context, action, id))) throw new CustomersError("FORBIDDEN");
  }
  async function guard<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof CustomersError) throw error;
      if (error instanceof z.ZodError) throw new CustomersError("INVALID");
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (cause && typeof cause === "object" && "code" in cause) {
        if (cause.code === "23505") throw new CustomersError("CONFLICT");
        if (["23503", "23001"].includes(String(cause.code))) throw new CustomersError("IN_USE");
      }
      if (
        error &&
        typeof error === "object" &&
        "body" in error &&
        error.body &&
        typeof error.body === "object" &&
        "code" in error.body &&
        error.body.code === "USER_ALREADY_EXISTS"
      )
        throw new CustomersError("CONFLICT");
      throw new CustomersError("STORAGE");
    }
  }
  async function read(tx: DatabaseTransaction, id: string): Promise<Customer> {
    const [row] = await tx
      .select(selection)
      .from(customers)
      .innerJoin(users, eq(users.id, customers.id))
      .where(eq(customers.id, id));
    if (!row) throw new CustomersError("NOT_FOUND");
    return row;
  }
  async function uniqueEmail(tx: DatabaseTransaction, email: string, id?: string) {
    await lockPlugin(tx, "forge-customers");
    const matches = await tx
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.email, email.replace(/[\\%_]/g, "\\$&")));
    if (matches.some((row) => row.id !== id)) throw new CustomersError("CONFLICT");
  }
  async function invite(context: Context, customer: Customer) {
    if (customer.banned) throw new CustomersError("FORBIDDEN");
    try {
      await options.sendInvitation(context, customer);
      return { customer, invitationSent: true };
    } catch {
      return { customer, invitationSent: false };
    }
  }
  function client(context: Context) {
    return {
      list: (input: DirectoryQuery = {}) =>
        guard(async () => {
          await permit(context, "read");
          const { search, pageSize, cursor } = directoryQuerySchema.parse(input);
          const pattern = containsPattern(search);
          const rows = await db
            .select(selection)
            .from(customers)
            .innerJoin(users, eq(users.id, customers.id))
            .where(
              or(
                ilike(users.name, pattern),
                ilike(users.email, pattern),
                ilike(customers.companyName, pattern),
              ),
            )
            .orderBy(users.name, users.id)
            .offset(cursor)
            .limit(pageSize + 1);
          const allowed: Customer[] = [];
          for (const row of rows.slice(0, pageSize))
            if (await options.authorize(context, "read", row.id)) allowed.push(row);
          return {
            items: allowed,
            nextCursor: rows.length > pageSize ? String(cursor + pageSize) : undefined,
          };
        }),
      get: (id: string) =>
        guard(async () => {
          await permit(context, "read", id);
          return read(db, id);
        }),
      create: (input: unknown) =>
        guard(async () => {
          const value = customerInputSchema.parse(input);
          await permit(context, "create");
          const customer = await db.transaction(async (tx) => {
            await permit(context, "create");
            await uniqueEmail(tx, value.email);
            const api = await options.authForTransaction(tx);
            const { user } = await api.createUser({
              headers: options.headers(context),
              body: {
                name: value.name,
                email: value.email,
                role: "user",
                data: { mustChangePassword: true },
              },
            });
            const { name: _name, email: _email, ...profile } = value;
            await tx.insert(customers).values({ ...profile, id: user.id });
            return read(tx, user.id);
          });
          return invite(context, customer);
        }),
      update: (id: string, input: unknown) =>
        guard(async () => {
          const value = customerInputSchema.parse(input);
          await permit(context, "edit", id);
          return db.transaction(async (tx) => {
            await tx
              .select({ id: customers.id })
              .from(customers)
              .where(eq(customers.id, id))
              .for("update");
            await permit(context, "edit", id);
            const current = await read(tx, id);
            if (value.name !== current.name || value.email !== current.email.toLowerCase()) {
              await uniqueEmail(tx, value.email, id);
              const api = await options.authForTransaction(tx);
              await api.adminUpdateUser({
                headers: options.headers(context),
                body: {
                  userId: id,
                  data: {
                    name: value.name,
                    email: value.email,
                    ...(value.email !== current.email.toLowerCase()
                      ? { emailVerified: false }
                      : {}),
                  },
                },
              });
            }
            const { name: _name, email: _email, ...profile } = value;
            await tx.update(customers).set(profile).where(eq(customers.id, id));
            return read(tx, id);
          });
        }),
      setVerified: (id: string, verified: boolean) =>
        guard(async () => {
          z.boolean().parse(verified);
          await permit(context, "verify", id);
          return db.transaction(async (tx) => {
            await tx
              .select({ id: customers.id })
              .from(customers)
              .where(eq(customers.id, id))
              .for("update");
            await permit(context, "verify", id);
            await read(tx, id);
            const api = await options.authForTransaction(tx);
            await api.adminUpdateUser({
              headers: options.headers(context),
              body: { userId: id, data: { emailVerified: verified } },
            });
            return read(tx, id);
          });
        }),
      remove: (id: string) =>
        guard(async () => {
          await permit(context, "delete", id);
          await db.transaction(async (tx) => {
            await tx
              .select({ id: customers.id })
              .from(customers)
              .where(eq(customers.id, id))
              .for("update");
            await permit(context, "delete", id);
            await read(tx, id);
            const api = await options.authForTransaction(tx);
            await tx.delete(customers).where(eq(customers.id, id));
            await api.removeUser({ headers: options.headers(context), body: { userId: id } });
            // Check project references before Better Auth wraps database errors.
          });
        }),
      resendInvitation: (id: string) =>
        guard(async () => {
          await permit(context, "invite", id);
          return invite(context, await read(db, id));
        }),
    };
  }
  return { client };
}

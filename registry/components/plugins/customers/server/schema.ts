import { pgTable, text, type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";

export type CustomerUserTable = PgTable & {
  id: AnyPgColumn<{ data: string; notNull: true }>;
  name: AnyPgColumn<{ data: string; notNull: true }>;
  email: AnyPgColumn<{ data: string; notNull: true }>;
  emailVerified: AnyPgColumn<{ data: boolean; notNull: true }>;
  image: AnyPgColumn<{ data: string }>;
  banned: AnyPgColumn<{ data: boolean }>;
};

/** Instantiate once in the host schema, using its actual Better Auth user table. */
export function createCustomersSchema(user: Pick<CustomerUserTable, "id">) {
  return pgTable("customer_profile", {
    id: text("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    companyName: text("company_name"),
    phoneNumber: text("phone_number"),
    street: text("street"),
    city: text("city"),
    addressComplement: text("address_complement"),
  });
}
export type CustomersSchema = ReturnType<typeof createCustomersSchema>;
export type CustomerProfile = CustomersSchema["$inferSelect"];

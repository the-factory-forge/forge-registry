import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import {
  forgeCustomerSchema,
  forgeCustomerImportInputSchema,
  type ForgeCustomer,
  type ForgeCustomerImportInput,
  type ForgeCustomerEmailMatch,
} from "@/components/connectors/customers-bexio/contracts";
import { BexioApiError } from "@/components/connectors/customers-bexio/server/client.server";
import {
  createCustomersService,
  CustomersError,
  type CustomersServiceOptions,
} from "@/components/plugins/customers/server/service.server";
import type { Customer } from "@/components/plugins/customers/types";

/** Uses Customers' transaction-bound auth and profile creation; no compensating account deletion. */
export function createBexioCustomerProvisioner<Context>(
  options: CustomersServiceOptions<Context> & {
    context: Context;
    mapCustomer(customer: Customer): ForgeCustomer | Promise<ForgeCustomer>;
  },
) {
  const { db, users, customers, context } = options;
  const client = createCustomersService(options).client(context);
  async function map(customer: Customer) {
    const result = forgeCustomerSchema.parse(await options.mapCustomer(customer));
    if (
      result.localCustomerId !== customer.id ||
      result.email.toLowerCase() !== customer.email.toLowerCase()
    )
      throw new BexioApiError("Customer identity mismatch.");
    return result;
  }
  return {
    async getCustomer(id: string) {
      return map(await client.get(id));
    },
    async findCustomersByEmails(emails: string[]): Promise<Map<string, ForgeCustomerEmailMatch>> {
      if (!(await options.authorize(context, "read"))) throw new CustomersError("FORBIDDEN");
      const values = [
        ...new Set(
          z
            .array(z.string().trim().toLowerCase().pipe(forgeCustomerImportInputSchema.shape.email))
            .parse(emails),
        ),
      ];
      const matches = new Map<string, ForgeCustomerEmailMatch>();
      for (let offset = 0; offset < values.length; offset += 100) {
        const rows = await db
          .select({ id: users.id, email: users.email, customerId: customers.id })
          .from(users)
          .leftJoin(customers, eq(customers.id, users.id))
          .where(
            or(
              ...values
                .slice(offset, offset + 100)
                .map((email) => ilike(users.email, email.replace(/[\\%_]/g, "\\$&"))),
            ),
          );
        for (const row of rows) {
          const email = row.email.toLowerCase();
          matches.set(
            email,
            matches.has(email) || !row.customerId
              ? {
                  status: "conflict",
                  message: "This email belongs to an unrelated or ambiguous account.",
                }
              : { status: "customer", customer: await map(await client.get(row.id)) },
          );
        }
      }
      return matches;
    },
    async createCustomer(input: ForgeCustomerImportInput) {
      const value = forgeCustomerImportInputSchema.parse(input);
      const { customer } = await client.create({
        name: value.fullName,
        email: value.email,
        companyName: value.companyName ?? "",
        phoneNumber: value.phone ?? "",
        street: "",
        city: "",
        addressComplement: "",
      });
      return map(customer);
    },
    resendInvitation: client.resendInvitation,
  };
}

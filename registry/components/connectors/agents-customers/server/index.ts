import { z } from "zod";

import {
  agentRecord,
  agentTools,
  agentOperation,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import {
  createCustomersService,
  customerInputSchema,
} from "@/components/plugins/customers/server/service.server";
import { directoryQuerySchema } from "@/components/utils/database";

type Client<Context> = ReturnType<ReturnType<typeof createCustomersService<Context>>["client"]>;
export function createCustomersAgentOperation<Context>(
  options: AgentConnectorOptions<Context, Client<Context>>,
) {
  const { read, write } = agentTools<Context>();
  const values = customerInputSchema.extend(
    Object.fromEntries(
      ["companyName", "phoneNumber", "street", "city", "addressComplement"].map((key) => [
        key,
        z.string().trim().max(2000),
      ]),
    ),
  );
  const query = directoryQuerySchema.extend({
    cursor: z
      .string()
      .regex(/^(0|[1-9]\d*)$/)
      .max(16)
      .optional(),
  });
  const before = (c: Context, i: { id: string }) => options.client(c).get(i.id);
  return agentOperation("customers", "Customers", options.authorize, [
    read("customers_list", query, (c, i) => options.client(c).list(i)),
    read("customers_get", agentRecord, (c, i) => options.client(c).get(i.id)),
    write("customers_create", values, {
      before: async () => null,
      run: (c, i) => options.client(c).create(i),
      effects: [
        "Creates an account and sends an invitation. Delivery can fail after account creation.",
      ],
    }),
    write("customers_update", agentRecord.extend({ values }), {
      before,
      run: (c, i) => options.client(c).update(i.id, i.values),
    }),
    write("customers_set_verified", agentRecord.extend({ verified: z.boolean() }), {
      before,
      run: (c, i) => options.client(c).setVerified(i.id, i.verified),
      effects: ["Changes the account's email verification status."],
    }),
    write("customers_invite", agentRecord, {
      before,
      run: (c, i) => options.client(c).resendInvitation(i.id),
      effects: ["Sends a single-use invitation email."],
    }),
    write("customers_delete", agentRecord, {
      before,
      run: (c, i) => options.client(c).remove(i.id),
      effects: ["Deletes this customer account. Linked projects can prevent deletion."],
    }),
  ]);
}

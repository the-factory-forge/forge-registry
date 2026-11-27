import { bigint, index, integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

import type { CustomersSchema } from "@/components/plugins/customers/server/schema";
import type { OfferInput, IssuedOffer, OfferStatus } from "@/components/plugins/offers/model";
export function createOffersSchema(customers: CustomersSchema) {
  const offers = pgTable(
    "forge_offer",
    {
      id: text("id").primaryKey(),
      number: serial("number").notNull().unique(),
      customerId: text("customer_id")
        .notNull()
        .references(() => customers.id, { onDelete: "restrict" }),
      version: integer("version").notNull().default(1),
      currency: text("currency").notNull(),
      status: text("status").$type<OfferStatus>().notNull().default("draft"),
      draft: jsonb("draft").$type<OfferInput>(),
      issued: jsonb("issued").$type<IssuedOffer>(),
      issuedCustomer: text("issued_customer"),
      sentAt: text("sent_at"),
      title: text("title").notNull(),
      date: text("date").notNull(),
      validUntil: text("valid_until").notNull(),
      net: bigint("net", { mode: "number" }).notNull(),
      gross: bigint("gross", { mode: "number" }).notNull(),
    },
    (t) => [index("forge_offer_owner").on(t.customerId, t.number)],
  );
  const documents = pgTable("forge_offer_document", {
    offerId: text("offer_id")
      .primaryKey()
      .references(() => offers.id, { onDelete: "cascade" }),
    pdf: text("pdf_base64").notNull(),
  });
  return { offers, documents };
}
export type OffersSchema = ReturnType<typeof createOffersSchema>;

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, or, isNull } from "drizzle-orm";
import { z } from "zod";

import type {
  CustomersSchema,
  CustomerUserTable,
} from "@/components/plugins/customers/server/schema";
import {
  offerInputSchema,
  offerTotals,
  offerStatuses,
  offerSortFields,
  offerDefaultSort,
  issueOffer,
  type Offer,
  type IssuedOffer,
  type OfferInput,
  type OfferRow,
  type OfferSender,
} from "@/components/plugins/offers/model";
import type { OffersSchema } from "@/components/plugins/offers/server/schema";
import {
  directoryQuerySchema,
  containsPattern,
  type PluginDatabase,
  type DatabaseTransaction,
} from "@/components/utils/database";
const key = z.string().min(1).max(250);
const revision = z.int().positive();
const querySchema = directoryQuerySchema.extend({
  customerId: key.optional(),
  status: z.enum(offerStatuses).optional(),
  sort: z
    .object({ field: z.enum(offerSortFields), direction: z.enum(["asc", "desc"]) })
    .default(offerDefaultSort),
});
export type OffersQuery = z.input<typeof querySchema>;
type Action = "list" | "read" | "create" | "edit" | "issue" | "decide" | "send";
export interface OffersServiceOptions<C> extends OfferSender {
  db: PluginDatabase;
  schema: OffersSchema;
  customers: CustomersSchema;
  users: CustomerUserTable;
  currency: string;
  locale: string;
  authorize: (
    context: C,
    action: Action,
    customerId?: string,
    offerId?: string,
  ) => Promise<boolean>;
  renderPdf: (issued: IssuedOffer) => Promise<Uint8Array>;
  sendEmail?: (issued: IssuedOffer, pdf: Uint8Array) => Promise<void>;
}
function projection(input: OfferInput) {
  const { net, gross } = offerTotals(input.lines);
  return { title: input.title, date: input.date, validUntil: input.validUntil, net, gross };
}
export function createOffersService<C>({
  db,
  schema: { offers, documents },
  customers,
  users,
  currency,
  locale,
  issuer,
  issuerAddress,
  authorize,
  renderPdf,
  sendEmail,
}: OffersServiceOptions<C>) {
  z.string()
    .regex(/^[A-Z]{3}$/)
    .parse(currency);
  new Intl.NumberFormat(locale, { style: "currency", currency });
  z.string().trim().min(1).parse(issuer);
  const address = z.string().trim().max(1000).optional().parse(issuerAddress);
  function client(context: C) {
    async function permit(action: Action, owner?: string, id?: string) {
      if (!(await authorize(context, action, owner, id))) throw new Error("FORBIDDEN");
    }
    async function read(tx: DatabaseTransaction, id: string, action: Action, lock = false) {
      const q = tx
        .select()
        .from(offers)
        .where(eq(offers.id, key.parse(id)));
      const [row] = await (lock ? q.for("update") : q);
      if (!row) throw new Error("NOT_FOUND");
      await permit(action, row.customerId, row.id);
      return row;
    }
    function mutate(
      id: string,
      version: number,
      action: Action,
      fn: (tx: DatabaseTransaction, offer: Offer) => Promise<Partial<typeof offers.$inferInsert>>,
    ) {
      revision.parse(version);
      return db.transaction(async (tx) => {
        const row = await read(tx, id, action, true);
        if (row.version !== version) throw new Error("CONFLICT");
        const patch = await fn(tx, row);
        const [result] = await tx
          .update(offers)
          .set({ ...patch, version: version + 1 })
          .where(eq(offers.id, id))
          .returning();
        return result;
      });
    }
    async function pdf(tx: DatabaseTransaction, id: string) {
      const [doc] = await tx.select().from(documents).where(eq(documents.offerId, id));
      if (!doc) throw new Error("NOT_ISSUED");
      return Buffer.from(doc.pdf, "base64");
    }
    return {
      async list(input: OffersQuery = {}) {
        const q = querySchema.parse(input);
        await permit("list", q.customerId);
        const pattern = containsPattern(q.search);
        const number = Number(/^(?:#(?:of-)?)?(\d{1,10})$/i.exec(q.search)?.[1]);
        const direction = q.sort.direction === "asc" ? asc : desc;
        const rows = await db
          .select({
            id: offers.id,
            number: offers.number,
            customerId: offers.customerId,
            issuedCustomer: offers.issuedCustomer,
            company: customers.companyName,
            contact: users.name,
            title: offers.title,
            date: offers.date,
            validUntil: offers.validUntil,
            currency: offers.currency,
            net: offers.net,
            gross: offers.gross,
            status: offers.status,
            sentAt: offers.sentAt,
          })
          .from(offers)
          .innerJoin(customers, eq(customers.id, offers.customerId))
          .innerJoin(users, eq(users.id, customers.id))
          .where(
            and(
              q.customerId ? eq(offers.customerId, q.customerId) : undefined,
              q.status ? eq(offers.status, q.status) : undefined,
              q.search
                ? or(
                    ilike(offers.title, pattern),
                    ilike(offers.issuedCustomer, pattern),
                    and(
                      isNull(offers.issuedCustomer),
                      or(ilike(customers.companyName, pattern), ilike(users.name, pattern)),
                    ),
                    number <= 2147483647 ? eq(offers.number, number) : undefined,
                  )
                : undefined,
            ),
          )
          .orderBy(direction(offers[q.sort.field]), asc(offers.id))
          .offset(q.cursor)
          .limit(q.pageSize + 1);
        const items: OfferRow[] = [];
        for (const { issuedCustomer, company, contact, sentAt, ...row } of rows.slice(
          0,
          q.pageSize,
        )) {
          if (await authorize(context, "read", row.customerId, row.id))
            items.push({
              ...row,
              customer: issuedCustomer ?? (company || contact),
              sent: !!sentAt,
            });
        }
        return {
          items,
          nextCursor: rows.length > q.pageSize ? String(q.cursor + q.pageSize) : undefined,
        };
      },
      get: (id: string) => read(db, id, "read"),
      async create(owner: string, input: unknown) {
        key.parse(owner);
        const draft = offerInputSchema.parse(input);
        await permit("create", owner);
        const [row] = await db
          .insert(offers)
          .values({ id: randomUUID(), customerId: owner, currency, draft, ...projection(draft) })
          .returning();
        return row;
      },
      save: (id: string, version: number, input: unknown) =>
        mutate(id, version, "edit", async (_tx, row) => {
          const draft = offerInputSchema.parse(input);
          return { draft, ...(!row.issued && projection(draft)) };
        }),
      issue: (id: string, version: number) =>
        mutate(id, version, "issue", async (tx, row) => {
          const [recipient] = await tx
            .select({
              id: customers.id,
              name: users.name,
              email: users.email,
              companyName: customers.companyName,
              street: customers.street,
              city: customers.city,
              addressComplement: customers.addressComplement,
            })
            .from(customers)
            .innerJoin(users, eq(users.id, customers.id))
            .where(eq(customers.id, row.customerId));
          if (!recipient) throw new Error("NOT_FOUND");
          const issued = issueOffer(row, recipient, {
            issuer,
            issuerAddress: address,
            locale,
            issuedAt: new Date().toISOString(),
            token: randomUUID(),
          }).issued!;
          const bytes = Buffer.from(await renderPdf(issued));
          if (!bytes.length) throw new Error("EMPTY_PDF");
          const value = bytes.toString("base64");
          await tx
            .insert(documents)
            .values({ offerId: id, pdf: value })
            .onConflictDoUpdate({ target: documents.offerId, set: { pdf: value } });
          return {
            issued,
            draft: null,
            sentAt: null,
            status: "pending",
            issuedCustomer: recipient.companyName || recipient.name,
            ...projection(issued.content),
          };
        }),
      decide: (id: string, version: number, decision: "accepted" | "declined") =>
        mutate(id, version, "decide", async (_tx, row) => {
          if (!row.issued || row.status !== "pending") throw new Error("NOT_PENDING");
          return { status: z.enum(["accepted", "declined"]).parse(decision) };
        }),
      document: (id: string) =>
        db.transaction(async (tx) => {
          const row = await read(tx, id, "read", true);
          return { number: row.number, bytes: await pdf(tx, id) };
        }),
      send: (id: string, issuedToken: string) =>
        db.transaction(async (tx) => {
          const row = await read(tx, id, "send", true);
          if (!row.issued || row.issued.token !== key.parse(issuedToken))
            throw new Error("CONFLICT");
          if (row.sentAt) return row;
          if (!sendEmail) throw new Error("MAIL_UNAVAILABLE");
          await sendEmail(row.issued, await pdf(tx, id));
          const [updated] = await tx
            .update(offers)
            .set({ sentAt: new Date().toISOString() })
            .where(eq(offers.id, id))
            .returning();
          return updated;
        }),
    };
  }
  return { client };
}

import { z } from "zod";

import type { Customer } from "@/components/plugins/customers/types";
import { customerDisplayName } from "@/components/plugins/customers/utils";

export const offerStatuses = ["draft", "pending", "accepted", "declined"] as const;
export type OfferStatus = (typeof offerStatuses)[number];
export const offerSortFields = [
  "number",
  "title",
  "date",
  "validUntil",
  "status",
  "net",
  "gross",
] as const;
export const offerDefaultSort = { field: "number", direction: "desc" } as const;
export const offerLineSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  quantityMilli: z.int().min(1).max(10_000_000),
  unit: z.string().trim().max(40),
  priceMinor: z.int().min(0).max(2_147_483_647),
  discountBps: z.int().min(0).max(10000),
  taxBps: z.int().min(0).max(10000),
});
export const offerInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    date: z.iso.date(),
    validUntil: z.iso.date(),
    terms: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    lines: z.array(offerLineSchema).max(200),
  })
  .refine((value) => value.validUntil >= value.date, {
    path: ["validUntil"],
    message: "Invalid validity date",
  });
export type OfferLine = z.output<typeof offerLineSchema>;
export type OfferInput = z.output<typeof offerInputSchema>;
export type OfferRecipient = Pick<
  Customer,
  "id" | "name" | "companyName" | "email" | "street" | "addressComplement" | "city"
>;
export function recipientAddressLines(r: OfferRecipient) {
  return [customerDisplayName(r), r.street, r.addressComplement, r.city].filter(
    (line): line is string => !!line,
  );
}
export function recipientSnapshot(customer: OfferRecipient): OfferRecipient {
  const { id, name, companyName, email, street, addressComplement, city } = customer;
  return { id, name, companyName, email, street, addressComplement, city };
}
export function emptyLine(): OfferLine {
  return {
    description: "",
    quantityMilli: 1000,
    unit: "",
    priceMinor: 0,
    discountBps: 0,
    taxBps: 0,
  };
}
export function emptyOffer(date: string): OfferInput {
  return { title: "", date, validUntil: date, terms: "", notes: "", lines: [] };
}
// Half-up rounding, once for the discounted line and once for its tax.
function rounded(n: bigint, d: bigint) {
  return Number((n + d / 2n) / d);
}
export function lineAmounts(line: OfferLine) {
  const net = rounded(
    BigInt(line.priceMinor) * BigInt(line.quantityMilli) * BigInt(10000 - line.discountBps),
    10_000_000n,
  );
  const tax = rounded(BigInt(net) * BigInt(line.taxBps), 10_000n);
  return { net, tax, gross: net + tax };
}
export function offerTotals(lines: readonly OfferLine[]) {
  let net = 0,
    gross = 0;
  const rates = new Map<number, number>();
  for (const line of lines) {
    const amounts = lineAmounts(line);
    net += amounts.net;
    gross += amounts.gross;
    rates.set(line.taxBps, (rates.get(line.taxBps) ?? 0) + amounts.tax);
  }
  return {
    net,
    gross,
    taxes: [...rates].sort(([a], [b]) => a - b).map(([rate, amount]) => ({ rate, amount })),
  };
}
export function formatOfferNumber(number: number) {
  return `#of-${number}`;
}

export function moneyFormatter(currency: string, locale: string) {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return { digits, format: (minor: number) => format.format(minor / 10 ** digits) };
}
export interface OfferSender {
  issuer: string;
  issuerAddress?: string;
}
export interface IssuedOffer extends OfferSender {
  token: string;
  number: number;
  currency: string;
  locale: string;
  issuedAt: string;
  recipient: OfferRecipient;
  content: OfferInput;
}
export interface Offer {
  id: string;
  number: number;
  customerId: string;
  currency: string;
  version: number;
  status: OfferStatus;
  draft: OfferInput | null;
  issued: IssuedOffer | null;
  sentAt: string | null;
}
export function displayedContent(offer: Offer) {
  return offer.issued?.content ?? offer.draft!;
}
export function issueOffer(
  offer: Offer,
  customer: OfferRecipient,
  metadata: Pick<IssuedOffer, "locale" | "issuer" | "issuerAddress" | "issuedAt" | "token">,
): Offer {
  if (!offer.draft || !offer.draft.lines.length || customer.id !== offer.customerId)
    throw new Error("INVALID");
  const content = offerInputSchema.parse(offer.draft);
  return {
    ...offer,
    status: "pending",
    sentAt: null,
    draft: null,
    version: offer.version + 1,
    issued: {
      ...metadata,
      number: offer.number,
      currency: offer.currency,
      recipient: recipientSnapshot(customer),
      content,
    },
  };
}
export interface OfferRow {
  id: string;
  number: number;
  customerId: string;
  customer: string;
  title: string;
  date: string;
  validUntil: string;
  currency: string;
  net: number;
  gross: number;
  status: OfferStatus;
  sent: boolean;
}
export function offerRow(offer: Offer, customer: OfferRecipient): OfferRow {
  const content = displayedContent(offer);
  const recipient = offer.issued?.recipient ?? customer;
  const { net, gross } = offerTotals(content.lines);
  return {
    id: offer.id,
    number: offer.number,
    customerId: offer.customerId,
    customer: recipient.companyName || recipient.name,
    title: content.title,
    date: content.date,
    validUntil: content.validUntil,
    currency: offer.currency,
    net,
    gross,
    status: offer.status,
    sent: !!offer.sentAt,
  };
}

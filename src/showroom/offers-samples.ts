import {
  emptyLine,
  emptyOffer,
  issueOffer,
  type Offer,
  type OfferRecipient,
  type OfferSender,
} from "@/components/plugins/offers/model";
export const showroomOfferSender: OfferSender = {
  issuer: "The Corner Factory SA",
  issuerAddress: "Rue de Saint-Guérin 6\n1950 Sion",
};

export function sampleOffers(customers: OfferRecipient[]): Offer[] {
  const sample: Offer = {
    id: "studio",
    number: 1,
    currency: "CHF",
    customerId: customers[0].id,
    version: 1,
    status: "draft",
    sentAt: null,
    issued: null,
    draft: {
      ...emptyOffer("2026-11-11"),
      title: "Studio website",
      validUntil: "2026-11-25",
      terms: "Payment by invoice.",
      lines: [
        {
          ...emptyLine(),
          description: "Website delivery",
          unit: "project",
          priceMinor: 149000,
          taxBps: 810,
        },
        {
          ...emptyLine(),
          description: "Monthly hosting",
          quantityMilli: 12000,
          unit: "month",
          priceMinor: 3900,
          taxBps: 810,
        },
        {
          ...emptyLine(),
          description: "Additional service",
          quantityMilli: 12000,
          unit: "month",
          priceMinor: 1000,
          discountBps: 10000,
          taxBps: 810,
        },
      ],
    },
  };
  return [
    issueOffer(sample, customers[0], {
      ...showroomOfferSender,
      locale: "en-CH",
      issuedAt: "2026-11-11T10:00:00Z",
      token: "studio-issued",
    }),
    {
      ...sample,
      id: "materials",
      number: 2,
      draft: { ...emptyOffer("2026-11-12"), title: "Printed materials" },
    },
  ];
}

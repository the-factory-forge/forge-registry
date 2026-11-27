import { renderEmail, type MailingBrand } from "@/components/plugins/mailing";
import type { OutgoingEmail } from "@/components/plugins/mailing/resend.server";
import { formatOfferNumber, type IssuedOffer } from "@/components/plugins/offers/model";
export function createOfferMailer(options: {
  brand: MailingBrand;
  deliver: (email: OutgoingEmail) => Promise<void>;
  copy?: (offer: IssuedOffer) => { subject: string; message: string };
}) {
  return async (offer: IssuedOffer, pdf: Uint8Array) => {
    const { subject, message } = options.copy?.(offer) ?? {
      subject: offer.content.title,
      message: "Your offer is attached as a PDF.",
    };
    const body = await renderEmail({
      brand: options.brand,
      locale: offer.locale,
      heading: subject,
      preview: message,
      paragraphs: [message],
      details: [{ label: "Number", value: formatOfferNumber(offer.number) }],
    });
    await options.deliver({
      id: "offer/" + offer.token,
      to: offer.recipient.email,
      subject,
      ...body,
      attachments: [{ filename: "offer-" + offer.number + ".pdf", content: pdf }],
    });
  };
}

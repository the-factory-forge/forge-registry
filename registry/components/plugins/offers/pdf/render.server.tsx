import { renderToBuffer } from "@react-pdf/renderer";

import type { OfferLabels } from "@/components/plugins/offers/labels";
import type { IssuedOffer } from "@/components/plugins/offers/model";
import { OfferDocument } from "@/components/plugins/offers/pdf/document";
export function renderOfferPdf(issued: IssuedOffer, labels?: Partial<OfferLabels>, logo?: string) {
  return renderToBuffer(<OfferDocument offer={issued} labels={labels} logo={logo} />);
}

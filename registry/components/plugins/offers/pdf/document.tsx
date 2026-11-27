import { Document, Image as PdfImage, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { offerLabels, type OfferLabels } from "@/components/plugins/offers/labels";
import {
  lineAmounts,
  offerTotals,
  recipientAddressLines,
  formatOfferNumber,
  moneyFormatter,
  type IssuedOffer,
} from "@/components/plugins/offers/model";
const style = StyleSheet.create({
  page: { padding: 40, paddingBottom: 50, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.35 },
  letterhead: { marginBottom: 32 },
  logo: {
    width: 148,
    height: 44,
    objectFit: "contain",
    objectPosition: "left center",
    marginBottom: 9,
  },
  sender: { width: "48%" },
  senderName: { fontFamily: "Helvetica-Bold" },
  recipient: { alignSelf: "flex-end", width: "43%", marginTop: 14 },
  title: { fontSize: 22, marginBottom: 14 },
  heading: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 5 },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#aaaaaa",
  },
  cell: { width: "14%", textAlign: "right" },
  description: { width: "32%", paddingRight: 5 },
  summary: { textAlign: "right", marginTop: 5 },
  footer: { position: "absolute", bottom: 20, right: 40, fontSize: 9 },
});
export function OfferDocument({
  offer,
  labels: overrides,
  logo,
}: {
  offer: IssuedOffer;
  logo?: string;
  labels?: Partial<OfferLabels>;
}) {
  const l = { ...offerLabels, ...overrides };
  const { recipient: r, content: c } = offer;
  const money = moneyFormatter(offer.currency, offer.locale).format;
  const decimal = new Intl.NumberFormat(offer.locale, { maximumFractionDigits: 3 });
  const date = (value: string) =>
    new Intl.DateTimeFormat(offer.locale, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(value + "T00:00:00Z"),
    );
  const totals = offerTotals(c.lines);
  return (
    <Document
      title={c.title}
      author={offer.issuer}
      creationDate={new Date(offer.issuedAt)}
      modificationDate={new Date(offer.issuedAt)}
    >
      <Page size="A4" style={style.page}>
        <View style={style.letterhead}>
          {logo && <PdfImage src={logo} style={style.logo} />}
          <View style={style.sender}>
            <Text style={style.senderName}>{offer.issuer}</Text>
            {offer.issuerAddress && <Text>{offer.issuerAddress}</Text>}
          </View>
          <View style={style.recipient}>
            {recipientAddressLines(r).map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </View>
        </View>
        <Text style={style.title}>
          {l.issued} {formatOfferNumber(offer.number)}
        </Text>
        <Text style={style.heading}>{c.title}</Text>
        <Text>
          {l.date} · {date(c.date)}
        </Text>
        <Text>
          {l.validUntil} · {date(c.validUntil)}
        </Text>
        <View style={style.row} minPresenceAhead={25}>
          {[l.description, l.quantity, l.price, l.discount, l.tax, l.net].map((v, i) => (
            <Text key={v} style={i === 0 ? style.description : style.cell}>
              {v}
            </Text>
          ))}
        </View>
        {c.lines.map((line, i) => (
          <View key={i} style={style.row}>
            <Text style={style.description}>{line.description}</Text>
            {[
              decimal.format(line.quantityMilli / 1000) + " " + line.unit,
              money(line.priceMinor),
              decimal.format(line.discountBps / 100) + "%",
              decimal.format(line.taxBps / 100) + "%",
              money(lineAmounts(line).net),
            ].map((v, j) => (
              <Text key={j} style={style.cell}>
                {v}
              </Text>
            ))}
          </View>
        ))}
        <View wrap={false}>
          <Text style={style.summary}>
            {l.net} {money(totals.net)}
          </Text>
          {totals.taxes.map((t) => (
            <Text key={t.rate} style={style.summary}>
              {l.taxAmount} {decimal.format(t.rate / 100)}% {money(t.amount)}
            </Text>
          ))}
          <Text style={style.summary}>
            {l.gross} {money(totals.gross)}
          </Text>
        </View>
        {[
          [l.terms, c.terms],
          [l.notes, c.notes],
        ].map(
          ([heading, value]) =>
            value && (
              <View key={heading}>
                <Text style={style.heading} minPresenceAhead={16}>
                  {heading}
                </Text>
                <Text>{value}</Text>
              </View>
            ),
        )}
        <Text
          fixed
          style={style.footer}
          render={({ pageNumber, totalPages }) => pageNumber + " / " + totalPages}
        />
      </Page>
    </Document>
  );
}

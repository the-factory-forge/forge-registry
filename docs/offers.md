# Offers

Staff create offers for an existing Customers profile. The [showroom](/en/offers) includes a priced example and simulated email. The customer’s Offers tab uses the same table and supplies its customer ID when creating an offer.

## Installation

Install the UI with `shadcn add @forge/offers`. Add `@forge/offers-storage` for PostgreSQL, `@forge/offers-pdf` for A4 generation, `@forge/offers-products` for catalog lines, and `@forge/offers-mailing` for delivery. The UI can use host callbacks independently.

Compose the schema with the same customer profile and auth user table used by Customers. Export both tables to the host’s Drizzle configuration, then generate, review and apply the host migration. Each customer foreign key restricts deletion while offers exist.

```ts
import { createOfferMailer } from "@/components/connectors/offers-mailing/server";
import { sendResendEmail } from "@/components/plugins/mailing/resend.server";
import { renderOfferPdf } from "@/components/plugins/offers/pdf/render.server";
import { createOffersSchema, createOffersService } from "@/components/plugins/offers/server";

const schema = createOffersSchema(customers);
const sender = { issuer: company.legalName, issuerAddress: company.postalAddress };
const service = createOffersService({
  db,
  schema,
  customers,
  users,
  authorize,
  ...sender,
  currency,
  locale,
  renderPdf: (issued) => renderOfferPdf(issued, documentLabels, company.printLogo),
  sendEmail: createOfferMailer({
    brand,
    copy: localizedOfferEmail,
    deliver: (email) => sendResendEmail(mailConfig, email),
  }),
});
```

Bind `service.client(staffContext)` to authenticated server handlers. Enforce `list` for directory access and `read` for each returned record. Global lists pass an undefined owner to the list guard. Check create, edit, issue, decide and send permissions separately. The service reads the persisted customer on writes. Supply trusted sender identity, currency, locale, translations and email credentials from host configuration.

## UI and routes

- Pass the same `sender` to `OfferEditor` and `OfferDetail`. Its optional `issuerAddress` is a multiline postal address. The editor and printed drafts show the current sender and Customers address. The detail screen hides both address blocks. The recipient block uses the company name when available, otherwise the contact name, followed by the postal address. Printed issued offers use the addresses captured at issue. Older issued offers show the sender name they recorded.
- Bind `OffersList` to `list({ customerId, search, status, sort, cursor, pageSize })`. The result provides `items` and `nextCursor`. Store filters, sort and page in the route. An authorized page may be empty and still have a next cursor.
- Add `sectionHrefs.offers` and `offersContent` to `CustomerDetailPage` and mount the same list scoped to that customer. Installing Customers alone leaves this section hidden.
- Mount `OfferEditor` for creation. Supply accessible customers and their profile links. Map creation to `create(customerId, values)`, refresh and navigate to detail.
- Pass `onSave(version, values)` to `OfferDetail` for authorized inline editing and bind it to `save(id, version, values)`. Refresh the offer before resolving the callback. The detail replaces the former Edit link supplied by `editHref`. Cancel discards local changes. A stale save rejects with `CONFLICT` and preserves local input. Reload the latest record before retrying.
- Pass `onDelete(id, version)` only when the host authorizes deletion. Verify the stored customer ownership and the submitted version, then refresh and return to the directory. The Actions card confirms deletion before calling the host.
- Add `OfferProductPicker` through `renderProductPicker` on the creation form or detail, with authorized catalog products localized to the document language and priced in the offer currency. Check the unit price of an unpriced product. Each line is an editable copy.
- Bind `OfferDetail` to issue, decide and send. Omit callbacks for actions the actor cannot perform. Return `document(id).bytes` from an authorized route with `Content-Type: application/pdf`, an inline filename and `Cache-Control: private, no-store`. Pass the same-origin route as `pdfHref` so Preview opens the PDF in a new tab and Download saves it. If the host prepares the PDF asynchronously, `pdfFallback` can show progress or a retry button in the PDF section. The sidebar groups offer actions and PDF controls in one card, beside the document on wide screens and above it on narrow screens. Actions starts open and remembers the user’s choice across offers in the same browser. The toggle sits level with the status badge and collapses to an icon when closed. On wide screens the toolbar stays visible and the panel keeps its border while the contents scroll beneath their section headings. Closing it gives the document the full width and preserves unsaved edits.

## Issuance and delivery

Drafts use current customer details. Issue freezes the recipient and the commercial terms and generates the PDF in the same transaction. A failed render preserves the draft and any existing issued copy. Issue requires at least one line. Quantities use thousandths of a unit, prices use currency minor units, and discount and tax use basis points. Net after discount and tax round half up per line. Hosts supply their own applicable rates.

The first PDF page places the sender in the upper left and the recipient lower on the right. Supply a print-ready PNG or JPEG as the renderer’s optional third argument, for example a data URI from the host’s logo asset. The logo appears above the sender on the PDF only. Printing, download and email use the same stored PDF until reissue.

Staff can save another draft under the same number after issuance. The directory, PDF, email and decision refer to the issued copy until reissue. Reissue replaces the document and sets the offer to Pending with a fresh delivery token. Only pending offers can be accepted or declined.

The send handler takes the issued token the staff member reviewed. It locks the record, sends the stored bytes to the frozen email address, and marks it sent after the provider accepts the request. Repeating a completed send returns the existing receipt. After an ambiguous provider failure, retry with the same token, sender configuration and message copy within the transport’s idempotency window. Reconcile with the provider before retrying outside that window. A Sent indicator records provider acceptance.

Run the Offers model/PDF, browser and PostgreSQL tests for pricing, document isolation, access and delivery.

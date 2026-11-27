import { useNavigate } from "@tanstack/react-router";
import { RotateCcwIcon } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { z } from "zod";

import { OfferProductPicker } from "@/components/connectors/offers-products";
import {
  OfferEditor,
  OfferDetail,
  OffersList,
  formatOfferNumber,
  issueOffer,
  offerStatuses,
  offerRow,
  offerSortFields,
  offerDefaultSort,
  type Offer,
  type IssuedOffer,
} from "@/components/plugins/offers";
import { catalogProduct } from "@/components/plugins/products/model";
import { buttonClass } from "@/components/utils/table-controls";
import { sortTableRows } from "@/components/utils/table-sort-state";
import { showroomOfferSender } from "@/showroom/offers-samples";
import { usePluginsPreview } from "@/showroom/plugins-preview";
import { getProductsPreviewStore } from "@/showroom/products-preview";
import {
  ShowroomLink,
  useShowroomParams,
  useShowroomQuery,
  useShowroomTableSort,
  useShowroomTablePage,
} from "@/showroom/routing";

export function OffersDirectory({ customerId }: { customerId?: string }) {
  const state = usePluginsPreview();
  const { locale } = useShowroomParams();
  const { query, update } = useShowroomQuery();
  const { page, search, setPage, setSearch } = useShowroomTablePage("offers");
  const order = useShowroomTableSort("offers", offerSortFields);
  const status = z.enum(offerStatuses).optional().catch(undefined).parse(query.status);
  const base = "/" + locale + "/offers";
  const q = search.trim().toLowerCase();
  const rows = state.offers
    .filter((r) => !customerId || r.customerId === customerId)
    .map((r) =>
      offerRow(
        r,
        state.customers.find((c) => c.id === r.customerId)!,
      ),
    )
    .filter(
      (r) =>
        (!status || r.status === status) &&
        (q === formatOfferNumber(r.number) ||
          [r.title, r.customer, String(r.number)].some((v) => v.toLowerCase().includes(q))),
    );
  const sorted = sortTableRows(
    rows,
    order.sort ?? offerDefaultSort,
    (r, f) => r[f],
    (r) => r.id,
    locale,
  );
  const size = 10;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return (
    <OffersList
      {...order}
      customerId={customerId}
      rows={sorted.slice((current - 1) * size, current * size)}
      search={search}
      onSearchChange={setSearch}
      status={status}
      onStatusChange={(s) => update({ status: s, offersPage: undefined })}
      locale={locale}
      linkComponent={ShowroomLink}
      loading={state.directoryState === "loading"}
      error={state.directoryState === "error" ? "Unable to load offers." : undefined}
      createHref={
        state.showActions
          ? base + "/new" + (customerId ? "?customerId=" + encodeURIComponent(customerId) : "")
          : undefined
      }
      getCustomerHref={(id) => "/" + locale + "/customers/" + id}
      getOfferHref={(id) => base + "/" + id}
      pagination={{
        page: current,
        pageCount: pages,
        previousDisabled: current === 1,
        nextDisabled: current === pages,
        onPrevious: () => setPage(current - 1),
        onNext: () => setPage(current + 1),
      }}
    />
  );
}
function useIssuedPdf(issued: IssuedOffer | null) {
  const [result, setResult] = useState<{ token: string; url?: string; error?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!issued) return;
    let active = true;
    let url: string | undefined;
    async function prepare(value: IssuedOffer) {
      const [{ pdf }, { OfferDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/plugins/offers/pdf/document"),
      ]);
      const blob = await pdf(
        <OfferDocument offer={value} logo="/showroom/offers/sender-logo.png" />,
      ).toBlob();
      if (active) {
        url = URL.createObjectURL(blob);
        setResult({ token: value.token, url });
      }
    }
    void prepare(issued).catch(() => {
      if (active) setResult({ token: issued.token, error: true });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [issued, attempt]);
  return {
    result: result?.token === issued?.token ? result : undefined,
    retry: () => setAttempt((v) => v + 1),
  };
}
export function OffersPreview() {
  const state = usePluginsPreview();
  const { locale, segments } = useShowroomParams();
  const { query } = useShowroomQuery();
  const navigate = useNavigate();
  const [id, tab] = segments;
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));
  const original = state.offers.find((o) => o.id === id);
  const { result, retry } = useIssuedPdf(original?.issued ?? null);
  const base = "/" + locale + "/offers";
  const to = (path: string) => navigate({ href: path });
  if (!id)
    return (
      <div className="showroom-page">
        <OffersDirectory />
      </div>
    );
  if (
    (id !== "new" && !original) ||
    (tab && tab !== "edit") ||
    segments.length > 2 ||
    (id === "new" && tab)
  )
    return <p>Offer not found.</p>;
  const owner =
    original?.customerId ?? z.string().optional().catch(undefined).parse(query.customerId);
  const customer = state.customers.find((c) => c.id === owner);
  if (owner && !customer) return <p>Customer not found.</p>;
  async function change(version: number, apply: (o: Offer) => Offer | null) {
    await state.beforeAction();
    if (!original || !state.showActions) throw new Error("FORBIDDEN");
    state.updateOffer(original.id, version, apply);
  }
  const renderProductPicker: NonNullable<
    ComponentProps<typeof OfferEditor>["renderProductPicker"]
  > = (add) => (
    <OfferProductPicker
      products={getProductsPreviewStore().rows.map((product) => catalogProduct(product, locale))}
      onAdd={add}
    />
  );
  if (id === "new" || tab === "edit")
    return (
      <div className="showroom-page">
        {state.showActions ? (
          <OfferEditor
            sender={showroomOfferSender}
            key={id + ":" + owner}
            offer={original}
            customerId={owner}
            customers={state.customers}
            today={today}
            currency="CHF"
            locale={locale}
            backHref={
              original
                ? base + "/" + id
                : owner
                  ? "/" + locale + "/customers/" + owner + "/offers"
                  : base
            }
            getCustomerHref={(c) => "/" + locale + "/customers/" + c}
            linkComponent={ShowroomLink}
            renderProductPicker={renderProductPicker}
            onDelete={
              original
                ? async (_id, version) => {
                    await change(version, () => null);
                    await to(base);
                  }
                : undefined
            }
            onSave={async (customerId, values, version) => {
              if (original) {
                await change(version!, (o) => ({ ...o, draft: values, version: o.version + 1 }));
                await to(base + "/" + id);
              } else {
                await state.beforeAction();
                const key = crypto.randomUUID();
                state.addOffer(key, customerId, values);
                await to(base + "/" + key);
              }
            }}
          />
        ) : (
          <p>Offer editing is unavailable.</p>
        )}
      </div>
    );
  const offer = original!;
  return (
    <div className="showroom-page showroom-page-with-sidebar">
      <OfferDetail
        sender={showroomOfferSender}
        offer={offer}
        customer={customer!}
        locale={locale}
        backHref={base}
        customerHref={"/" + locale + "/customers/" + owner}
        onSave={
          state.showActions
            ? (version, values) =>
                change(version, (o) => ({ ...o, draft: values, version: o.version + 1 }))
            : undefined
        }
        onDelete={
          state.showActions
            ? async (_id, version) => {
                await change(version, () => null);
                await to(base);
              }
            : undefined
        }
        renderProductPicker={renderProductPicker}
        pdfHref={result?.url}
        pdfFallback={
          result?.error ? (
            <button type="button" className={buttonClass} onClick={retry}>
              <RotateCcwIcon aria-hidden="true" />
              Retry PDF
            </button>
          ) : (
            <output className="px-3 py-2 text-sm text-muted-foreground">Preparing PDF…</output>
          )
        }
        linkComponent={ShowroomLink}
        onIssue={
          state.showActions
            ? (version) =>
                change(version, (o) =>
                  issueOffer(o, customer!, {
                    ...showroomOfferSender,
                    locale,
                    issuedAt: new Date().toISOString(),
                    token: crypto.randomUUID(),
                  }),
                )
            : undefined
        }
        onDecision={
          state.showActions
            ? (version, decision) =>
                change(version, (o) => {
                  if (o.status !== "pending") throw new Error("NOT_PENDING");
                  return { ...o, status: decision, version: o.version + 1 };
                })
            : undefined
        }
        onSend={
          state.showActions
            ? async (token) => {
                if (!result?.url) throw new Error("PDF_UNAVAILABLE");
                await change(offer.version, (o) => {
                  if (o.issued?.token !== token) throw new Error("CONFLICT");
                  return { ...o, sentAt: new Date().toISOString() };
                });
                state.setNotice(
                  "Simulated email to " +
                    offer.issued!.recipient.email +
                    " with the issued PDF attached.",
                );
              }
            : undefined
        }
      />
    </div>
  );
}

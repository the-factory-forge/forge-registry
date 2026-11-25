import { createFileRoute } from "@tanstack/react-router";

import { catalogProduct, ProductDetail } from "@/components/plugins/products";
import { resolvePublicIdentifier } from "@/components/utils/public-identifier";
import { PreviewLanguageSwitcher } from "@/showroom/preview-language-switcher";
import { getProductsPreviewStore, previewProductImageUrl } from "@/showroom/products-preview";
import { requireCanonicalRecord } from "@/showroom/public-record";
import { ShowroomLink } from "@/showroom/routing";
import { notFoundHead, showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

export const Route = createFileRoute("/_products/$locale/products_/$identifier")({
  preloadStaleTime: 0,
  loader: {
    staleReloadMode: "blocking",
    handler: async ({ params, location }) => {
      const { identifier, locale } = params;
      const record = await resolvePublicIdentifier(identifier, (field, value) =>
        getProductsPreviewStore().rows.find(
          (product) => product.published && product[field] === value,
        ),
      );
      return catalogProduct(
        requireCanonicalRecord(record, identifier, `/${locale}/products`, location),
        locale,
      );
    },
  },
  head: ({ loaderData, match }) =>
    loaderData
      ? showroomHead({
          title: loaderData.name,
          description: loaderData.description || loaderData.name,
          path: match.pathname,
        })
      : notFoundHead(),
  component: ProductDetailPreview,
});

function ProductDetailPreview() {
  const product = Route.useLoaderData();
  const { locale } = Route.useParams();
  return (
    <ShowroomPreview width="narrow" controls={<PreviewLanguageSwitcher />}>
      <ProductDetail
        product={product}
        imageUrl={previewProductImageUrl}
        locale={locale}
        currency="CHF"
        backHref={`/${locale}/products`}
        linkComponent={ShowroomLink}
      />
    </ShowroomPreview>
  );
}

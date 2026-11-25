import { createFileRoute } from "@tanstack/react-router";

import { ProductsPreview } from "@/showroom/products-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_products/$locale/products")({
  head: ({ match }) =>
    showroomHead({
      title: "Product catalog demo",
      description:
        "Browse published products with descriptions, characteristics and optional prices.",
      path: match.pathname,
    }),
  component: () => <ProductsPreview />,
});

import { createFileRoute } from "@tanstack/react-router";

import { ProductsPreview } from "@/showroom/products-preview";
import { showroomHead } from "@/showroom/seo";

export const Route = createFileRoute("/_products/$locale/admin/products/$")({
  head: ({ match }) =>
    showroomHead({
      title: "Product administration demo",
      description: "Try adding, editing and publishing products in a sample catalog.",
      path: match.pathname,
      noIndex: true,
    }),
  component: () => <ProductsPreview staff />,
});

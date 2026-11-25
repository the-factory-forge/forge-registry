import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ProductsPreviewProvider } from "@/showroom/products-preview";

export const Route = createFileRoute("/_products")({
  component: () => (
    <ProductsPreviewProvider>
      <Outlet />
    </ProductsPreviewProvider>
  ),
});

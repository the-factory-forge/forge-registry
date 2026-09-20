import { createFileRoute } from "@tanstack/react-router";

import { CustomersPreview } from "@/showroom/customers-preview";

export const Route = createFileRoute("/_plugins/$locale/customers/$")({
  component: CustomersPreview,
});

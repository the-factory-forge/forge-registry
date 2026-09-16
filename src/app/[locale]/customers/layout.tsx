import type { ReactNode } from "react";

import { CustomersPreviewProvider } from "@/showroom/customers-preview";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return <CustomersPreviewProvider>{children}</CustomersPreviewProvider>;
}

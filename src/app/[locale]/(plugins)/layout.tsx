import type { ReactNode } from "react";

import { PluginsPreviewProvider } from "@/showroom/plugins-preview";

export default function PluginsLayout({ children }: { children: ReactNode }) {
  return <PluginsPreviewProvider>{children}</PluginsPreviewProvider>;
}

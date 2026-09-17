import type { ReactNode } from "react";

import { BlogsPreviewProvider } from "@/showroom/blogs-preview";
export default function BlogsLayout({ children }: { children: ReactNode }) {
  return <BlogsPreviewProvider>{children}</BlogsPreviewProvider>;
}

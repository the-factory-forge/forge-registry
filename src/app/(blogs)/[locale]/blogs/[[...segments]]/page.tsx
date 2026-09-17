import { Suspense } from "react";

import { BlogsPublicPreview } from "@/showroom/blogs-preview";
export default function BlogDemo() {
  return (
    <Suspense>
      <BlogsPublicPreview />
    </Suspense>
  );
}

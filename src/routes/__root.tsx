import { createRootRoute, HeadContent, notFound, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { isLocale } from "@/lib/i18n/config";
import { ShowroomLink } from "@/showroom/routing";
import { ShowroomHeader } from "@/showroom/showroom-header";
import { ShowroomPreview } from "@/showroom/showroom-preview";
import { themeScript } from "@/showroom/theme-control";

import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "forge-registry" },
      { name: "description", content: "Reusable AI website component registry scaffold" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", href: "/icon.png" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    customerId?: string;
    folder?: string;
    search?: string;
    category?: string;
    page?: string;
  } =>
    Object.fromEntries(
      ["customerId", "folder", "search", "category", "page"].flatMap((key) =>
        typeof search[key] === "string" || typeof search[key] === "number"
          ? [[key, String(search[key])]]
          : [],
      ),
    ),
  beforeLoad: ({ params }) => {
    if ("locale" in params && !isLocale(String(params.locale))) throw notFound();
  },
  notFoundComponent: () => (
    <ShowroomPreview width="narrow">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <ShowroomLink href="/" className="underline">
        Back to all components
      </ShowroomLink>
    </ShowroomPreview>
  ),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="flex min-h-full flex-col">
        <ShowroomHeader />
        <div className="showroom-content min-w-0 flex-1">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

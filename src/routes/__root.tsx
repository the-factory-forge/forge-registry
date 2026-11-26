import {
  createRootRoute,
  HeadContent,
  isNotFound,
  notFound,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { BackLink } from "@/components/back-link";
import { LoadingProvider } from "@/components/loading-indicator";
import { isLocale } from "@/lib/i18n/config";
import { ShowroomLink } from "@/showroom/routing";
import { notFoundHead } from "@/showroom/seo";
import { ShowroomHeader } from "@/showroom/showroom-header";
import { ShowroomLoading } from "@/showroom/showroom-loading";
import { ShowroomPreview } from "@/showroom/showroom-preview";
import { SiteConsent } from "@/showroom/site-consent";
import { themeScript } from "@/showroom/theme-control";

import appCss from "@/styles/globals.css?url";

const cookieDemoDocument =
  typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "") === "/cookie-banner";

export const Route = createRootRoute({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    customerId?: string;
    folder?: string;
    search?: string;
    category?: string;
    page?: string;
  } => ({
    ...Object.fromEntries(
      ["customerId", "folder", "search", "category", "page"].flatMap((key) =>
        typeof search[key] === "string" || typeof search[key] === "number"
          ? [[key, String(search[key])]]
          : [],
      ),
    ),
  }),
  beforeLoad: ({ params, location, preload }) => {
    if ("locale" in params && !isLocale(String(params.locale))) throw notFound();
    // Keep the simulated Google queue and the real site tag in separate documents.
    if (
      !preload &&
      typeof window !== "undefined" &&
      cookieDemoDocument !== (location.pathname.replace(/\/$/, "") === "/cookie-banner")
    )
      throw redirect({ href: location.href, reloadDocument: true });
  },
  head: ({ matches }) => {
    const missing = matches.length === 1 || matches.some((match) => isNotFound(match.error));
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(missing ? notFoundHead().meta : []),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", href: "/icon.png" },
        { rel: "apple-touch-icon", href: "/apple-icon.png" },
      ],
    };
  },
  notFoundComponent: () => (
    <ShowroomPreview width="narrow">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <BackLink linkComponent={ShowroomLink} href="/">
        Back to all components
      </BackLink>
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
      <body className="flex min-h-full flex-col pt-(--showroom-header-height)">
        <LoadingProvider>
          <ShowroomHeader />
          <ShowroomLoading />
          <ActionToastProvider>
            <div className="showroom-content min-w-0 flex-1">{children}</div>
            <SiteConsent />
          </ActionToastProvider>
        </LoadingProvider>
        <Scripts />
      </body>
    </html>
  );
}

// This identity belongs to the showroom, never to distributed registry source.
const siteUrl = "https://registry.the-corner.io";
const siteName = "Forge Registry";

export function showroomHead({
  title: pageTitle,
  description,
  path,
  canonicalPath = path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  canonicalPath?: string;
  noIndex?: boolean;
}) {
  const title = `${pageTitle} | ${siteName}`;
  const cleanPath = canonicalPath.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const url = new URL(cleanPath, siteUrl).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: noIndex ? "noindex, follow" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: siteName },
      ...(!noIndex ? [{ property: "og:url", content: url }] : []),
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: noIndex ? [] : [{ rel: "canonical", href: url }],
  };
}

export function notFoundHead() {
  return showroomHead({
    title: "Page not found",
    description:
      "This showroom page could not be found. Browse the Forge Registry for reusable React components, layouts, and plugins.",
    path: "/",
    noIndex: true,
  });
}

// This identity belongs to the showroom, never to distributed registry source.
const siteUrl = "https://registry.the-corner.io";
const siteName = "Forge Registry";
const socialImage = `${siteUrl}/social-preview.png`;
const socialImageAlt = "The Corner logo surrounded by illustrated factory machinery";

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
      { property: "og:image", content: socialImage },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: socialImageAlt },
      ...(!noIndex ? [{ property: "og:url", content: url }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: socialImageAlt },
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

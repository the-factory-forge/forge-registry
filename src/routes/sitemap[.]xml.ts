import { createFileRoute } from "@tanstack/react-router";

import { locales } from "@/lib/i18n/config";
import { examples } from "@/showroom/examples";
import { siteUrl } from "@/showroom/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = [
          "/",
          ...examples
            .filter(({ href }) => href !== "/en/login")
            .flatMap(({ href }) =>
              href.startsWith("/en/")
                ? locales.map((locale) => href.replace(/^\/en\//, `/${locale}/`))
                : [href],
            ),
        ];
        const urls = [...new Set(paths)].map((path) => new URL(path, siteUrl).href);
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((url) => `  <url><loc>${url}</loc></url>`),
          "</urlset>",
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});

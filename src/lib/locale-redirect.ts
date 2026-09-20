import { defaultLocale, isLocale } from "./i18n/config.ts";

const localizedDemos = new Set([
  "login",
  "employees",
  "intranet",
  "intranet-sidebar",
  "customers",
  "projects",
  "drive",
  "blogs",
  "admin",
]);

/** Redirect only showroom routes; registry endpoints and Vite assets pass through untouched. */
export function localeRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (!localizedDemos.has(url.pathname.split("/")[1])) return;

  const cookies = request.headers.get("cookie") ?? "";
  // Honor the old cookie so existing visitors retain their saved locale.
  const saved = cookies.match(/(?:^|;\s*)(?:FORGE_LOCALE|NEXT_LOCALE)=([^;]+)/)?.[1];
  const preferred = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase().split("-")[0]);
  const locale = saved && isLocale(saved) ? saved : (preferred.find(isLocale) ?? defaultLocale);
  url.pathname = `/${locale}${url.pathname}`;
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.href,
      "Set-Cookie": `FORGE_LOCALE=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`,
    },
  });
}

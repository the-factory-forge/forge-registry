import { createMiddleware, createStart } from "@tanstack/react-start";

import { localeRedirect } from "@/lib/locale-redirect";

const localeMiddleware = createMiddleware().server(({ request, next }) => {
  return localeRedirect(request) ?? next();
});

export const startInstance = createStart(() => ({ requestMiddleware: [localeMiddleware] }));

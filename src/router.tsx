import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

// A fresh router per request prevents SSR state from leaking between visitors.
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStructuralSharing: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

// A fresh router per request prevents SSR state from leaking between visitors.
export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStructuralSharing: true,
  });

  // Explicit section URLs take precedence over cached scroll positions.
  router.subscribe("onRendered", () => {
    requestAnimationFrame(() => {
      const hash = window.location.hash;
      const section = document.querySelector(`a[data-section-anchor][href="${CSS.escape(hash)}"]`);
      section?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

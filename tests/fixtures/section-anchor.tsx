import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { SectionAnchor } from "@/components/section-anchor";

import "../../src/styles/globals.css";

function Sections() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className="bg-background px-5 text-foreground">
      <header className="fixed inset-x-0 top-0 z-10 h-16 bg-background">Sticky header</header>
      <input aria-label="Unsaved name" className="mt-20 border border-input" />
      {ready &&
        ["factory-overview", "factory-personal-information", "factory-résumé"].map((id) => (
          <section key={id} className="min-h-screen pt-6">
            <h2 className="text-lg font-semibold">
              <SectionAnchor id={id}>{id}</SectionAnchor>
            </h2>
          </section>
        ))}
    </main>
  );
}
const root = createRootRoute();
const route = createRoute({
  getParentRoute: () => root,
  path: "/tests/fixtures/section-anchor.html",
  component: Sections,
});
const router = createRouter({ routeTree: root.addChildren([route]), scrollRestoration: true });
createRoot(document.getElementById("factory-test-root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

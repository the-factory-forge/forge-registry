"use client";

// Framework-agnostic pathname hook (replaces `usePathname` from next/navigation).
// Each site provides the implementation for its framework:
//   - Next.js  : re-export of `next/navigation`'s usePathname
//   - TanStack : re-export of `@tanstack/react-router`'s useLocation().pathname

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * Minimal pathname getter for environments without a router hook.
 * Sites with a real router replace this file with a framework re-export.
 */
export function usePathname(): string {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? "" : window.location.pathname),
    () => "",
  );
}

import { Link, useBlocker, useParams } from "@tanstack/react-router";
import { forwardRef, useCallback, useRef } from "react";

import type { LinkProps } from "@/components/link";

/** Host adapter: published components keep their framework-independent href contract. */
export const ShowroomLink = forwardRef<HTMLAnchorElement, LinkProps>(function ShowroomLink(
  { href, children, ...props },
  ref,
) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return (
      <a {...props} href={href} ref={ref}>
        {children}
      </a>
    );
  }
  const url = new URL(href, "https://showroom.invalid");
  return (
    <Link
      {...props}
      ref={ref}
      to={url.pathname}
      search={Object.fromEntries(url.searchParams)}
      hash={url.hash.slice(1)}
    >
      {children}
    </Link>
  );
});

export function useShowroomParams() {
  const { locale = "en", _splat } = useParams({ strict: false });
  return { locale, segments: _splat?.split("/").filter(Boolean) ?? [] };
}

export function useShowroomEditorGuard() {
  const editorState = useRef({ dirty: false, pending: false });
  const onNavigationStateChange = useCallback((state: { dirty: boolean; pending: boolean }) => {
    editorState.current = state;
  }, []);
  // Block navigation during saves first; editors own dirty-edit dialogs and native unload.
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname && editorState.current.pending,
    enableBeforeUnload: false,
  });
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname && editorState.current.dirty,
    enableBeforeUnload: false,
    withResolver: true,
  });
  return {
    onNavigationStateChange,
    blockedNavigation: blocker.status === "blocked" ? blocker : undefined,
  };
}

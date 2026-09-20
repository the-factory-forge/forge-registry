import { Link, useParams } from "@tanstack/react-router";
import { forwardRef } from "react";

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

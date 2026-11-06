"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/components/utils/cn";

export interface SectionAnchorProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function SectionAnchor({ id, children, className }: SectionAnchorProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Async sections can mount after the browser's initial fragment scroll.
    const frame = requestAnimationFrame(() => {
      try {
        if (decodeURIComponent(window.location.hash.slice(1)) === id) {
          ref.current?.scrollIntoView({ block: "start", behavior: "instant" });
        }
      } catch {
        // Ignore malformed URL fragments.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);

  return (
    <a
      ref={ref}
      data-section-anchor=""
      id={id}
      href={`#${encodeURIComponent(id)}`}
      className={cn(
        "inline-flex min-h-6 scroll-mt-20 items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </a>
  );
}

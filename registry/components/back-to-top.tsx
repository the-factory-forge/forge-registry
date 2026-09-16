"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export interface BackToTopProps {
  ariaLabel?: string;
}

export function BackToTop({ ariaLabel = "Back to top" }: BackToTopProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed right-6 bottom-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/40"
      aria-label={ariaLabel}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

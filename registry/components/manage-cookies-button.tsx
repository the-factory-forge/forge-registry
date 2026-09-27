"use client";

import { cn } from "@/components/utils/cn";

export interface ManageCookiesButtonProps {
  label: string;
  manageEvent?: string;
  size?: "xs" | "sm";
  className?: string;
}

export function ManageCookiesButton({
  label,
  manageEvent = "manage-cookies",
  size = "sm",
  className,
}: ManageCookiesButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(manageEvent))}
      className={cn(
        size === "xs" ? "text-xs" : "text-sm",
        "cursor-pointer text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed",
        className,
      )}
    >
      {label}
    </button>
  );
}

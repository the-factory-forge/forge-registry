"use client"

import { cn } from "@/lib/forge/utils"

export interface ManageCookiesButtonProps {
  label: string
  manageEvent?: string
  size?: "xs" | "sm"
  className?: string
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
        "text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      {label}
    </button>
  )
}

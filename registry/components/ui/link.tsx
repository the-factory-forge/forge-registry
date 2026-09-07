"use client"

// Framework-agnostic Link shim.
// Each site provides the implementation for its framework:
//   - Next.js   : re-export of `next/link`
//   - TanStack  : re-export of `@tanstack/react-router`'s Link (typed `to`)
// The registry imports this shim and never imports a framework router directly.

import { forwardRef } from "react"

import { cn } from "@/lib/forge/utils"

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children?: React.ReactNode
}

/**
 * Minimal anchor-based Link. Sites that need router-aware navigation
 * (prefetch, active states) replace this file with a framework re-export —
 * the props above keep the component contract stable.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, className, children, ...props },
  ref,
) {
  return (
    <a href={href} ref={ref} className={cn(className)} {...props}>
      {children}
    </a>
  )
})

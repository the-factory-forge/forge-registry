import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/forge/utils";

export interface CornerFrameProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "header" | "aside";
  /** Adds the signature conic-gradient glow sweep on hover/focus. */
  accent?: boolean;
  /** Size of the clipped corner cut-out. Defaults to "md". */
  cut?: "sm" | "md" | "lg";
  /** Surface fill for the frame body. Defaults to "quiet". */
  surface?: "paper" | "elevated" | "tinted" | "quiet";
}

export function CornerFrame({
  as: Component = "div",
  accent = false,
  cut = "md",
  surface = "quiet",
  className,
  ...props
}: CornerFrameProps) {
  return (
    <Component
      className={cn(
        "corner-frame",
        cut === "sm" && "corner-cut-sm",
        cut === "lg" && "corner-cut-lg",
        surface === "paper" && "corner-surface-paper",
        surface === "elevated" && "corner-surface-elevated",
        surface === "tinted" && "corner-surface-tinted",
        surface === "quiet" && "corner-surface-quiet",
        accent && "corner-accent",
        className,
      )}
      {...props}
    />
  );
}

export interface CornerLabelProps {
  children: ReactNode;
  className?: string;
}

export function CornerLabel({ children, className }: CornerLabelProps) {
  return (
    <span
      className={cn(
        "corner-frame corner-cut-sm corner-surface-tinted inline-flex w-fit items-center px-3 py-1 text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase",
        className,
      )}
    >
      <span>{children}</span>
    </span>
  );
}

export interface CornerRuleProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a left-aligned, origin-scaled reveal. */
  animated?: boolean;
}

export function CornerRule({ animated = false, className, ...props }: CornerRuleProps) {
  return (
    <div
      className={cn("corner-rule", animated && "corner-rule-animated", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

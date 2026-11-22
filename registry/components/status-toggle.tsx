"use client";

import type { ReactNode } from "react";

import { cn } from "@/components/utils/cn";

export interface StatusToggleProps {
  pressed: boolean;
  label: string;
  children: ReactNode;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function StatusToggle({
  pressed,
  label,
  children,
  onPressedChange,
  disabled,
  className,
}: StatusToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-3 w-5 shrink-0 items-center rounded-full bg-current/20 px-0.5",
          pressed && "justify-end",
        )}
      >
        <span className="size-2 rounded-full bg-current" />
      </span>
      {children}
    </button>
  );
}

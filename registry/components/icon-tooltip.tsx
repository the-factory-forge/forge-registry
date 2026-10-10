"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

export interface IconTooltipProps {
  label?: string;
  children: ReactElement;
}

/** Compose with the existing control so its semantics, ref and layout stay intact. */
export function IconTooltip({ label, children }: IconTooltipProps) {
  if (!label) return children;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8} className="z-[110]">
          <Tooltip.Popup
            role="tooltip"
            className="max-w-[min(20rem,calc(100vw-2rem))] rounded-md bg-popover px-3 py-2 text-xs break-words text-popover-foreground shadow-md dark:border dark:border-border dark:shadow-none"
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

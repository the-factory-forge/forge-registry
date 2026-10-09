import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/components/utils/cn";

export type NativeSelectProps = ComponentProps<"select">;

export function NativeSelect({ className, multiple, size, ...props }: NativeSelectProps) {
  const showArrow = !multiple && (!size || size <= 1);
  return (
    <span className="relative block w-full min-w-0">
      <select
        {...props}
        multiple={multiple}
        size={size}
        className={cn(
          className,
          "peer w-full min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed",
          showArrow && "appearance-none pe-10 forced-colors:appearance-auto forced-colors:pe-3",
        )}
      />
      {showArrow && (
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50 forced-colors:hidden"
        />
      )}
    </span>
  );
}

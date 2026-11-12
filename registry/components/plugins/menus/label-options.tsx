"use client";

import { CheckIcon } from "lucide-react";

import { MenuLabelSymbol } from "@/components/plugins/menus/label-badge";
import type { MenuViewLabel } from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

export function MenuLabelOptions({
  legend,
  labels,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  labels: readonly MenuViewLabel[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  if (!labels.length) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start">
        <span className="pt-2 text-sm font-medium" aria-hidden="true">
          {legend}
        </span>
        <div className="flex min-w-0 flex-wrap gap-2">
          {labels.map((label) => {
            const checked = value.includes(label.id);
            return (
              <label
                key={label.id}
                className={cn(
                  "relative inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-accent has-disabled:cursor-not-allowed has-disabled:opacity-50",
                  checked && "border-primary bg-primary/10 text-foreground",
                )}
              >
                <input
                  type="checkbox"
                  className="cursor-inherit absolute inset-0 size-full opacity-0"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, label.id]
                        : value.filter((id) => id !== label.id),
                    )
                  }
                />
                <MenuLabelSymbol label={label} />
                <span className="min-w-0 wrap-anywhere">{label.name}</span>
                <CheckIcon
                  aria-hidden="true"
                  className={cn("size-3.5 shrink-0", !checked && "invisible")}
                />
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

"use client";

import { UploadIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/components/utils/cn";

export interface PhotoPickerProps {
  preview: ReactNode;
  onSelect: (file: File) => void;
  layout?: "beside" | "overlay";
  inputId?: string;
  inputLabel?: string;
  buttonLabel?: string;
  buttonAriaLabel?: string;
  disabled?: boolean;
}

export function PhotoPicker({
  preview,
  onSelect,
  layout = "beside",
  inputId,
  inputLabel,
  buttonLabel = "Photo",
  buttonAriaLabel,
  disabled,
}: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={layout === "overlay" ? "relative" : "flex items-center gap-4"}>
      {preview}
      <button
        type="button"
        className={cn(
          "inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8",
          layout === "overlay" && "absolute right-2 bottom-2",
        )}
        aria-label={buttonAriaLabel}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <UploadIcon aria-hidden="true" className="size-4 shrink-0" />
        {buttonLabel}
      </button>
      <input
        ref={input}
        id={inputId}
        aria-label={inputLabel}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onSelect(file);
        }}
      />
    </div>
  );
}

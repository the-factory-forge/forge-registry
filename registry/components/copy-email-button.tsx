"use client";

import { Toast } from "@base-ui/react/toast";
import { CopyIcon } from "lucide-react";

import { actionToastButtonClass, type ActionToastData } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";

export interface CopyEmailButtonProps {
  email: string;
  label?: string;
  copiedLabel?: string;
  errorLabel?: string;
  className?: string;
}

export function CopyEmailButton({
  email,
  label = "Copy email address",
  copiedLabel = "Email address copied",
  errorLabel = "Could not copy the email address. Select and copy it manually.",
  className,
}: CopyEmailButtonProps) {
  const { add } = Toast.useToastManager<ActionToastData>();

  return (
    <IconTooltip label={label}>
      <button
        type="button"
        disabled={!email}
        aria-label={label}
        className={cn(
          actionToastButtonClass,
          "size-10 shrink-0 p-0 text-muted-foreground md:size-8",
          className,
        )}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            add({ title: copiedLabel, type: "success" });
          } catch {
            add({ title: errorLabel, type: "error" });
          }
        }}
      >
        <CopyIcon className="size-4 shrink-0" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}

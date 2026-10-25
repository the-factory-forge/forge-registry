"use client";

import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";

export function DeviceControl() {
  const [previewDevice, setPreviewDevice] = useState<"phone" | "tablet">();

  const Icon =
    previewDevice === "phone"
      ? SmartphoneIcon
      : previewDevice === "tablet"
        ? TabletIcon
        : LaptopIcon;
  const nextDevice =
    previewDevice === "phone" ? "tablet" : previewDevice === "tablet" ? undefined : "phone";
  const label =
    previewDevice === "phone"
      ? "Small preview — switch to medium"
      : previewDevice === "tablet"
        ? "Medium preview — switch to big"
        : "Big preview — switch to small";

  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          document.documentElement.style.setProperty(
            "--showroom-device-width",
            nextDevice === "phone" ? "390px" : nextDevice === "tablet" ? "768px" : "100%",
          );
          setPreviewDevice(nextDevice);
        }}
        className={cn(
          "hidden size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex",
          previewDevice
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}

"use client";

import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useEffect } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { useViewPreference, viewPreferenceKey } from "@/components/utils/view-preference";

export function DeviceControl() {
  const [previewDevice, setPreviewDevice] = useViewPreference(
    viewPreferenceKey("showroom", "preview", "size"),
    "big",
    ["small", "medium", "big"] as const,
  );
  useEffect(() => {
    const style = document.documentElement.style;
    if (previewDevice === "big") style.removeProperty("--showroom-device-width");
    else
      style.setProperty("--showroom-device-width", previewDevice === "small" ? "390px" : "768px");
  }, [previewDevice]);

  const Icon =
    previewDevice === "small"
      ? SmartphoneIcon
      : previewDevice === "medium"
        ? TabletIcon
        : LaptopIcon;
  const nextDevice =
    previewDevice === "small" ? "medium" : previewDevice === "medium" ? "big" : "small";
  const label =
    previewDevice === "small"
      ? "Small preview — switch to medium"
      : previewDevice === "medium"
        ? "Medium preview — switch to big"
        : "Big preview — switch to small";

  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setPreviewDevice(nextDevice)}
        className={cn(
          "hidden size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex",
          previewDevice !== "big"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}

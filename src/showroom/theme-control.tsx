"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { viewPreferenceKey } from "@/components/utils/view-preference";

const storageKey = viewPreferenceKey("showroom", "appearance", "theme");
const legacyKey = "forge-showroom-theme";
type Theme = "light" | "dark";

// Apply the saved choice before paint. The SSR and unavailable-storage default is light.
export const themeScript = `try {
  const saved = localStorage.getItem("${storageKey}");
  const legacy = localStorage.getItem("${legacyKey}");
  if ((saved ?? legacy) === "dark") {
    document.documentElement.classList.replace("light", "dark");
    if (saved === null) localStorage.setItem("${storageKey}", "dark");
  }
  if (legacy !== null) localStorage.removeItem("${legacyKey}");
} catch {}`;

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return;
    applyTheme(event.newValue === "dark" ? "dark" : "light");
    onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("showroom-theme", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("showroom-theme", onChange);
  };
}

function useShowroomTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
}

export function ThemeControl() {
  const theme = useShowroomTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;

  return (
    <IconTooltip label="Dark mode">
      <button
        type="button"
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
        onClick={() => {
          const nextTheme = theme === "dark" ? "light" : "dark";
          applyTheme(nextTheme);
          try {
            if (nextTheme === "light") localStorage.removeItem(storageKey);
            else localStorage.setItem(storageKey, nextTheme);
          } catch {
            /* The current tab still works without storage. */
          }
          window.dispatchEvent(new Event("showroom-theme"));
        }}
        className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}

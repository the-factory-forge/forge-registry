"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

const storageKey = "forge-showroom-theme";
type Theme = "light" | "dark";

// Apply the saved choice before paint. The SSR and unavailable-storage default is light.
export const themeScript = `try{if(localStorage.getItem("${storageKey}")==="dark"){document.documentElement.classList.replace("light","dark")}}catch{}`;

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

export function ThemeControl() {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
  return (
    <fieldset className="flex shrink-0 gap-1 rounded-xl border border-border p-1">
      <legend className="sr-only">Color theme</legend>
      {(["light", "dark"] as const).map((mode) => {
        const Icon = mode === "light" ? SunIcon : MoonIcon;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={theme === mode}
            onClick={() => {
              applyTheme(mode);
              try {
                localStorage.setItem(storageKey, mode);
              } catch {
                /* The current tab still works without storage. */
              }
              window.dispatchEvent(new Event("showroom-theme"));
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{mode === "light" ? "Light" : "Dark"}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

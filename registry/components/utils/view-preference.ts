"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/** Use a registry item (or showroom) as owner and stable, untranslated view names. */
export function viewPreferenceKey(
  owner: string,
  view: string,
  preference: string,
  instance?: string,
) {
  const parts = [owner, view, preference];
  if (instance !== undefined) parts.push(instance);
  return `forge:${parts.map(encodeURIComponent).join(":")}`;
}

const changeEvent = "forge:view-preference";
const serverSnapshot = () => null;

export function readViewPreference(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useViewPreference<T extends string>(
  key: string | undefined,
  defaultValue: T,
  values: readonly T[],
) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (key === undefined) return () => {};
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) notify();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(changeEvent, notify);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(changeEvent, notify);
      };
    },
    [key],
  );
  const stored = useSyncExternalStore(
    subscribe,
    () => (key === undefined ? null : readViewPreference(key)),
    serverSnapshot,
  );
  const [fallback, setFallback] = useState<{ key: string | undefined; value: T }>();
  const value =
    fallback && fallback.key === key
      ? fallback.value
      : (values.find((choice) => choice === stored) ?? defaultValue);
  const setValue = useCallback(
    (next: T) => {
      if (key === undefined) {
        setFallback({ key, value: next });
        return;
      }
      try {
        if (next === defaultValue) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
        setFallback(undefined);
        window.dispatchEvent(new Event(changeEvent));
      } catch {
        setFallback({ key, value: next });
      }
    },
    [defaultValue, key],
  );
  return [value, setValue] as const;
}

export function usePanelPreference(key: string, defaultOpen = false) {
  const [value, setValue] = useViewPreference(key, defaultOpen ? "open" : "closed", [
    "open",
    "closed",
  ]);
  const setOpen = useCallback((open: boolean) => setValue(open ? "open" : "closed"), [setValue]);
  return [value === "open", setOpen] as const;
}

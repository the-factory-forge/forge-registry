"use client";

import * as React from "react";

import {
  type FontConfig,
  type FontPreset,
  type FontRole,
  fonts as allFonts,
  getFont,
  groupByFamily,
  resolveConfig,
} from "@/lib/forge/fonts";

interface FontContextValue {
  config: FontConfig;
  getRoleFont: (role: FontRole) => FontPreset;
  setRoleFont: (role: FontRole, id: string) => void;
  isLocked: boolean;
  allFonts: FontPreset[];
  groupedFonts: Record<string, FontPreset[]>;
}

const FontContext = React.createContext<FontContextValue | null>(null);

export interface FontProviderProps {
  children: React.ReactNode;
  defaultConfig?: Partial<FontConfig>;
  locked?: boolean;
  storageKey?: string;
}

export function FontProvider({
  children,
  defaultConfig,
  locked = false,
  storageKey = "font-config",
}: FontProviderProps) {
  const [config, setConfig] = React.useState<FontConfig>(() => resolveConfig(defaultConfig ?? {}));

  React.useEffect(() => {
    if (locked) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FontConfig>;
        if (parsed && typeof parsed === "object") {
          // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- hydrate depuis localStorage au montage
          setConfig(resolveConfig(parsed));
        }
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [locked, storageKey]);

  React.useEffect(() => {
    const heading = getFont(config.heading);
    const eyebrow = getFont(config.eyebrow);
    const body = getFont(config.body);
    if (!heading || !eyebrow || !body) return;

    const id = "font-config-style";
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = id;
    style.textContent = [
      `body,.font-sans{font-family:${body.cssVar}!important}`,
      `.font-heading,h1,h2,h3,h4,h5,h6{font-family:${heading.cssVar}!important}`,
      `.font-eyebrow{font-family:${eyebrow.cssVar}!important}`,
    ].join("");
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [config]);

  const setRoleFont = React.useCallback(
    (role: FontRole, id: string) => {
      if (locked) return;
      if (!getFont(id)) return;
      setConfig((prev) => {
        const next = { ...prev, [role]: id };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [locked, storageKey],
  );

  const value = React.useMemo<FontContextValue>(
    () => ({
      config,
      getRoleFont: (role) => getFont(config[role]) ?? allFonts[0],
      setRoleFont,
      isLocked: locked,
      allFonts,
      groupedFonts: groupByFamily(),
    }),
    [config, setRoleFont, locked],
  );

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useFont(): FontContextValue {
  const ctx = React.useContext(FontContext);
  if (!ctx) {
    throw new Error("useFont must be used within a FontProvider");
  }
  return ctx;
}

"use client"

import * as React from "react"
import {
  type ThemePreset,
  presets as allPresets,
  defaultPresetId,
  getPreset,
  groupByIndustry,
} from "@/lib/forge/themes"

interface ThemeContextValue {
  preset: ThemePreset
  presetId: string
  setPreset: (id: string) => void
  isLocked: boolean
  allPresets: ThemePreset[]
  groupedPresets: Record<string, ThemePreset[]>
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultPreset?: string
  locked?: boolean
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultPreset = defaultPresetId,
  locked = false,
  storageKey = "theme-preset",
}: ThemeProviderProps) {
  const [presetId, setPresetId] = React.useState(defaultPreset)

  React.useEffect(() => {
    if (locked) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && getPreset(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
        setPresetId(saved)
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [locked, storageKey])

  React.useEffect(() => {
    const preset = getPreset(presetId) ?? getPreset(defaultPreset)
    if (!preset) return
    const root = document.documentElement
    for (const [key, value] of Object.entries(preset.tokens)) {
      root.style.setProperty(key, value)
    }
  }, [presetId, defaultPreset])

  const setPreset = React.useCallback(
    (id: string) => {
      if (locked) return
      if (!getPreset(id)) return
      setPresetId(id)
      try {
        localStorage.setItem(storageKey, id)
      } catch {
        // ignore storage errors
      }
    },
    [locked, storageKey],
  )

  const preset = getPreset(presetId) ?? getPreset(defaultPreset)!
  const value = React.useMemo<ThemeContextValue>(
    () => ({
      preset,
      presetId: preset.id,
      setPreset,
      isLocked: locked,
      allPresets,
      groupedPresets: groupByIndustry(),
    }),
    [preset, setPreset, locked],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return ctx
}

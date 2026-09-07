"use client"

import { Palette, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/forge/ui/dropdown-menu"
import { cn } from "@/lib/forge/utils"
import { useTheme } from "@/components/forge/ui/theme-provider"

export interface ThemeSwitcherProps {
  label?: string
  ariaLabel?: string
  className?: string
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function ThemeSwitcher({
  label,
  ariaLabel = "Theme",
  className,
}: ThemeSwitcherProps) {
  const { isLocked, presetId, setPreset, groupedPresets } = useTheme()

  if (isLocked) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        {label && <span>{label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {Object.entries(groupedPresets).map(([industry, moods]) => {
          const industryColor = moods[0]?.tokens["--primary"] ?? "#000"
          return (
            <DropdownMenuSub key={industry}>
              <DropdownMenuSubTrigger>
                <span className="flex items-center gap-2">
                  <Swatch color={industryColor} />
                  {capitalize(industry)}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {moods.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    className="justify-between"
                    onClick={() => setPreset(preset.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Swatch color={preset.tokens["--primary"] ?? "#000"} />
                      {preset.label}
                    </span>
                    {preset.id === presetId && (
                      <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

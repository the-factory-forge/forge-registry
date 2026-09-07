"use client"

import { Type, Check, ChevronRight } from "lucide-react"
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
import { type FontRole, groupByCategory } from "@/lib/forge/fonts"
import { useFont } from "@/components/forge/ui/font-provider"

export interface FontSwitcherProps {
  label?: string
  ariaLabel?: string
  roleLabels?: Partial<Record<FontRole, string>>
  className?: string
}

const DEFAULT_ROLE_LABELS: Record<FontRole, string> = {
  heading: "Titres",
  eyebrow: "Eyebrow",
  body: "Texte",
}

export function FontSwitcher({
  label,
  ariaLabel = "Font",
  roleLabels,
  className,
}: FontSwitcherProps) {
  const { isLocked, config, setRoleFont, allFonts } = useFont()

  if (isLocked) return null

  const labels: Record<FontRole, string> = {
    ...DEFAULT_ROLE_LABELS,
    ...roleLabels,
  }

  const roles = Object.keys(DEFAULT_ROLE_LABELS) as FontRole[]
  const categories = groupByCategory()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Type className="h-4 w-4" aria-hidden="true" />
        {label && <span>{label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {roles.map((role) => (
          <DropdownMenuSub key={role}>
            <DropdownMenuSubTrigger className="justify-between">
              {labels[role]}
              <span className="text-xs font-normal text-muted-foreground">
                {allFonts.find((f) => f.id === config[role])?.label ?? ""}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {Object.entries(categories).map(([category, fonts]) => (
                <DropdownMenuSub key={category}>
                  <DropdownMenuSubTrigger className="justify-between">
                    <span>{category}</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {fonts.map((font) => (
                      <DropdownMenuItem
                        key={font.id}
                        className="justify-between"
                        onClick={() => setRoleFont(role, font.id)}
                      >
                        <span style={{ fontFamily: font.cssVar }}>{font.label}</span>
                        {font.id === config[role] && (
                          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

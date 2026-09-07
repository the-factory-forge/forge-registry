import type { FooterProps } from "@/components/forge/navigation/footer"

export interface FooterOptions {
  /** Brand name shown in the footer and copyright line. */
  siteName: string
  /** Brand description (localized). */
  description: string
  /** Optional brand tagline (e.g. "Chez Cathy · Grône"). */
  tagline?: string
  /** Optional brand logo URL. */
  logo?: string
  /** Optional initial used as monogram fallback when no logo. */
  initial?: string
  /** Hide the monogram fallback when there is no logo. */
  hideMonogram?: boolean
  /** Brand name color — primary or foreground. */
  brandColor?: "primary" | "foreground"
  /** Navigation columns. */
  columns: FooterProps["columns"]
  contact: {
    title?: string
    address?: string
    phone?: string
    phoneLabel?: string
    email?: string
    mapsUrl?: string
    hours?: string
    hoursLabel?: string
  }
  socials?: FooterProps["socials"]
  /** Copyright text — {year}, {name}, {rights} placeholders are replaced. */
  copyright: string
  /** Localized "All rights reserved" text. */
  rights: string
  /** Legal links (mentions, privacy, terms). */
  legalLinks: { label: string; href: string }[]
  /** Default: The Corner Factory attribution. Pass null to hide. */
  attribution?: FooterProps["attribution"] | null
  newsletter?: FooterProps["newsletter"]
  manageCookiesEvent?: string
  variant?: "default" | "dark"
  accentColor?: "accent" | "primary" | "secondary" | "foreground"
  iconColor?: "accent" | "primary" | "secondary" | "foreground"
  /** Grouped color overrides (preferred over accentColor/iconColor). */
  colors?: FooterProps["colors"]
  className?: string
}

const CORNER_ATTRIBUTION = {
  text: "Made by The Corner Factory",
  href: "https://the-corner.io/portfolio/forge",
  logo: "https://assets.the-corner.io/logos/the_corner-icon.png",
}

/**
 * Builds Footer props from site data.
 * Handles copyright placeholders ({year}, {name}, {rights}) and the
 * default The Corner Factory attribution.
 *
 * Footer color recipes (see FooterProps):
 * - Logo + dark footer: variant="dark", colors: { headings: "primary", icons: "primary" }
 * - No logo + tagline: hideMonogram: true, colors: { brandName: "primary" },
 *   className: "bg-secondary/60"
 * - Light default: no colors needed — headings default to text-primary.
 *   Never default to text-secondary: in shadcn presets, --secondary is a
 *   surface color nearly invisible on light backgrounds.
 */
export function getFooterProps(options: FooterOptions): FooterProps {
  const year = new Date().getFullYear()
  const {
    siteName,
    description,
    tagline,
    logo,
    initial,
    hideMonogram,
    brandColor,
    columns,
    contact,
    socials,
    copyright,
    rights,
    legalLinks,
    attribution = CORNER_ATTRIBUTION,
    newsletter,
    manageCookiesEvent = "manage-cookies",
    variant = "default",
    accentColor,
    iconColor,
    colors,
    className,
  } = options

  return {
    brand: { name: siteName, description, tagline, logo, initial, hideMonogram, brandColor },
    columns,
    contact,
    socials,
    legal: {
      copyright: copyright
        .replace("{year}", String(year))
        .replace("{name}", siteName)
        .replace("{rights}", rights),
      links: legalLinks,
    },
    attribution: attribution ?? undefined,
    newsletter,
    manageCookiesEvent,
    variant,
    accentColor,
    iconColor,
    colors,
    className,
  }
}

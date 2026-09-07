import { Image } from "@/components/forge/ui/image"
import { Link } from "@/components/forge/ui/link"
import { Mail, MapPin, Phone, Clock } from "lucide-react"
import { type SocialPlatform, socialIconMap } from "@/components/forge/ui/social-icons"
import { ManageCookiesButton } from "@/components/forge/navigation/manage-cookies-button"
import { cn } from "@/lib/forge/utils"

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface FooterColumn {
  title: string
  links: { label: string; href: string }[]
}

export interface NewsletterProps {
  title: string
  placeholder: string
  buttonLabel: string
  action?: string
}

/**
 * Footer usage recipes:
 *
 * 1. Logo + dark footer (BBX, Soleva, Laveria, Osteoptimum)
 *    brand.logo, variant="dark", colors: { headings: "primary", icons: "primary" }
 *    (requires a --dark token in globals.css; keep "accent" default if
 *    --primary is dark and would blend into the footer background)
 *
 * 2. No logo + tagline (Café des Promeneurs)
 *    brand.name + tagline, hideMonogram: true,
 *    colors: { brandName: "primary" }, className: "bg-secondary/60"
 *
 * 3. Light default (forge-template)
 *    No colors required — headings default to text-primary (readable on
 *    all theme presets). Do NOT default to text-secondary: in shadcn
 *    presets, --secondary is a surface color nearly invisible on light
 *    backgrounds (medical, corporate, hospitality).
 */
export interface FooterProps {
  brand: {
    name: string
    description: string
    tagline?: string
    logo?: string
    initial?: string
    hideMonogram?: boolean
    /** @deprecated Use colors.brandName instead. */
    brandColor?: "primary" | "foreground"
  }
  columns: FooterColumn[]
  contact: {
    title?: string
    address?: string
    phone?: string
    phoneLabel?: string
    email?: string
    mapsUrl?: string
    hours?: string
    hoursLabel?: string
    /** Structured opening hours — days left, hours right, one row each. */
    hoursRows?: { days: string; hours: string }[]
  }
  socials?: SocialLink[]
  legal: {
    links: { label: string; href: string }[]
    copyright: string
  }
  attribution?: { text: string; href: string; logo?: string }
  newsletter?: NewsletterProps
  manageCookiesLabel?: string
  manageCookiesEvent?: string
  variant?: "default" | "dark"
  /** Column headings color. */
  accentColor?: "accent" | "primary" | "secondary" | "foreground"
  /** Contact icon color. */
  iconColor?: "accent" | "primary" | "secondary" | "foreground"
  /** Grouped color overrides (preferred over accentColor/iconColor/brandColor). */
  colors?: {
    headings?: "accent" | "primary" | "secondary" | "foreground"
    icons?: "accent" | "primary" | "secondary" | "foreground"
    brandName?: "primary" | "foreground"
  }
  className?: string
}

export function Footer({
  brand,
  columns,
  contact,
  socials,
  legal,
  attribution,
  newsletter,
  manageCookiesLabel,
  manageCookiesEvent = "manage-cookies",
  variant = "default",
  accentColor,
  iconColor,
  colors,
  className,
}: FooterProps) {
  const dark = variant === "dark"

  const root = dark
    ? "bg-dark text-dark-foreground"
    : "border-t border-border bg-muted/50"

  const colorClass = (color: "accent" | "primary" | "secondary" | "foreground" | undefined) =>
    color === "primary"
      ? "text-primary"
      : color === "secondary"
        ? "text-secondary"
        : color === "foreground"
          ? "text-foreground"
          : dark
            ? "text-accent"
            : "text-primary"

  const headingsColor = colors?.headings ?? accentColor
  const iconsColor = colors?.icons ?? iconColor
  const brandNameColor = colors?.brandName ?? brand.brandColor
  const accentClass = colorClass(headingsColor)

  const brandName =
    brandNameColor === "primary"
      ? "text-primary"
      : dark
        ? "text-dark-foreground"
        : "text-foreground"
  const description = dark ? "text-dark-foreground/70" : "text-muted-foreground"
  const heading = accentClass
  const icon = iconsColor ? colorClass(iconsColor) : accentClass
  const link = dark
    ? "text-dark-foreground/70 transition-colors hover:text-secondary"
    : "text-muted-foreground transition-colors hover:text-primary"
  const socialIcon = dark
    ? "text-dark-foreground/80 transition-colors hover:text-secondary"
    : "text-muted-foreground transition-colors hover:text-primary"
  const bottomBorder = dark ? "border-dark-foreground/10" : "border-border"
  const bottomText = dark ? "text-dark-foreground/60" : "text-muted-foreground"
  const bottomLink = dark
    ? "transition-colors hover:text-secondary"
    : "transition-colors hover:text-primary"

  const inputClass = dark
    ? "border-dark-foreground/20 bg-dark-foreground/10 text-dark-foreground placeholder:text-dark-foreground/50"
    : "border-border bg-background text-foreground placeholder:text-muted-foreground"

  return (
    <footer className={cn(root, className)}>
      <div className="container-premium py-16 md:py-20">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {/* Brand column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={160}
                  height={40}
                  unoptimized
                  className="h-10 w-auto rounded-lg object-contain"
                />
              ) : brand.hideMonogram ? null : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                  {brand.initial ?? brand.name.charAt(0)}
                </span>
              )}
              <span className={cn("font-heading text-lg font-bold", brandName)}>{brand.name}</span>
            </div>
            {brand.tagline && (
              <p
                className={cn(
                  "text-xs font-medium uppercase tracking-[0.18em]",
                  dark ? "text-dark-foreground/60" : "text-foreground/60",
                )}
              >
                {brand.tagline}
              </p>
            )}
            <p className={cn("text-sm leading-relaxed", description)}>
              {brand.description}
            </p>
            {socials && socials.length > 0 && (
              <div className="flex gap-3 pt-2">
                {socials.map((social) => {
                  const Icon = socialIconMap[social.platform]
                  return (
                    <a
                      key={social.platform}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(socialIcon, dark && "flex h-9 w-9 items-center justify-center rounded-full bg-dark-foreground/10")}
                      aria-label={social.platform}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  )
                })}
              </div>
            )}
            {newsletter && (
              <form action={newsletter.action} method="post" className="pt-2">
                <h3 className={cn("mb-3 font-heading text-sm font-semibold uppercase tracking-wide", heading)}>
                  {newsletter.title}
                </h3>
                <div className="flex max-w-xs gap-2">
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder={newsletter.placeholder}
                    aria-label={newsletter.placeholder}
                    className={cn(
                      "h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
                      inputClass,
                    )}
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40"
                  >
                    {newsletter.buttonLabel}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Navigation columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className={cn("mb-4 font-heading text-sm font-semibold uppercase tracking-wide", heading)}>
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((linkItem) => (
                  <li key={linkItem.href}>
                    <Link href={linkItem.href} className={cn("text-sm", link)}>
                      {linkItem.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact column */}
          <div>
            <h3 className={cn("mb-4 font-heading text-sm font-semibold uppercase tracking-wide", heading)}>
              {contact.title}
            </h3>
            <ul className="space-y-3">
              {contact.address && (
                <li>
                  {contact.mapsUrl ? (
                    <a
                      href={contact.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn("flex items-start gap-2 text-sm", link)}
                    >
                      <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} aria-hidden="true" />
                      {contact.address}
                    </a>
                  ) : (
                    <span className={cn("flex items-start gap-2 text-sm", description)}>
                      <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} aria-hidden="true" />
                      {contact.address}
                    </span>
                  )}
                </li>
              )}
              {contact.phone && (
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className={cn("flex items-center gap-2 text-sm", link)}
                  >
                    <Phone className={cn("h-4 w-4 shrink-0", icon)} aria-hidden="true" />
                    {contact.phone}
                    {contact.phoneLabel && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="text-xs font-semibold uppercase text-primary">
                          {contact.phoneLabel}
                        </span>
                      </>
                    )}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className={cn("flex items-center gap-2 text-sm", link)}
                  >
                    <Mail className={cn("h-4 w-4 shrink-0", icon)} aria-hidden="true" />
                    {contact.email}
                  </a>
                </li>
              )}
              {(contact.hours || contact.hoursLabel) && (
                <li>
                  <span className={cn("flex items-start gap-2 text-sm", description)}>
                    <Clock className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} aria-hidden="true" />
                    <span className="whitespace-pre-line">
                      {contact.hoursLabel && (
                        <span className="font-medium">{contact.hoursLabel}</span>
                      )}
                      {contact.hoursLabel && contact.hours && <span> : </span>}
                      {contact.hours && <span>{contact.hours}</span>}
                    </span>
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className={cn("border-t", bottomBorder)}>
        <div className="container-premium flex flex-col gap-6 py-8">
          <div className={cn("flex flex-col items-center justify-between gap-3 text-xs sm:flex-row", bottomText)}>
            <span>{legal.copyright}</span>
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {legal.links.map((linkItem) => (
                <Link
                  key={linkItem.href}
                  href={linkItem.href}
                  className={cn(bottomLink, dark && "text-dark-foreground/70 hover:text-secondary")}
                >
                  {linkItem.label}
                </Link>
              ))}
              {manageCookiesLabel && (
                <ManageCookiesButton
                  label={manageCookiesLabel}
                  manageEvent={manageCookiesEvent}
                  size="xs"
                  className={cn(
                    bottomLink,
                    dark && "text-dark-foreground/70 hover:text-secondary",
                  )}
                />
              )}
            </nav>
          </div>

          {attribution && (
            <div className={cn("flex justify-center text-xs", bottomText)}>
              <a
                href={attribution.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={cn("inline-flex items-center gap-1.5", bottomLink)}
              >
                {attribution.logo && (
                  <Image
                    src={attribution.logo}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                {attribution.text}
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

import { MapPin, Phone, Mail, Clock } from "lucide-react"
import { type SocialPlatform, socialIconMap } from "@/components/forge/ui/social-icons"
import {
  type SectionVariant,
  sectionVariantClasses,
} from "@/lib/forge/section-variants"
import { cn } from "@/lib/forge/utils"

export interface ContactInfoProps {
  title?: string
  address?: string
  mapsUrl?: string
  mapsEmbed?: string
  phone?: string
  email?: string
  hours?: { label: string; value: string }[]
  socials?: { platform: SocialPlatform; url: string }[]
  hoursLabel?: string
  mapPlaceholder?: string
  mapsTitle?: string
  variant?: SectionVariant
  className?: string
}

export function ContactInfo({
  title,
  address,
  mapsUrl,
  mapsEmbed,
  phone,
  email,
  hours,
  socials,
  hoursLabel = "Hours",
  mapPlaceholder,
  mapsTitle = "Google Maps",
  variant = "default",
  className,
}: ContactInfoProps) {
  const colors = sectionVariantClasses[variant]

  return (
    <section className={cn("section-padding", colors.section, className)}>
      <div className="container-premium">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            {title && (
              <h2 className="font-heading text-3xl font-bold text-foreground">{title}</h2>
            )}

            <div className="space-y-5">
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground transition-colors hover:text-primary"
                    >
                      {address}
                    </a>
                  ) : (
                    <span className="text-foreground">{address}</span>
                  )}
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    {phone}
                  </a>
                </div>
              )}

              {email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <a
                    href={`mailto:${email}`}
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    {email}
                  </a>
                </div>
              )}
            </div>

            {hours && hours.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {hoursLabel}
                </div>
                <dl className="space-y-1.5 text-sm">
                  {hours.map((h) => (
                    <div key={h.label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{h.label}</dt>
                      <dd className="font-medium text-foreground">{h.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {socials && socials.length > 0 && (
              <div className="flex gap-3">
                {socials.map((s) => {
                  const Icon = socialIconMap[s.platform]
                  return (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-primary"
                      aria-label={s.platform}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl bg-muted">
            {mapsEmbed ? (
              <iframe
                src={mapsEmbed}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: 400 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={mapsTitle}
              />
            ) : (
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <p className="p-12 text-center text-sm text-muted-foreground">
                  {mapPlaceholder}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

import { MapPinIcon, PhoneIcon, MailIcon, ClockIcon } from "lucide-react";

import { type SocialPlatform, socialIconMap } from "@/components/social-icons";
import { cn } from "@/components/utils/cn";
import { type SectionVariant, sectionVariantClasses } from "@/components/utils/section-variants";

export interface ContactInfoProps {
  title?: string;
  address?: string;
  mapsUrl?: string;
  mapsEmbed?: string;
  phone?: string;
  email?: string;
  hours?: { label: string; value: string }[];
  socials?: { platform: SocialPlatform; url: string; label?: string }[];
  hoursLabel?: string;
  mapPlaceholder?: string;
  mapsTitle?: string;
  variant?: SectionVariant;
  className?: string;
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
  const colors = sectionVariantClasses[variant];

  return (
    <section className={cn("py-20 md:py-28 lg:py-36", colors.section, className)}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="min-w-0 space-y-8 wrap-anywhere">
            {title && (
              <h2 className={cn("font-serif text-3xl font-bold", colors.heading)}>{title}</h2>
            )}

            <div className={cn("space-y-5", colors.heading)}>
              {address && (
                <div className="flex items-start gap-3">
                  <MapPinIcon className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      {address}
                    </a>
                  ) : (
                    <span className={colors.heading}>{address}</span>
                  )}
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    {phone}
                  </a>
                </div>
              )}

              {email && (
                <div className="flex items-center gap-3">
                  <MailIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <a
                    href={`mailto:${email}`}
                    className="underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    {email}
                  </a>
                </div>
              )}
            </div>

            {hours && hours.length > 0 && (
              <div>
                <div
                  className={cn(
                    "mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase",
                    colors.heading,
                  )}
                >
                  <ClockIcon className="h-4 w-4" aria-hidden="true" />
                  {hoursLabel}
                </div>
                <dl className="space-y-1.5 text-sm">
                  {hours.map((h) => (
                    <div key={h.label} className="flex justify-between gap-4">
                      <dt className={colors.body}>{h.label}</dt>
                      <dd className={cn("font-medium", colors.heading)}>{h.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {socials && socials.length > 0 && (
              <div className="flex gap-3">
                {socials.map((s) => {
                  const Icon = socialIconMap[s.platform];
                  return (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                        colors.heading,
                      )}
                      aria-label={s.label ?? s.platform}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted text-muted-foreground">
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
                <p className="p-12 text-center text-sm text-muted-foreground">{mapPlaceholder}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

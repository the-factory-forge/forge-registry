import { ContactInfo, type ContactInfoProps } from "@/components/pages/page-contact-info";
import { PageHero, type PageHeroProps } from "@/components/pages/page-hero";
import { cn } from "@/components/utils/cn";

export interface ContactPageProps {
  hero: PageHeroProps;
  contact: ContactInfoProps;
  className?: string;
}

/** Site details, map URLs, translations, and metadata stay in the host. */
export function ContactPage({ hero, contact, className }: ContactPageProps) {
  return (
    <div className={cn("w-full", className)}>
      <PageHero {...hero} />
      <ContactInfo {...contact} />
    </div>
  );
}

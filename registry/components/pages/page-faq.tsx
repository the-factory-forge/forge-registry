import { FaqList, type FaqListProps } from "@/components/pages/page-faq-list";
import { PageHero, type PageHeroProps } from "@/components/pages/page-hero";
import { cn } from "@/components/utils/cn";

export interface FaqPageProps {
  hero: PageHeroProps;
  faq: FaqListProps;
  className?: string;
}

/** The host owns the main landmark, translations, metadata, and FAQ JSON-LD. */
export function FaqPage({ hero, faq, className }: FaqPageProps) {
  return (
    <div className={cn("w-full", className)}>
      <PageHero {...hero} />
      <FaqList {...faq} />
    </div>
  );
}

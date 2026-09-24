import { cn } from "@/components/utils/cn";

export interface LegalSection {
  title: string;
  content: string;
}

export interface LegalPageProps {
  title: string;
  updatedAt?: string;
  updatedLabel?: string;
  dateSeparator?: string;
  intro?: string;
  sections: LegalSection[];
  className?: string;
}

export function LegalPage({
  title,
  updatedAt,
  updatedLabel = "Last updated",
  dateSeparator = " : ",
  intro,
  sections,
  className,
}: LegalPageProps) {
  return (
    <article className={cn("py-20 md:py-28 lg:py-36", className)}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl wrap-anywhere">
          <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
          {updatedAt && (
            <p className="mt-2 text-sm text-muted-foreground">
              {updatedLabel}
              {dateSeparator}
              {updatedAt}
            </p>
          )}
          {intro && <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>}
          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-4 text-xl font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {section.content}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

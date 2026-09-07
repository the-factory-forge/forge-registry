import { cn } from "@/lib/forge/utils";

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
    <article className={cn("section-padding", className)}>
      <div className="container-premium">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
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
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p className="whitespace-pre-line">{section.content}</p>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

import type { ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { cn } from "@/components/utils/cn";

const accessDeniedLabels = {
  accessDeniedTitle: "Access denied",
  accessDeniedDescription:
    "You don't have permission to access this area. Contact your administrator if you believe this is a mistake.",
  accessDeniedCta: "Back to home",
};
export type AccessDeniedLabels = typeof accessDeniedLabels;
export interface AccessDeniedPageProps {
  homeHref: string;
  labels?: Partial<AccessDeniedLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}
export function AccessDeniedPage({
  homeHref,
  labels: overrides,
  className,
  linkComponent: PageLink = Link,
}: AccessDeniedPageProps) {
  const labels = { ...accessDeniedLabels, ...overrides };
  return (
    <main
      className={cn(
        "flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-center text-foreground",
        className,
      )}
    >
      <p className="text-6xl font-bold text-muted-foreground">403</p>
      <div className="grid gap-2">
        <h1 className="text-2xl font-bold">{labels.accessDeniedTitle}</h1>
        <p className="mx-auto max-w-md text-muted-foreground">{labels.accessDeniedDescription}</p>
      </div>
      <PageLink
        href={homeHref}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {labels.accessDeniedCta}
      </PageLink>
    </main>
  );
}

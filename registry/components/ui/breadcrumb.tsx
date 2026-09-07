import { ChevronRight } from "lucide-react";

import { Link } from "@/components/forge/ui/link";
import { cn } from "@/lib/forge/utils";

export interface Crumb {
  label: string;
  href: string;
}

export interface BreadcrumbProps {
  homeLabel: string;
  items: Crumb[];
  className?: string;
}

export function Breadcrumb({ homeLabel, items, className }: BreadcrumbProps) {
  const all: Crumb[] = [{ label: homeLabel, href: "/" }, ...items];

  return (
    <nav aria-label="Breadcrumb" className={cn("container-premium pt-24 md:pt-28", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {all.map((crumb, i) => {
          const isLast = i === all.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link href={crumb.href} className="transition-colors hover:text-primary">
                    {crumb.label}
                  </Link>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

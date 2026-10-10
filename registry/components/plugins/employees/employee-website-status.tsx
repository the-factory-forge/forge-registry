import type { EmployeeLabels } from "@/components/plugins/employees/labels";
import { cn } from "@/components/utils/cn";

export interface EmployeeWebsiteStatusProps {
  published: boolean | undefined;
  labels: Pick<EmployeeLabels, "websiteVisible" | "websiteHidden" | "websiteUnknown">;
  className?: string;
}

export function EmployeeWebsiteStatus({
  published,
  labels,
  className,
}: EmployeeWebsiteStatusProps) {
  if (published === undefined)
    return <span className={cn("text-muted-foreground", className)}>{labels.websiteUnknown}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        published
          ? "bg-status-success text-status-success-foreground"
          : "bg-status-not-started text-status-not-started-foreground",
        className,
      )}
    >
      {published ? labels.websiteVisible : labels.websiteHidden}
    </span>
  );
}

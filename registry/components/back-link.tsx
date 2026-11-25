import { ArrowLeftIcon } from "lucide-react";
import type { ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { cn } from "@/components/utils/cn";

export const backLinkClass =
  "group/back-link inline-flex min-h-10 w-fit max-w-full cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:[&_svg]:translate-none sm:px-3";

export function BackArrow() {
  return (
    <ArrowLeftIcon
      aria-hidden="true"
      className="size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover/back-link:-translate-x-0.5 motion-safe:group-focus-visible/back-link:-translate-x-0.5"
    />
  );
}

export interface BackLinkProps extends LinkProps {
  linkComponent?: ComponentType<LinkProps>;
}

export function BackLink({
  linkComponent: HostLink = Link,
  children,
  className,
  ...props
}: BackLinkProps) {
  return (
    <HostLink {...props} className={cn(backLinkClass, className)}>
      <BackArrow />
      {children}
    </HostLink>
  );
}

import { ArrowLeftIcon, LockKeyholeIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Link, type LinkProps } from "@/components/link";
import { cn } from "@/components/utils/cn";

const authLayoutLabels = {
  teamSpace: "Team workspace",
  workspaceTitle: "A space for our team.",
  workspaceDescription:
    "Your profile and work tools, together in one place. A private space for your team.",
  backHome: "Back to home",
  privacy: "Privacy policy",
};
export type AuthLayoutLabels = typeof authLayoutLabels;
export interface AuthLayoutProps {
  children: ReactNode;
  siteName: string;
  logoSrc?: string;
  homeHref: string;
  privacyHref?: string;
  languageControl?: ReactNode;
  labels?: Partial<AuthLayoutLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}
export function AuthLayout({
  children,
  siteName,
  logoSrc,
  homeHref,
  privacyHref,
  languageControl,
  labels: overrides,
  className,
  linkComponent: LayoutLink = Link,
}: AuthLayoutProps) {
  const labels = { ...authLayoutLabels, ...overrides };
  return (
    <div className={cn("grid min-h-svh bg-background lg:grid-cols-2", className)}>
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-160 rounded-full border border-primary-foreground/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-16 -right-64 size-160 rounded-full border border-primary-foreground/15"
          aria-hidden="true"
        />
        <div className="relative flex h-full min-h-180 flex-col justify-end p-12 xl:p-16">
          <div className="mb-6 flex items-center gap-2 text-sm font-semibold tracking-widest text-primary-foreground/90 uppercase">
            <LockKeyholeIcon className="size-4" aria-hidden="true" />
            {labels.teamSpace}
          </div>
          <p className="max-w-lg text-4xl leading-tight font-semibold text-primary-foreground! xl:text-5xl">
            {labels.workspaceTitle}
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/85!">
            {labels.workspaceDescription}
          </p>
          <p className="mt-12 text-sm text-primary-foreground/70!">{siteName}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-2 p-4 sm:px-8 sm:py-6">
          <LayoutLink
            href={homeHref}
            className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground! hover:text-primary! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {labels.backHome}
          </LayoutLink>
          {languageControl}
        </header>

        <main id="main-content" className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-md">
            <LayoutLink
              href={homeHref}
              className="mb-10 inline-flex items-center gap-4 rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={siteName}
            >
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt=""
                  className="size-16 rounded-xl object-contain"
                  width="64"
                  height="64"
                />
              )}
              <span className="text-lg font-semibold">{siteName}</span>
            </LayoutLink>
            {children}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-6 text-center text-xs text-muted-foreground!">
          <span>Forged by The Corner Factory SA</span>
          {privacyHref && (
            <LayoutLink href={privacyHref} className="text-primary hover:underline">
              {labels.privacy}
            </LayoutLink>
          )}
        </footer>
      </div>
    </div>
  );
}

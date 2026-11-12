"use client";

import { Tabs } from "@base-ui/react/tabs";

import {
  ComposedMenuPage,
  type ComposedMenuPageProps,
} from "@/components/plugins/menus/composed-public";
import { MenuPrintPage, type MenuPrintPageProps } from "@/components/plugins/menus/print";
import type { MenuCardView } from "@/components/plugins/menus/types";
import { WeeklyMenu } from "@/components/plugins/menus/weekly";
import { cn } from "@/components/utils/cn";

export interface MenuCardPageProps extends Omit<
  ComposedMenuPageProps,
  "sections" | "title" | "description" | "displayMode"
> {
  view: MenuCardView;
}

export function MenuCardPage({ view, ...props }: MenuCardPageProps) {
  if (view.card.kind === "weekly") {
    const { startDate, endDate } = view.card;
    const dates = new Intl.DateTimeFormat(props.locale, { dateStyle: "medium", timeZone: "UTC" });
    return (
      <section className={cn("mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6", props.className)}>
        <h2 className="font-serif text-3xl font-semibold">{view.card.name}</h2>
        {startDate && endDate && (
          <p className="text-muted-foreground">
            {dates.formatRange(new Date(startDate), new Date(endDate))}
          </p>
        )}
        {view.card.description && <p className="whitespace-pre-wrap">{view.card.description}</p>}
        <WeeklyMenu data={view} {...props} />
      </section>
    );
  }
  return (
    <ComposedMenuPage
      {...props}
      sections={view.categories}
      title={view.card.name}
      description={view.card.description}
      displayMode={view.card.displayMode}
      currencyLabel={view.card.currencyLabel ?? props.currencyLabel}
    />
  );
}

export interface MenuCardPreviewProps {
  view: MenuCardView;
  web: Omit<MenuCardPageProps, "view">;
  paper: Omit<MenuPrintPageProps, "sections" | "initialTitle" | "description" | "view">;
  webLabel?: string;
  paperLabel?: string;
}

const tabClass =
  "min-h-11 cursor-pointer rounded-md px-4 text-sm font-medium text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-active:bg-accent data-active:text-accent-foreground";

export function MenuCardPreview({
  view,
  web,
  paper,
  webLabel = "Web",
  paperLabel = "Paper",
}: MenuCardPreviewProps) {
  return (
    <Tabs.Root defaultValue="web">
      <Tabs.List className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        <Tabs.Tab value="web" className={tabClass}>
          {webLabel}
        </Tabs.Tab>
        <Tabs.Tab value="paper" className={tabClass}>
          {paperLabel}
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="web">
        <MenuCardPage view={view} {...web} />
      </Tabs.Panel>
      <Tabs.Panel value="paper">
        <MenuPrintPage
          key={view.card.id}
          {...paper}
          sections={view.categories}
          view={view}
          initialTitle={view.card.name}
          description={view.card.description}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}

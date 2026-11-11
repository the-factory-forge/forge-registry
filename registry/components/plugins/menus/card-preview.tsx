"use client";

import { Tabs } from "@base-ui/react/tabs";

import { MenuPrintPage, type MenuPrintPageProps } from "@/components/plugins/menus/print";
import { MenuPage, type MenuPageProps } from "@/components/plugins/menus/public";
import type { MenuCardView } from "@/components/plugins/menus/types";

export interface MenuCardPageProps extends Omit<
  MenuPageProps,
  "sections" | "title" | "description" | "displayMode"
> {
  view: MenuCardView;
}

export function MenuCardPage({ view, ...props }: MenuCardPageProps) {
  return (
    <MenuPage
      {...props}
      sections={view.categories}
      title={view.card.name}
      description={view.card.description}
      displayMode={view.card.displayMode}
    />
  );
}

export interface MenuCardPreviewProps {
  view: MenuCardView;
  web: Omit<MenuCardPageProps, "view">;
  paper: Omit<MenuPrintPageProps, "sections" | "initialTitle" | "description">;
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
          initialTitle={view.card.name}
          description={view.card.description}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}

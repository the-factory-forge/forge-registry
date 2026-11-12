import { cn } from "@/components/utils/cn";

import { menuLabelColorClasses, MenuLabelSymbol } from "./label-badge";
import type { MenuViewLabel } from "./types";

function PaperLabelSymbol({ label }: { label: MenuViewLabel }) {
  return (
    <MenuLabelSymbol
      label={label}
      className={cn(
        "size-6 rounded-full p-1 print:[print-color-adjust:exact]",
        menuLabelColorClasses(label),
      )}
    />
  );
}

export function MenuPrintSymbols({ labels }: { labels: readonly MenuViewLabel[] }) {
  if (!labels.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span key={label.id} title={label.name} className="inline-flex items-center">
          <PaperLabelSymbol label={label} />
          <span className="sr-only">{label.name}</span>
        </span>
      ))}
    </span>
  );
}

export function MenuPrintLegend({
  labels,
  title = "Legend",
}: {
  labels: readonly MenuViewLabel[];
  title?: string;
}) {
  const unique = [...new Map(labels.map((label) => [label.id, label])).values()];
  if (!unique.length) return null;
  return (
    <aside
      aria-label={title}
      className="mt-8 break-inside-avoid border-t border-border pt-4 text-[9pt]"
    >
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {unique.map((label) => (
          <li key={label.id} className="inline-flex items-center gap-2">
            <PaperLabelSymbol label={label} />
            <span>{label.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

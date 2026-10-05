import type { MenuLabel, MenuViewCategory, MenuViewLabel } from "@/components/plugins/menus/types";

export type MenuLabelTone = "success" | "pending" | "info";
export const menuLabelIcons = [
  "leaf",
  "vegan",
  "fish",
  "wheat",
  "milk",
  "egg",
  "nut",
  "bean",
  "sprout",
  "shrimp",
  "shell",
  "carrot",
  "flower",
  "seeds",
  "wine",
  "check",
] as const;
export type MenuLabelIcon = (typeof menuLabelIcons)[number];

export interface MenuLabelPreset extends MenuLabel {
  icon: MenuLabelIcon;
  tone: MenuLabelTone;
}

type Definition = [
  id: number,
  kind: MenuLabel["kind"],
  icon: MenuLabelIcon,
  tone: MenuLabelTone,
  en: string,
  fr: string,
  de: string,
  it: string,
];

// Allergen groups follow EFSA's list. Colors identify labels, not reaction severity.
const definitions: Definition[] = [
  [1, "dietary", "leaf", "success", "Vegetarian", "Végétarien", "Vegetarisch", "Vegetariano"],
  [2, "allergen", "milk", "info", "Milk", "Lait", "Milch", "Latte"],
  [3, "allergen", "wheat", "pending", "Gluten", "Gluten", "Gluten", "Glutine"],
  [4, "dietary", "vegan", "success", "Vegan", "Végétalien", "Vegan", "Vegano"],
  [5, "allergen", "shrimp", "info", "Crustaceans", "Crustacés", "Krebstiere", "Crostacei"],
  [6, "allergen", "egg", "info", "Eggs", "Œufs", "Eier", "Uova"],
  [7, "allergen", "fish", "info", "Fish", "Poisson", "Fisch", "Pesce"],
  [8, "allergen", "nut", "pending", "Peanuts", "Arachides", "Erdnüsse", "Arachidi"],
  [9, "allergen", "bean", "info", "Soy", "Soja", "Soja", "Soia"],
  [
    10,
    "allergen",
    "nut",
    "pending",
    "Tree nuts",
    "Fruits à coque",
    "Schalenfrüchte",
    "Frutta a guscio",
  ],
  [11, "allergen", "carrot", "info", "Celery", "Céleri", "Sellerie", "Sedano"],
  [12, "allergen", "flower", "info", "Mustard", "Moutarde", "Senf", "Senape"],
  [13, "allergen", "seeds", "info", "Sesame", "Sésame", "Sesam", "Sesamo"],
  [14, "allergen", "wine", "pending", "Sulphites", "Sulfites", "Sulfite", "Solfiti"],
  [15, "allergen", "sprout", "info", "Lupin", "Lupin", "Lupinen", "Lupini"],
  [16, "allergen", "shell", "info", "Molluscs", "Mollusques", "Weichtiere", "Molluschi"],
  [17, "dietary", "fish", "success", "Pescatarian", "Pescétarien", "Pescetarisch", "Pescetariano"],
  [26, "dietary", "check", "info", "Halal", "Halal", "Halal", "Halal"],
  [27, "dietary", "check", "info", "Kosher", "Casher", "Koscher", "Kosher"],
];

export const menuLabelPresets: readonly MenuLabelPreset[] = definitions.map(
  ([id, kind, icon, tone, en, fr, de, it], position) => ({
    id: `20000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    kind,
    icon,
    tone,
    position,
    translations: { en, fr, de, it },
  }),
);

const normalize = (name: string) =>
  name.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
const aliases: Record<string, readonly string[]> = {
  milk: ["Dairy", "Produits laitiers"],
  gluten: ["Cereals containing gluten", "Céréales contenant du gluten"],
  eggs: ["Egg", "Oeufs"],
  soy: ["Soybeans", "Soya"],
  "tree nuts": ["Nuts", "Noix"],
  sulphites: ["Sulfites", "Sulphur dioxide", "Sulfur dioxide", "Dioxyde de soufre"],
  vegan: ["Vegan", "Végane"],
};

export function getMenuLabelPreset(label: MenuViewLabel) {
  return (
    menuLabelPresets.find((preset) => preset.kind === label.kind && preset.id === label.id) ??
    menuLabelPresets.find(
      (preset) =>
        preset.kind === label.kind &&
        [
          ...Object.values(preset.translations),
          ...(aliases[preset.translations.en.toLowerCase()] ?? []),
        ].some((name) => normalize(name) === normalize(label.name)),
    )
  );
}

export function getMenuFilterLabels(
  sections: readonly MenuViewCategory[],
  locale: string,
  filterLabels?: readonly MenuViewLabel[],
): MenuViewLabel[] {
  const used = [
    ...new Map(
      sections
        .flatMap((section) =>
          section.items.filter((item) => item.visible).flatMap((item) => item.labels),
        )
        .map((label) => [label.id, label]),
    ).values(),
  ];
  const defaults =
    filterLabels ??
    menuLabelPresets.map((preset) => ({
      id: preset.id,
      kind: preset.kind,
      name:
        preset.translations[locale] ??
        preset.translations[locale.split("-")[0]] ??
        preset.translations.en,
    }));
  const options = defaults
    .map(
      (label) =>
        used.find(
          (item) =>
            item.id === label.id ||
            (getMenuLabelPreset(item)?.id ?? item.id) ===
              (getMenuLabelPreset(label)?.id ?? label.id),
        ) ?? label,
    )
    .filter((label) => used.some((item) => item.id === label.id));
  const ids = new Set(options.map((label) => label.id));
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...options, ...used.filter((label) => !ids.has(label.id))].sort(
    (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}

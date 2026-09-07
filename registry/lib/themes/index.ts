import alpineTable from "./presets/alpine-table.json";
import bannersDark from "./presets/banners-dark.json";
import banners from "./presets/banners.json";
import exampleColors from "./presets/example-colors.json";
import houseOfTheDragon from "./presets/house-of-the-dragon.json";
import medieval from "./presets/medieval.json";
import sageClinic from "./presets/sage-clinic.json";
import solarLibre from "./presets/solar-libre.json";
import swissCorporate from "./presets/swiss-corporate.json";
import worldOfWarcraft from "./presets/world-of-warcraft.json";

export type ThemeTokenKey =
  | "--background"
  | "--foreground"
  | "--primary"
  | "--primary-foreground"
  | "--secondary"
  | "--secondary-foreground"
  | "--accent"
  | "--accent-foreground"
  | "--muted"
  | "--muted-foreground"
  | "--border"
  | "--ring"
  | "--dark-foreground";

export type ThemeTokens = Partial<Record<ThemeTokenKey, string>>;

export interface ThemePreset {
  id: string;
  label: string;
  industry: string;
  mood: string;
  tokens: ThemeTokens;
}

export const defaultPresetId = "example-colors";

export const presets: ThemePreset[] = [
  exampleColors as ThemePreset,
  alpineTable as ThemePreset,
  sageClinic as ThemePreset,
  swissCorporate as ThemePreset,
  solarLibre as ThemePreset,
  medieval as ThemePreset,
  houseOfTheDragon as ThemePreset,
  worldOfWarcraft as ThemePreset,
  banners as ThemePreset,
  bannersDark as ThemePreset,
];

export function getPreset(id: string): ThemePreset | undefined {
  return presets.find((p) => p.id === id);
}

export function groupByIndustry(): Record<string, ThemePreset[]> {
  const groups: Record<string, ThemePreset[]> = {};
  for (const preset of presets) {
    if (!groups[preset.industry]) {
      groups[preset.industry] = [];
    }
    groups[preset.industry].push(preset);
  }
  return groups;
}

import ebGaramond from "./presets/eb-garamond.json";
import inter from "./presets/inter.json";
import jetbrainsMono from "./presets/jetbrains-mono.json";
import montserrat from "./presets/montserrat.json";
import playfairDisplay from "./presets/playfair-display.json";
import sourceSerif4 from "./presets/source-serif-4.json";
import spaceGrotesk from "./presets/space-grotesk.json";

export type FontRole = "heading" | "eyebrow" | "body";

export interface FontPreset {
  id: string;
  label: string;
  family: "sans" | "serif" | "mono";
  category: string;
  cssVar: string;
}

export interface FontConfig {
  heading: string;
  eyebrow: string;
  body: string;
}

export const defaultFontConfig: FontConfig = {
  heading: "playfair-display",
  eyebrow: "montserrat",
  body: "montserrat",
};

export const fonts: FontPreset[] = [
  montserrat as FontPreset,
  inter as FontPreset,
  playfairDisplay as FontPreset,
  sourceSerif4 as FontPreset,
  spaceGrotesk as FontPreset,
  ebGaramond as FontPreset,
  jetbrainsMono as FontPreset,
];

export function getFont(id: string): FontPreset | undefined {
  return fonts.find((f) => f.id === id);
}

export function resolveConfig(config: Partial<FontConfig>): FontConfig {
  return {
    heading: getFont(config.heading ?? "") ? config.heading! : defaultFontConfig.heading,
    eyebrow: getFont(config.eyebrow ?? "") ? config.eyebrow! : defaultFontConfig.eyebrow,
    body: getFont(config.body ?? "") ? config.body! : defaultFontConfig.body,
  };
}

export function groupByFamily(): Record<string, FontPreset[]> {
  const groups: Record<string, FontPreset[]> = {};
  for (const font of fonts) {
    if (!groups[font.family]) {
      groups[font.family] = [];
    }
    groups[font.family].push(font);
  }
  return groups;
}

export function groupByCategory(): Record<string, FontPreset[]> {
  const groups: Record<string, FontPreset[]> = {};
  for (const font of fonts) {
    if (!groups[font.category]) {
      groups[font.category] = [];
    }
    groups[font.category].push(font);
  }
  return groups;
}

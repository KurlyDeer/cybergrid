export const THEME_NAMES = ["midnight", "snowblind", "vampire", "deep-sea", "matrix", "neon-synth", "custom"] as const;
export type ThemeName = typeof THEME_NAMES[number];

/** Migrate pre-1.3.8 preferences and imported folder appearance overrides. */
export function normalizeThemeName(value: unknown): ThemeName | undefined {
  if (typeof value !== "string") return undefined;
  if ((THEME_NAMES as readonly string[]).includes(value)) return value as ThemeName;
  const legacy: Record<string, ThemeName> = {
    dark: "midnight", light: "snowblind", dracula: "vampire",
    "solarized-dark": "deep-sea", monochrome: "matrix", monokai: "neon-synth",
  };
  return Object.hasOwn(legacy, value) ? legacy[value] : undefined;
}

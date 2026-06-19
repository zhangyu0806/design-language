import { useCallback, useEffect, useState } from "react";

export const PRESETS = ["editorial", "brutalist", "warm", "dark"] as const;
export const THEMES = ["light", "dark"] as const;

export type Preset = (typeof PRESETS)[number];
export type Theme = (typeof THEMES)[number];

const PRESET_KEY = "dl-preset";
const THEME_KEY = "dl-theme";

function read<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
}

export function usePreset() {
  const [preset, setPreset] = useState<Preset>(() => read(PRESET_KEY, "editorial", PRESETS));
  const [theme, setTheme] = useState<Theme>(() => read(THEME_KEY, "light", THEMES));

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-preset", preset);
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(PRESET_KEY, preset);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [preset, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { preset, setPreset, theme, setTheme, toggleTheme };
}

"use client";

import { THEME_KEY } from "./theme-boot";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";

// THEME_KEY và THEME_BOOT_SCRIPT sống ở "@/lib/theme-boot" (module thường) vì
// layout.tsx là server component — xem ghi chú ở file đó. Xuất lại ở đây để
// phía client vẫn nhập từ "@/lib/theme" như cũ.
export { THEME_KEY } from "./theme-boot";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

function apply(t: Theme) {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
}

/**
 * App-wide theme. Light by default (matches the marketing homepage). The choice
 * persists to one key, so picking a theme on any page applies it everywhere.
 * An inline boot script in <head> sets data-theme before paint (no flash); this
 * provider keeps React state in sync and persists changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const t: Theme = stored === "dark" ? "dark" : "light";
    setThemeState(t);
    apply(t);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
    apply(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((p) => {
      const next: Theme = p === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      apply(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

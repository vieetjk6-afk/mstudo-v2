"use client";

import { THEME_KEY } from "./theme-boot";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** Nền đang HIỂN THỊ — chỉ có hai giá trị, mọi selector CSS đọc cái này. */
export type Theme = "light" | "dark";
/** LỰA CHỌN của người dùng — thêm "system" = đi theo cài đặt của máy. */
export type ThemePref = Theme | "system";

// THEME_KEY và THEME_BOOT_SCRIPT sống ở "@/lib/theme-boot" (module thường) vì
// layout.tsx là server component — xem ghi chú ở file đó. Xuất lại ở đây để
// phía client vẫn nhập từ "@/lib/theme" như cũ.
export { THEME_KEY } from "./theme-boot";

const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeCtx = {
  /** Nền đang hiển thị (đã giải "system" ra sáng/tối). */
  theme: Theme;
  /** Lựa chọn thô của người dùng — dùng để tô đậm nút đang chọn. */
  pref: ThemePref;
  /** Đặt lựa chọn: "light" | "dark" | "system". */
  setTheme: (p: ThemePref) => void;
  /** Đảo sáng ↔ tối. Đang ở "theo máy" thì nhảy sang giá trị NGƯỢC với nền
   *  đang thấy — người bấm muốn đổi cái họ đang nhìn. */
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "light",
  pref: "light",
  setTheme: () => {},
  toggle: () => {},
});

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolve(p: ThemePref): Theme {
  return p === "system" ? systemTheme() : p;
}

function readPref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

/** Chỉ ghi `data-theme` với giá trị ĐÃ GIẢI — đúng một thuộc tính, giống script
 *  khởi động (xem ghi chú ở theme-boot.ts về lỗi hydrate). Lựa chọn thô nằm ở
 *  localStorage + state của provider, không cần in ra DOM. */
function apply(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
}

/**
 * App-wide theme. Light by default (matches the marketing homepage). The choice
 * persists to one key, so picking a theme on any page applies it everywhere.
 * An inline boot script in <head> sets data-theme before paint (no flash); this
 * provider keeps React state in sync and persists changes.
 *
 * Lựa chọn "system" đi theo cài đặt sáng/tối của máy và ĐỔI NGAY khi người dùng
 * đổi ở hệ điều hành (nghe `matchMedia`), không phải tải lại trang.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("light");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const p = readPref();
    setPrefState(p);
    const t = resolve(p);
    setThemeState(t);
    apply(t);
  }, []);

  // Chỉ nghe cài đặt của máy khi đang ở "theo máy". Dùng chính `pref` trong
  // dependency để lúc người dùng bỏ "theo máy" là gỡ luôn listener.
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const t: Theme = mq.matches ? "dark" : "light";
      setThemeState(t);
      apply(t);
    };
    // Safari cũ (< 14) chỉ có addListener; giữ cả hai đường để không vỡ.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [pref]);

  const setTheme = useCallback((p: ThemePref) => {
    setPrefState(p);
    const t = resolve(p);
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* ignore */
    }
    apply(t);
  }, []);

  const toggle = useCallback(() => {
    // Đọc nền ĐANG THẤY từ state qua updater để không phụ thuộc `theme` ở
    // ngoài (giữ callback ổn định như bản cũ).
    setThemeState((shown) => {
      const next: Theme = shown === "dark" ? "light" : "dark";
      setPrefState(next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      apply(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, pref, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Nhãn & mô tả của ba lựa chọn — dùng chung cho mọi nút đổi giao diện để
 *  chữ trên topbar, trong ngăn kéo và ở trang khác không mỗi nơi một kiểu. */
export const THEME_OPTIONS: { pref: ThemePref; label: string; title: string }[] = [
  { pref: "light", label: "Sáng", title: "Giao diện sáng" },
  { pref: "dark", label: "Tối", title: "Giao diện tối" },
  { pref: "system", label: "Theo máy", title: "Đi theo cài đặt sáng/tối của máy" },
];

/** Lựa chọn kế tiếp khi bấm một nút xoay vòng: sáng → tối → theo máy → sáng. */
export function nextPref(p: ThemePref): ThemePref {
  return p === "light" ? "dark" : p === "dark" ? "system" : "light";
}

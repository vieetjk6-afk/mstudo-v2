"use client";

import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { THEME_OPTIONS, nextPref, useTheme, type ThemePref } from "@/lib/theme";

const ICON = { light: Sun, dark: Moon, system: MonitorSmartphone } as const;

const titleOf = (p: ThemePref) => THEME_OPTIONS.find((o) => o.pref === p)!.title;

/**
 * Shared theme control. Drop it into any header — it reads/writes the single
 * app-wide preference, so switching here changes every page.
 *
 * Ba trạng thái, bấm một nút xoay vòng: Sáng → Tối → Theo máy. Icon vẽ LỰA
 * CHỌN hiện tại (không phải cái sắp tới) để nhìn là biết đang ở đâu; nhãn nói
 * rõ bấm nữa thì thành gì.
 */
export default function ThemeToggle({ size = 16 }: { size?: number }) {
  const { pref, setTheme } = useTheme();
  const Icon = ICON[pref];
  const next = nextPref(pref);
  const label = `Giao diện: ${THEME_OPTIONS.find((o) => o.pref === pref)!.label} — bấm để chuyển sang ${titleOf(next).toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface2)",
        color: "var(--text)",
      }}
    >
      <Icon size={size} />
    </button>
  );
}

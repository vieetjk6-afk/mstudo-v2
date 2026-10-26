"use client";

import type { CSSProperties } from "react";

/**
 * Thuộc tính cho một lớp nổi của giao diện mới đi qua portal ra <body>.
 *
 * Ra <body> là ra khỏi khung `.studio-shell.ui-v2`, nên token màu (--ac, --sf,
 * --tx…) rơi về bộ của `:root`. Đặt lớp `studio-shell ui-v2` + `data-theme` +
 * màu chủ đạo (`--ac-base`) lên chính phần tử portal — đúng cách Drawer/Modal
 * của bộ khối (../v2/kit-client) đang làm. Chỉ gọi khi đã mount (cần document).
 */
export function v2PortalProps(): { "data-theme"?: string; style?: CSSProperties } {
  if (typeof document === "undefined") return {};
  const theme = document.documentElement.dataset.theme;
  const ac = getComputedStyle(document.querySelector(".ui-v2") ?? document.documentElement).getPropertyValue("--ac-base");
  return { "data-theme": theme, style: ac ? ({ ["--ac-base" as string]: ac } as CSSProperties) : undefined };
}

"use client";

import { useState } from "react";
import { VJK_RED, BRAND } from "@/lib/vieetjk/content";
import type { VjkTheme } from "./ThemeSwitch";

/**
 * Logo tjk media — tự đổi theo giao diện sáng/tối.
 *   Nền TỐI  → logo trắng  /vieetjk-logo.png
 *   Nền SÁNG → logo đen    /vieetjk-logo-light.png
 * Nếu thiếu file → thử logo studio (src) → logo vector dự phòng (theo currentColor).
 */
export default function Logo({
  src,
  theme = "dark",
  height = 30,
}: {
  src?: string | null;
  theme?: VjkTheme;
  height?: number;
}) {
  const [fail, setFail] = useState(false);
  const [fail2, setFail2] = useState(false);

  const imgStyle = { height, width: "auto", maxHeight: height, display: "block", objectFit: "contain" as const };
  const file = theme === "light" ? "/vieetjk-logo-light.png" : "/vieetjk-logo.png";

  // 1) File logo đúng theo giao diện.
  if (!fail) {
    return <img src={file} alt={BRAND.name} style={imgStyle} onError={() => setFail(true)} />;
  }
  // 2) Dự phòng: logo studio (nếu có) — chỉ hợp khi màu tương phản với nền.
  if (src && !fail2) {
    return <img src={src} alt={BRAND.name} style={imgStyle} onError={() => setFail2(true)} />;
  }
  // 3) Vector dự phòng cuối.
  return (
    <span className="vjk-logo" aria-label={BRAND.name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg viewBox="0 0 40 40" width={Math.round(height * 0.82)} height={Math.round(height * 0.82)} aria-hidden="true" focusable="false">
        <path d="M13 8.5c0-1.6 1.75-2.55 3.08-1.68l16.5 10.9c1.2.8 1.2 2.57 0 3.36l-16.5 10.9C14.75 33.05 13 32.1 13 30.5V8.5Z" fill={VJK_RED} />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-manrope), var(--font-hanken), system-ui, sans-serif",
          fontWeight: 800,
          fontSize: Math.round(height * 0.7),
          letterSpacing: "-.01em",
          color: "var(--ink)",
          lineHeight: 1,
        }}
      >
        TJK
      </span>
    </span>
  );
}

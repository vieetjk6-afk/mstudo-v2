"use client";

import { useEffect, useState } from "react";

/* Trạng thái bộ đếm chống dò mật khẩu (xem /api/admin/rate-limit-status) — dùng
   chung cho bản cũ SystemPanel và bản mới SystemV2. */

export type RateLimitMode = "upstash" | "postgres" | "memory";

export const RATE_LIMIT_SQL_URL = "/api/setup-sql/gioi-han-tan-suat";

/** `seed`: CHỈ cho màn xem trước (/uipreview) — có thì không gọi API. */
export function useRateLimitMode(seed?: RateLimitMode | null) {
  const [mode, setMode] = useState<RateLimitMode | null>(seed ?? null);
  useEffect(() => {
    if (seed !== undefined) return;
    fetch("/api/admin/rate-limit-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMode(d?.mode === "upstash" || d?.mode === "postgres" ? d.mode : "memory"))
      .catch(() => setMode("memory"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return mode;
}

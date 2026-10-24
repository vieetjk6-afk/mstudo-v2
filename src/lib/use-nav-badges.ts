"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NavBadges } from "@/lib/studio-nav";

/**
 * Badge = số việc CHƯA xử lý. Lấy sau khi shell đã vẽ để không chặn trang, và
 * làm mới khi đổi route (đã xử lý xong thì con số phải tụt ngay) — nhưng
 * không dày hơn 60s/lần: route đếm 7 bảng một lượt, bấm qua lại vài màn mà
 * lượt nào cũng đếm lại thì badge thành thứ tốn nhất của cả shell. Gọi ép
 * (force) thì bỏ qua cả cache HTTP 30s của route.
 *
 * Dùng chung cho khung cũ (StudioShell) và khung mới (StudioShellV2).
 */
export function useNavBadges(pathname: string): NavBadges {
  const [badges, setBadges] = useState<NavBadges>({});
  const lastFetch = useRef(0);
  const loadBadges = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < 60_000) return;
    lastFetch.current = now;
    fetch("/api/studio/nav-badges", force ? { cache: "no-store" } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setBadges(j as NavBadges); })
      .catch(() => {});
  }, []);
  useEffect(() => { loadBadges(); }, [pathname, loadBadges]);
  return badges;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navProgressColor, type ShellTier } from "@/lib/studio-shell-paths";

/**
 * Zero-dependency top progress bar for App Router (Next 14, no router events).
 *
 * The pain point is the "frozen" feeling on the FIRST navigation to a route:
 * the server round-trip (auth + queries) runs before any UI appears. This bar
 * starts the moment an internal link is clicked — instant feedback — and
 * completes when the pathname/search actually changes (navigation done).
 */
export default function NavProgress({ tier = "none" }: { tier?: ShellTier } = {}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const color = navProgressColor(pathname, tier);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (trickle.current) clearInterval(trickle.current);
    if (hide.current) clearTimeout(hide.current);
    trickle.current = null;
    hide.current = null;
  }

  function start() {
    clearTimers();
    setActive(true);
    setWidth(8);
    // Ramp toward ~90% so the bar always shows motion while the server works,
    // but never completes until the route actually changes.
    trickle.current = setInterval(() => {
      setWidth((w) => (w >= 90 ? w : w + (90 - w) * 0.18));
    }, 200);
  }

  function done() {
    clearTimers();
    setWidth(100);
    hide.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 220);
  }

  // Begin the bar on any same-origin link click (before navigation starts).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || target === "_blank" || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      // External link → real page load, no client transition to track.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same URL → no navigation will fire; don't hang the bar.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  // Pathname/search changed → navigation completed.
  useEffect(() => {
    if (active) done();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  if (!active && width === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-0.5 w-full"
    >
      <div
        className="h-full transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${width}%`,
          opacity: width >= 100 ? 0 : 1,
          // Màu theo KHU đang mở: xanh studio trong khu quản lý, vàng ngoài đó.
          // Trước đây luôn là vàng `--gold`, kể cả khi đang ở giữa khu studio —
          // vì thanh này nằm NGOÀI `.studio-shell` trong cây DOM nên không thừa
          // hưởng token màu của shell. Xem @/lib/studio-shell-paths.
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

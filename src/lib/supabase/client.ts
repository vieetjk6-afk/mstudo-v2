"use client";

import { createBrowserClient } from "@supabase/ssr";
import { cookieDomainForHost } from "@/lib/hosts";
import { BoDem, doDaiTheoHeader, laSupabase } from "@/lib/luu-luong-rules";

// Fallbacks so building (static prerender) never crashes when env vars aren't
// present. Real values are required at runtime for anything to actually work.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/* ── Đếm lưu lượng trình duyệt đọc THẲNG từ Supabase (ước tính egress) ───────
   Phần lớn dữ liệu đi qua máy chủ (đã đếm ở @/lib/luu-luong), nhưng vài màn đọc
   thẳng từ trình duyệt — nặng nhất là bước gom khuôn mặt trên máy studio. Số
   đếm gửi về /api/usage/egress mỗi phút và khi rời trang (sendBeacon). */
const dem = new BoDem();
let henGui = false;

function guiSoDem(): void {
  const ds = dem.layRa();
  const bytes = ds.reduce((t, d) => t + d.bytes, 0);
  const requests = ds.reduce((t, d) => t + d.requests, 0);
  if (bytes === 0 && requests === 0) return;
  const body = JSON.stringify({ bytes, requests });
  try {
    if (navigator.sendBeacon?.("/api/usage/egress", body)) return;
  } catch {
    /* thử fetch bên dưới */
  }
  fetch("/api/usage/egress", { method: "POST", body, keepalive: true }).catch(() => {});
}

function henGuiSoDem(): void {
  if (henGui || typeof window === "undefined") return;
  henGui = true;
  setInterval(guiSoDem, 60_000);
  const roi = () => guiSoDem();
  window.addEventListener("pagehide", roi);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") roi();
  });
}

const demFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (laSupabase(url, SUPABASE_URL)) {
      const n = doDaiTheoHeader(res.headers);
      if (n !== null) dem.cong(n, 1);
      else {
        dem.cong(0, 1);
        if (res.body) res.clone().arrayBuffer().then((b) => dem.cong(b.byteLength, 0)).catch(() => {});
      }
      henGuiSoDem();
    }
  } catch {
    /* đếm hỏng thì thôi — không bao giờ làm hỏng request */
  }
  return res;
};

export function createClient() {
  // Only share across subdomains when the page is actually on mstudo.com; on any
  // other host a `.mstudo.com` cookie would be rejected by the browser.
  const domain =
    typeof window !== "undefined" ? cookieDomainForHost(window.location.hostname) : undefined;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
    ...(domain ? { cookieOptions: { domain } } : {}),
    global: { fetch: demFetch },
  });
}

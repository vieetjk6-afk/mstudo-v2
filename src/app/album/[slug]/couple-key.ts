"use client";

import { useCallback, useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   VÉ "TÔI LÀ CÔ DÂU / CHÚ RỂ" — dùng chung cho chọn ảnh in và ghép layout ảnh.

   Máy chủ phát vé sau khi khách nhập đúng SĐT khách / cô dâu / chú rể của hợp
   đồng (/api/album/[slug]/print/verify hoặc /collage/verify — CÙNG một vé,
   mintPrintKey). Vé lưu trong trình duyệt: xác minh ở một tính năng là tính
   năng kia mở luôn, kể cả khi trang đang mở (báo nhau qua sự kiện cửa sổ).

   Khoá localStorage giữ nguyên tên cũ `mstudo-print-key:` để máy đã xác minh
   chọn ảnh in từ trước không phải nhập lại.
   ═══════════════════════════════════════════════════════════════════════════ */

const storageKey = (slug: string) => `mstudo-print-key:${slug}`;
const EVENT = "mstudo-couple-key";

export function readCoupleKey(slug: string): string | null {
  try {
    return localStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}

export function writeCoupleKey(slug: string, key: string | null) {
  try {
    if (key) localStorage.setItem(storageKey(slug), key);
    else localStorage.removeItem(storageKey(slug));
  } catch {
    /* chế độ ẩn danh / chặn lưu trữ → vé chỉ còn trong phiên này */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { slug, key } }));
  } catch {
    /* trình duyệt quá cũ — bỏ qua, lần sau mở trang sẽ đọc lại */
  }
}

/**
 * Vé của album trên máy này + hàm đặt vé (đặt là lưu luôn và báo các chỗ khác
 * trong trang). `enabled = false` (hợp đồng không ghi SĐT) thì không đọc gì.
 */
export function useCoupleKey(slug: string, enabled: boolean): [string | null, (key: string | null) => void] {
  const [key, setKeyState] = useState<string | null>(null);
  // Đọc sau khi mount: localStorage không có ở máy chủ (lệch HTML lúc hydrate).
  useEffect(() => {
    if (!enabled) return;
    setKeyState(readCoupleKey(slug));
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ slug: string; key: string | null }>).detail;
      if (d?.slug === slug) setKeyState(d.key);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [slug, enabled]);
  const setKey = useCallback(
    (k: string | null) => {
      setKeyState(k);
      writeCoupleKey(slug, k);
    },
    [slug],
  );
  return [key, setKey];
}

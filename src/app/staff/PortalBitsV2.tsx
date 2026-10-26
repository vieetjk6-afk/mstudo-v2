"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, type LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   MẢNH DÙNG CHUNG của hai cổng "đi hiện trường" ở giao diện mới — cổng nhân
   viên (/staff) và cổng thợ (/crew): thanh tab đáy trên điện thoại (có số đếm),
   thông báo nổi đặt CAO hơn thanh tab, và link chỉ đường.
   ═══════════════════════════════════════════════════════════════════════════ */

export type MobileTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  /** Số đếm nhỏ trên icon (0 = ẩn). */
  badge?: number;
  /** "red" cho thứ chưa đọc / cần làm gấp; mặc định màu chủ đạo. */
  badgeTone?: "brand" | "red";
  /** Chấm nhỏ không số (vd đang chấm công). */
  dot?: boolean;
};

/** Thanh tab đáy — chỉ hiện dưới md. Chừa sẵn chỗ để nội dung cuối trang không bị che. */
export function MobileTabBarV2({ items, label = "Các phần của trang" }: { items: MobileTab[]; label?: string }) {
  return (
    <>
      <div className="h-[68px] md:hidden" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{
          background: "var(--topbar)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid var(--bd)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label={label}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              aria-current={it.active ? "page" : undefined}
              className="flex min-w-0 flex-col items-center gap-1 pb-2 pt-2"
              style={{ color: it.active ? "var(--ac)" : "var(--tx3)" }}
            >
              <span
                className="relative flex h-8 w-12 items-center justify-center rounded-full transition-colors"
                style={{ background: it.active ? "var(--acS)" : "transparent" }}
              >
                <it.icon size={20} strokeWidth={it.active ? 2.2 : 1.9} />
                {it.badge && it.badge > 0 ? (
                  <span
                    className="v2-num absolute -top-1 left-[26px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold"
                    style={{
                      background: it.badgeTone === "red" ? "var(--rd)" : "var(--ac)",
                      color: "#fff",
                      boxShadow: "0 0 0 2px var(--sf)",
                    }}
                  >
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                ) : it.dot ? (
                  <span
                    className="absolute right-[9px] top-[3px] h-[9px] w-[9px] rounded-full"
                    style={{ background: "var(--gn)", boxShadow: "0 0 0 2px var(--sf)" }}
                  />
                ) : null}
              </span>
              <span className="max-w-full truncate px-0.5 text-[11px]" style={{ fontWeight: it.active ? 650 : 500 }}>
                {it.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

/**
 * Thông báo nổi ngắn (2,6 giây) — cùng dáng với Toast của khu quản lý nhưng
 * nằm TRÊN thanh tab đáy ở điện thoại, không đè lên nhãn tab.
 */
export function useFloatToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const toastNode = msg ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(80px+env(safe-area-inset-bottom,0px))] left-1/2 z-[200] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-[12px] px-[15px] py-[11px] text-[13px] font-semibold animate-[vkToast_.22s_ease_both] md:bottom-[26px]"
      style={{ background: "#1A1A1C", color: "#FFFFFF", boxShadow: "0 12px 30px rgba(0,0,0,.22)" }}
    >
      <CheckCircle2 size={16} style={{ flex: "none", color: "#8FE3BC" }} />
      <span style={{ textWrap: "pretty" }}>{msg}</span>
    </div>
  ) : null;
  return { toast, toastNode };
}

/** Link Google Maps tìm theo địa chỉ chữ (mở app bản đồ trên điện thoại). */
export function mapsHref(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

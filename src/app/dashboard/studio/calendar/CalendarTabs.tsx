"use client";

import Link from "next/link";
import { Camera, CalendarRange, UsersRound, type LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   DẢI TAB CỦA MÀN LỊCH — /dashboard/studio/calendar?tab=…

   Ba màn lịch cũ (buổi chụp · lịch studio · lịch đội ngũ) gộp về đây. Trước
   đây sidebar có tới bốn dòng chứa chữ "lịch" và nhân viên mới không đoán được
   nên mở dòng nào; giờ chỉ còn MỘT mục, chọn góc nhìn bằng dải tab này.

   Điều hướng bằng ?tab= chứ không bằng state: mỗi tab có URL riêng để gửi cho
   nhau được, F5 không mất chỗ đang xem, và dữ liệu của tab nào chỉ truy vấn khi
   mở đúng tab đó (mỗi tab là một server component riêng).
   ═══════════════════════════════════════════════════════════════════════════ */

export const CALENDAR_TABS = ["shoot", "studio", "team"] as const;
export type CalendarTab = (typeof CALENDAR_TABS)[number];

/** Đọc ?tab= về một giá trị hợp lệ. Sai/thiếu → tab buổi chụp. */
export function readTab(raw: string | string[] | undefined): CalendarTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (CALENDAR_TABS as readonly string[]).includes(v ?? "") ? (v as CalendarTab) : "shoot";
}

const TABS: { key: CalendarTab; label: string; icon: LucideIcon }[] = [
  { key: "shoot", label: "Buổi chụp", icon: Camera },
  { key: "studio", label: "Lịch studio", icon: CalendarRange },
  { key: "team", label: "Đội ngũ", icon: UsersRound },
];

export default function CalendarTabs({
  show,
  active,
}: {
  show: readonly CalendarTab[];
  /** Tab đang mở, do page.tsx quyết định. Truyền xuống chứ không đọc bằng
   *  useSearchParams(): tab nào được phép mở còn phụ thuộc gói và vai trò, và
   *  hook đó bắt cả cây phải nằm trong <Suspense> khi build. */
  active: CalendarTab;
}) {
  const visible = TABS.filter((t) => show.includes(t.key));
  // Chỉ còn một góc nhìn (gói Photographer, hoặc vai trò nhân viên) → không vẽ
  // dải tab: một tab đơn độc chỉ tốn chỗ mà không cho bấm đi đâu.
  if (visible.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Lịch làm việc"
      className="hscroll mb-4 min-w-0 max-w-full gap-[3px] rounded-[11px] p-[3px]"
      style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
    >
      {visible.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.key === "shoot" ? "/dashboard/studio/calendar" : `/dashboard/studio/calendar?tab=${t.key}`}
            role="tab"
            aria-selected={on}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
            style={{
              color: on ? "var(--ac)" : "var(--tx2)",
              background: on ? "var(--sf)" : "transparent",
              boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none",
            }}
          >
            <t.icon size={14} /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}

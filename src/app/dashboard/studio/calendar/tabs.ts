/* ═══════════════════════════════════════════════════════════════════════════
   Khai báo tab của màn Lịch làm việc — module THƯỜNG, cố ý KHÔNG "use client".

   page.tsx (server component) phải đọc ?tab= trước khi chọn tab nào để dựng, mà
   mọi export của một module "use client" đều bị Next biến thành "client
   reference": gọi ở server là văng `readTab is not a function` ngay lúc chạy —
   tsc và next build đều không bắt được. Nên phần LOGIC nằm ở đây, còn
   CalendarTabs.tsx chỉ giữ phần giao diện cần chạy ở trình duyệt.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CALENDAR_TABS = ["shoot", "studio", "team"] as const;
export type CalendarTab = (typeof CALENDAR_TABS)[number];

/** Đọc ?tab= về một giá trị hợp lệ. Sai/thiếu → tab buổi chụp. */
export function readTab(raw: string | string[] | undefined): CalendarTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (CALENDAR_TABS as readonly string[]).includes(v ?? "") ? (v as CalendarTab) : "shoot";
}

/** Đường dẫn của một tab. Tab mặc định để URL sạch, không đeo ?tab=shoot. */
export function tabHref(tab: CalendarTab): string {
  return tab === "shoot" ? "/dashboard/studio/calendar" : `/dashboard/studio/calendar?tab=${tab}`;
}

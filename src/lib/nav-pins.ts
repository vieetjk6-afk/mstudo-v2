/* MỤC GHIM trên menu trái của giao diện mới — studio tự chọn màn hay dùng để
 * nằm trên cùng, các màn còn lại ở trong nhóm thu gọn bên dưới.
 *
 * Module THƯỜNG (không "use client"): layout.tsx là server component đọc cookie
 * ở đây để vẽ đúng menu ngay lần đầu, không nháy menu mặc định rồi mới đổi.
 *
 * Lưu theo TỪNG MÁY (cookie), cố ý: trên điện thoại người ta hay mở Lịch và Hợp
 * đồng, trên máy tính hay mở Thu chi và Album — mỗi máy một bộ ghim là đúng cách
 * dùng thật. Không cần thêm cột nào vào database.
 */
import { NAV_GROUPS } from "@/lib/studio-nav";

export const NAV_PINS_COOKIE = "mstudo_nav_pins";

/** Tối đa bao nhiêu mục ghim — quá nhiều thì phần "hay dùng" lại thành menu dài. */
export const MAX_PINS = 10;

/** Bộ ghim mặc định khi studio chưa tự chọn: các màn mở hằng ngày. */
export const DEFAULT_PINS: readonly string[] = [
  "/dashboard/studio",
  "/staff",
  "/dashboard/studio/contracts",
  "/dashboard/studio/calendar",
  "/dashboard/albums",
  "/dashboard/studio/reports",
  "/dashboard/studio/clients",
];

const KNOWN = new Set(NAV_GROUPS.flatMap((g) => g.items.map((it) => it.href)));

/**
 * Đọc cookie ghim. Trả `null` khi chưa từng chọn (dùng bộ mặc định). Chỉ giữ
 * đường dẫn có thật trong menu, bỏ trùng, cắt ở MAX_PINS — cookie bị sửa tay
 * thành chuỗi lạ cũng không đưa được mục rác lên menu.
 */
export function parseNavPins(raw: string | undefined | null): string[] | null {
  if (raw === undefined || raw === null) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    /* giữ nguyên chuỗi gốc */
  }
  const out: string[] = [];
  for (const h of text.split("|")) {
    if (KNOWN.has(h) && !out.includes(h)) out.push(h);
    if (out.length >= MAX_PINS) break;
  }
  return out;
}

/** Ghi lại thành giá trị cookie (cùng định dạng parseNavPins đọc). */
export function serializeNavPins(pins: readonly string[]): string {
  return encodeURIComponent(pins.filter((h) => KNOWN.has(h)).slice(0, MAX_PINS).join("|"));
}

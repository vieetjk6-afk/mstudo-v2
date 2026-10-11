// Centralised date formatting — the whole app shows dates as ngày/tháng/năm
// (dd/mm/yyyy). Accepts a Date, an ISO string ("2026-06-27") or a timestamp.
import { solarToLunar } from "@/lib/lunar";

// Cả app hiển thị theo giờ Việt Nam (UTC+7, không có giờ mùa hè). Không dựa
// vào getHours()/getDate() theo múi giờ MÁY: máy chủ chạy UTC, khách ở UTC+7 →
// SSR in "07:30" còn trình duyệt in "14:30" (lệch giờ + lỗi hydration), và mốc
// sau 17:00 UTC bị lùi về hôm trước. Mọi thứ đi qua vnParts() bên dưới.
const VN_OFFSET_MS = 7 * 3600 * 1000;

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  // "YYYY-MM-DD" → nửa đêm theo giờ VN của ngày đó (không để múi giờ máy xô ngày).
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - VN_OFFSET_MS);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Ngày/giờ của một thời điểm theo giờ Việt Nam — như nhau trên server lẫn client. */
function vnParts(d: Date) {
  const s = new Date(d.getTime() + VN_OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hours: s.getUTCHours(),
    minutes: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Hôm nay theo giờ Việt Nam (UTC+7) dạng "YYYY-MM-DD" — dùng cho các so sánh
 * ngày (hôm nay/quá hạn/mốc nhắc) để không lệch 1 ngày vào buổi tối như khi
 * lấy trực tiếp toISOString() (UTC). An toàn cả client lẫn server.
 */
export function todayVN(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** dd/mm/yyyy. Returns "" for empty/invalid input. */
export function fmtDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = vnParts(d);
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

/**
 * "14:30 25/08/2026" — ngày kèm giờ, dùng cho mốc thời gian có ý nghĩa theo
 * phút (khách ký lúc nào, studio báo đã chuyển khoản lúc nào).
 *
 * Vì sao phải có hàm riêng: `toLocaleString("vi-VN")` trần cho ra
 * "03:00:00 25/8/2026" — thừa giây, tháng không đệm 0, và đảo giờ lên trước
 * ngày. Cả app hiển thị ngày kiểu dd/mm/yyyy, nên mỗi màn tự gọi toLocaleString
 * là mỗi màn một kiểu.
 */
export function fmtDateTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = vnParts(d);
  return `${pad(p.hours)}:${pad(p.minutes)} ${fmtDate(d)}`;
}

/** dd/mm — dạng ngắn dùng trong bảng, thẻ, lịch. "" nếu rỗng/không hợp lệ. */
export function fmtDayMonth(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = vnParts(d);
  return `${pad(p.day)}/${pad(p.month)}`;
}

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Thứ dạng ngắn: T2 … CN. Bản thiết kế không dùng tên thứ đầy đủ trong bảng. */
export function fmtDow(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? DOW[vnParts(d).dow] : "";
}

/** "T6 · 19/06" — nhãn ngày chuẩn của bản thiết kế. */
export function fmtDowDayMonth(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  return `${fmtDow(d)} · ${fmtDayMonth(d)}`;
}

/** Số ngày từ hôm nay tới `v` (âm = đã qua). null nếu không đọc được ngày. */
export function daysFromToday(v: string | number | Date | null | undefined): number | null {
  const d = toDate(v);
  if (!d) return null;
  const t = toDate(todayVN())!;
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/** Lunar (âm lịch) date: "dd/mm/yyyy" (+ " nhuận" for a leap month). "" if invalid. */
export function fmtLunar(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = vnParts(d);
  const iso = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const l = solarToLunar(iso);
  return `${pad(l.day)}/${pad(l.month)}/${l.year}${l.leap ? " nhuận" : ""}`;
}

/** Solar + lunar together: "dd/mm/yyyy (ÂL dd/mm/yyyy)". "" if invalid. */
export function fmtDateLunar(v: string | number | Date | null | undefined): string {
  const s = fmtDate(v);
  if (!s) return "";
  const l = fmtLunar(v);
  return l ? `${s} (ÂL ${l})` : s;
}

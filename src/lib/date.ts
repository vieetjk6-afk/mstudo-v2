// Centralised date formatting — the whole app shows dates as ngày/tháng/năm
// (dd/mm/yyyy). Accepts a Date, an ISO string ("2026-06-27") or a timestamp.
import { solarToLunar } from "@/lib/lunar";

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  // "YYYY-MM-DD" → treat as a local date (avoid TZ shifting the day).
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
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
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/mm — dạng ngắn dùng trong bảng, thẻ, lịch. "" nếu rỗng/không hợp lệ. */
export function fmtDayMonth(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Thứ dạng ngắn: T2 … CN. Bản thiết kế không dùng tên thứ đầy đủ trong bảng. */
export function fmtDow(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? DOW[d.getDay()] : "";
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
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

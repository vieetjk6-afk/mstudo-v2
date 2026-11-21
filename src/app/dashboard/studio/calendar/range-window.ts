/**
 * Khoảng ngày màn Lịch tải mỗi lượt — dùng chung cho máy chủ (shoot-data.ts) và
 * trình duyệt (useShootCalendar). File thường, KHÔNG "use client": hàm thường
 * nhập từ module client vào server component sẽ thành tham chiếu client, không
 * gọi được.
 */

/** Mỗi lượt tải lịch phủ bao nhiêu tháng về mỗi phía. */
export const WINDOW_MONTHS = 6;

/** Ngày "YYYY-MM-DD" lùi/tiến `months` tháng (giữ ngày, tràn thì về cuối tháng). */
export function shiftMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Ngày liền trước / liền sau của "YYYY-MM-DD". */
export function addDays(ymd: string, n: number): string {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

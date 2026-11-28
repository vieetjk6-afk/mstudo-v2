/* ═══════════════════════════════════════════════════════════════════════════
   LUẬT "hợp đồng này có được lên Google Lịch không" — thuần logic, KHÔNG phụ
   thuộc googleapis hay Supabase, để kiểm thử được bằng `node` (xem
   desktop/test/gcal-sync.mjs) và để MỌI luồng đồng bộ cùng đọc một luật.

   Tách khỏi lib/gcal.ts vì file đó nhập `googleapis`: nhập nó vào một test chạy
   thẳng bằng node là kéo theo cả cây phụ thuộc chỉ để hỏi một câu so sánh chuỗi.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hợp đồng ở trạng thái nào thì được lên lịch Google. */
export const GCAL_CONTRACT_STATUSES = ["approved", "in_progress", "post_production", "completed"] as const;

export type GCalPlan =
  /** Tạo mới hoặc cập nhật sự kiện. */
  | { action: "upsert" }
  /** Gỡ sự kiện cũ (nếu có) và xoá id đã lưu — kèm lý do đọc được cho người dùng. */
  | { action: "drop"; reason: string };

/**
 * Quyết định phải làm gì với sự kiện Google Lịch của một hợp đồng.
 *
 * Hai nhánh "drop" quan trọng ngang nhánh "upsert": hợp đồng bị lùi về nháp, bị
 * huỷ, hay bị xoá ngày chụp mà vẫn còn trên lịch Google là kiểu sai nguy hiểm
 * hơn cả không đồng bộ — thợ vẫn thấy buổi chụp và vẫn tới.
 */
export function gcalPlan(ct: { status?: string | null; event_date?: string | null }): GCalPlan {
  if (!ct.event_date) return { action: "drop", reason: "hợp đồng chưa có ngày chụp" };
  if (!(GCAL_CONTRACT_STATUSES as readonly string[]).includes(ct.status ?? "")) {
    return { action: "drop", reason: "hợp đồng chưa xác nhận/ký — chỉ lịch đã chốt mới lên Google" };
  }
  return { action: "upsert" };
}

/* ── Giờ bắt đầu / kết thúc của sự kiện Google Lịch ─────────────────────────
   Vì sao nằm ở đây (thuần logic): máy chủ Vercel chạy giờ UTC. Bản cũ dựng
   `new Date("2026-12-05T09:00:00")` — chuỗi không có múi giờ nên được hiểu theo
   giờ MÁY CHỦ (UTC), rồi `toISOString()` gửi lên Google "09:00Z" = 16:00 giờ VN:
   mọi buổi chụp có giờ lệch muộn 7 tiếng trên lịch thợ. Ở đây giờ được giữ
   nguyên là giờ VN (dateTime không kèm độ lệch + timeZone tường minh — Google
   chấp nhận đúng dạng này), cộng thời lượng bằng phép tính UTC thuần nên kết quả
   không phụ thuộc múi giờ của máy chạy.

   Sự kiện cả ngày: Google coi `end.date` là ngày KHÔNG bao gồm — end = start bị
   từ chối ("time range is empty"), nên end phải là ngày hôm sau.
   ─────────────────────────────────────────────────────────────────────────── */

export const GCAL_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type GCalEventTimes =
  | { start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }
  | { start: { date: string }; end: { date: string } };

const pad = (n: number) => String(n).padStart(2, "0");

/** "09:00", "9:00", "09:00:00", "8h30", "8h" → [giờ, phút]; không đọc được → null. */
export function parseEventTime(time: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d{1,2})\s*[:hH.]?\s*(\d{2})?/.exec(time ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!(h >= 0 && h <= 23 && min >= 0 && min <= 59)) return null;
  return [h, min];
}

/** Ngày + giờ (giờ VN) + thời lượng (phút) → start/end đúng định dạng Google. */
export function gcalEventTimes(date: string, time: string | null | undefined, durationMin = 120): GCalEventTimes {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const hm = parseEventTime(time);
  if (!d) return { start: { date }, end: { date } }; // ngày lạ: để Google báo lỗi thay vì đoán
  const [y, mo, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  // Dùng Date chỉ như một bộ cộng lịch (UTC thuần) — không bao giờ đọc giờ máy chủ.
  const fmt = (t: Date, withTime: boolean) =>
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
    (withTime ? `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00` : "");
  if (!hm) {
    const next = new Date(Date.UTC(y, mo - 1, day + 1));
    return { start: { date: fmt(new Date(Date.UTC(y, mo - 1, day)), false) }, end: { date: fmt(next, false) } };
  }
  const start = new Date(Date.UTC(y, mo - 1, day, hm[0], hm[1]));
  const end = new Date(start.getTime() + Math.max(1, durationMin) * 60_000);
  return {
    start: { dateTime: fmt(start, true), timeZone: GCAL_TIME_ZONE },
    end: { dateTime: fmt(end, true), timeZone: GCAL_TIME_ZONE },
  };
}

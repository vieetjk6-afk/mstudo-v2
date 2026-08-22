/* ═══════════════════════════════════════════════════════════════════════════
   LUẬT XẾP LỊCH HẸN — phần TÍNH TOÁN THUẦN của lịch studio.

   Tách riêng khỏi `appointments.ts` (nơi có icon và nhãn, tức phải nạp
   lucide-react và React) vì đây là loại code SAI ÂM THẦM: cộng ngày lệch một
   ngày, so giờ hở một phút, tính công suất phòng theo mẫu số sai — không có gì
   nổ, không có gì đỏ, chỉ có studio xếp hai buổi trang điểm vào cùng một người.
   Đứng riêng, nó chạy được trực tiếp trong Node để kiểm thử.

   Vì thế file này KHÔNG import gì cả: kiểu dữ liệu khai theo CẤU TRÚC (chỉ những
   cột thật sự dùng tới), nên `StudioAppointment` và `StudioRoom` của
   src/lib/types.ts tự khớp mà không cần tham chiếu vòng.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Phần thời gian của một lịch hẹn. */
export type ApptTimes = {
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
};

/** Những cột luật xếp lịch cần đọc. Bản ghi thật có nhiều cột hơn — không sao. */
export type ApptRow = ApptTimes & {
  id: string;
  kind: string;
  appt_date: string;
  status: string;
  position: number;
  crew_id: string | null;
  staff_id: string | null;
  crew_name: string | null;
  room: string | null;
};

export type RoomRow = { id: string; name: string; capacity_week: number };

const pad = (n: number) => String(n).padStart(2, "0");

/* ── Ngày & tuần ─────────────────────────────────────────────────────────── */

/** "YYYY-MM-DD" cộng thêm n ngày. Tính bằng Date địa phương nên không bị lệch
 *  một ngày như khi cộng chuỗi ISO rồi đi qua UTC. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Thứ Hai của tuần chứa `ymd` — tuần Việt Nam bắt đầu từ T2 (giống CalendarView). */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const shift = (dt.getDay() + 6) % 7; // CN=6, T2=0
  return addDays(ymd, -shift);
}

/** 7 ngày T2→CN của tuần chứa `ymd`. */
export function weekDays(ymd: string): string[] {
  const mon = mondayOf(ymd);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/* ── Giờ ─────────────────────────────────────────────────────────────────── */

/** "HH:MM" → số phút từ 00:00. null nếu không đọc được (lịch chưa đặt giờ). */
export function toMinutes(hhmm: string | null | undefined): number | null {
  const m = (hhmm ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function fromMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Khoảng thời gian một lịch CHIẾM CHỖ, tính bằng phút trong ngày.
 * Ưu tiên `end_time`; không có thì `duration_min`; không có cả hai thì 60 phút
 * — cần một độ dài mặc định để so trùng lịch, vì "chưa ghi giờ kết thúc" không
 * có nghĩa là "không chiếm chỗ".
 */
export function apptSpan(a: ApptTimes): { start: number; end: number } | null {
  const start = toMinutes(a.start_time);
  if (start == null) return null;
  const end = toMinutes(a.end_time);
  if (end != null && end > start) return { start, end };
  const dur = a.duration_min && a.duration_min > 0 ? a.duration_min : 60;
  return { start, end: start + dur };
}

/** Thời lượng đọc được: "90 phút" / "3g30" / "3 giờ". Rỗng nếu không tính được. */
export function apptDuration(a: ApptTimes): string {
  const span = apptSpan(a);
  if (!span) return "";
  const mins = span.end - span.start;
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} giờ` : `${h}g${pad(m)}`;
}

/** "06:30 – 08:00", hoặc "06:30" khi chưa biết giờ kết thúc, "Cả ngày" khi chưa có giờ. */
export function apptTimeRange(a: ApptTimes): string {
  const start = toMinutes(a.start_time);
  if (start == null) return "Cả ngày";
  const span = apptSpan(a);
  if (!span || !a.end_time) return fromMinutes(start);
  return `${fromMinutes(span.start)} – ${fromMinutes(span.end)}`;
}

/** Thứ tự trong một cột ngày: theo giờ bắt đầu, lịch chưa có giờ xuống cuối. */
export function byStartTime(a: ApptRow, b: ApptRow): number {
  const x = toMinutes(a.start_time);
  const y = toMinutes(b.start_time);
  if (x == null && y == null) return a.position - b.position;
  if (x == null) return 1;
  if (y == null) return -1;
  return x - y || a.position - b.position;
}

/* ── Trùng lịch ──────────────────────────────────────────────────────────── */

/** Khoá người phụ trách: thợ trong sổ, nhân viên có tài khoản, hoặc tên đã ghi. */
export function assigneeKey(a: Pick<ApptRow, "crew_id" | "staff_id" | "crew_name">): string | null {
  return a.crew_id ?? a.staff_id ?? (a.crew_name?.trim() ? `name:${a.crew_name.trim().toLowerCase()}` : null);
}

export function assigneeName(a: Pick<ApptRow, "crew_name">): string {
  return a.crew_name?.trim() || "Chưa phân công";
}

export type Conflict<T> = {
  /** Khoá "<người hoặc phòng>|<ngày>" — đủ để làm key React và để dedupe. */
  key: string;
  name: string;
  scope: "person" | "room";
  date: string;
  items: T[];
};

/**
 * Mọi lịch CHỒNG GIỜ của cùng một người, và của cùng một phòng, trong danh sách.
 *
 * Bỏ qua lịch đã huỷ, và bỏ qua lịch CHƯA ĐẶT GIỜ — không biết giờ thì không thể
 * khẳng định là trùng, mà báo trùng sai còn tệ hơn không báo: studio sẽ học cách
 * phớt lờ cảnh báo.
 *
 * Trả về một mục cho mỗi (người/phòng × ngày) có trùng, kèm ĐỦ các lịch chồng
 * nhau — rail cảnh báo cần hiện "ai, ngày nào, những buổi nào".
 */
export function findConflicts<T extends ApptRow>(list: T[]): Conflict<T>[] {
  const out: Conflict<T>[] = [];

  const scan = (
    scope: "person" | "room",
    keyOf: (a: T) => string | null,
    nameOf: (a: T) => string
  ) => {
    const buckets = new Map<string, T[]>();
    for (const a of list) {
      if (a.status === "cancelled") continue;
      const k = keyOf(a);
      if (!k || !apptSpan(a)) continue;
      const bk = `${k}|${a.appt_date}`;
      const arr = buckets.get(bk);
      if (arr) arr.push(a);
      else buckets.set(bk, [a]);
    }
    for (const [bk, arr] of buckets) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort(byStartTime);
      const hit = new Set<T>();
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = apptSpan(sorted[i])!;
        for (let j = i + 1; j < sorted.length; j++) {
          const nxt = apptSpan(sorted[j])!;
          // Đã sắp theo giờ bắt đầu: buổi này bắt đầu sau khi buổi i kết thúc thì
          // mọi buổi sau nó cũng vậy — dừng luôn.
          if (nxt.start >= cur.end) break;
          hit.add(sorted[i]);
          hit.add(sorted[j]);
        }
      }
      if (!hit.size) continue;
      const items = sorted.filter((a) => hit.has(a));
      out.push({ key: `${scope}:${bk}`, name: nameOf(items[0]), scope, date: items[0].appt_date, items });
    }
  };

  scan("person", assigneeKey, assigneeName);
  scan("room", (a) => (a.room?.trim() ? `room:${a.room.trim().toLowerCase()}` : null), (a) => a.room?.trim() || "Phòng");
  return out;
}

/* ── Công suất phòng ─────────────────────────────────────────────────────── */

export type RoomLoad<T> = { room: T; used: number; pct: number };

/**
 * Số buổi đã xếp vào mỗi phòng trong danh sách (thường là một tuần) và tỷ lệ so
 * với `capacity_week`. Ghép theo TÊN phòng không phân biệt hoa thường, vì
 * `studio_appointments.room` lưu tên chứ không phải khoá ngoại — đổi tên phòng
 * thì lịch cũ vẫn đọc được.
 */
export function roomLoads<T extends RoomRow>(list: Pick<ApptRow, "room" | "status">[], rooms: T[]): RoomLoad<T>[] {
  const used = new Map<string, number>();
  for (const a of list) {
    if (a.status === "cancelled") continue;
    const k = a.room?.trim().toLowerCase();
    if (!k) continue;
    used.set(k, (used.get(k) ?? 0) + 1);
  }
  return rooms.map((room) => {
    const n = used.get(room.name.trim().toLowerCase()) ?? 0;
    const cap = room.capacity_week > 0 ? room.capacity_week : 1;
    return { room, used: n, pct: Math.min(100, Math.round((n / cap) * 100)) };
  });
}

/** Đếm lịch theo loại — số hiện trong chip lọc. Lịch đã huỷ không tính. */
export function countByKind(list: Pick<ApptRow, "kind" | "status">[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of list) {
    if (a.status === "cancelled") continue;
    c[a.kind] = (c[a.kind] ?? 0) + 1;
  }
  return c;
}

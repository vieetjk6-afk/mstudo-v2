/* ═══════════════════════════════════════════════════════════════════════════
   CHỤP THEO KHUNG GIỜ (mini-session) — luật THUẦN: sinh khung, kiểm dữ liệu
   đợt, trạng thái khung, hạn giữ chỗ, tiền cọc, nhãn.

   File này KHÔNG import gì để chạy thẳng trong Node (`npm run test:mini-session`)
   và dùng được ở cả trình duyệt lẫn máy chủ. Luật ở đây phải KHỚP với SQL trong
   supabase/migrations/chup_theo_khung_gio.sql (mini_slot_valid, mini_book_slot):
   database là chốt cuối, còn đây là thứ vẽ lưới và báo lỗi sớm cho người dùng.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Giữ chỗ chờ cọc bao lâu (phút). Đồng hồ dừng khi khách báo đã chuyển / gửi
 *  biên lai, hoặc studio / SePay xác nhận — xem mini_booking_sync trong SQL. */
export const HOLD_MINUTES = 30;

export const MINI_LIMITS = {
  title: 120, location: 200, note: 1000, name: 120, phone: 30,
  slotMin: 5, slotMax: 480, gapMax: 240, maxSlots: 200, money: 100_000_000,
} as const;

export type MiniSession = {
  id: string;
  owner_id: string;
  token: string;
  title: string;
  /** YYYY-MM-DD */
  session_date: string;
  /** Phút từ 00:00. */
  start_min: number;
  end_min: number;
  slot_minutes: number;
  gap_minutes: number;
  price: number;
  deposit: number;
  location: string | null;
  note: string | null;
  is_open: boolean;
  created_at: string;
};

/** Một khung ĐÃ CÓ NGƯỜI (dòng studio_mini_slots). */
export type MiniSlotLock = {
  id: string;
  session_id: string;
  start_min: number;
  booking_id: string | null;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  hold_expires_at: string | null;
  source: "online" | "manual";
  created_at: string;
};

export type SlotState = "free" | "held" | "booked";

const pad = (n: number) => String(n).padStart(2, "0");

/** 545 → "09:05". */
export function hhmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** "09:05" → 545; null nếu không đọc được. */
export function parseHhmm(v: string | null | undefined): number | null {
  const m = (v ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** "09:00–09:20" */
export function slotRange(start: number, slotMinutes: number): string {
  return `${hhmm(start)}–${hhmm(start + slotMinutes)}`;
}

type Grid = Pick<MiniSession, "start_min" | "end_min" | "slot_minutes" | "gap_minutes">;

/** Giờ bắt đầu của mọi khung trong đợt. Khung cuối phải KẾT THÚC trong giờ. */
export function slotStarts(s: Grid): number[] {
  const step = s.slot_minutes + s.gap_minutes;
  if (!(s.slot_minutes > 0) || !(step > 0)) return [];
  const out: number[] = [];
  for (let t = s.start_min; t + s.slot_minutes <= s.end_min && out.length < MINI_LIMITS.maxSlots; t += step) out.push(t);
  return out;
}

/** `start` có phải khung thật của đợt không — bản TS của mini_slot_valid. */
export function isValidSlot(s: Grid, start: number): boolean {
  return (
    Number.isInteger(start) &&
    start >= s.start_min &&
    start + s.slot_minutes <= s.end_min &&
    (start - s.start_min) % (s.slot_minutes + s.gap_minutes) === 0
  );
}

/** Khoá còn hiệu lực: chắc chỗ, hoặc còn trong hạn giữ. */
export function lockLive(l: Pick<MiniSlotLock, "hold_expires_at">, nowMs: number): boolean {
  return !l.hold_expires_at || new Date(l.hold_expires_at).getTime() > nowMs;
}

export function lockState(l: Pick<MiniSlotLock, "hold_expires_at"> | null | undefined, nowMs: number): SlotState {
  if (!l || !lockLive(l, nowMs)) return "free";
  return l.hold_expires_at ? "held" : "booked";
}

export const SLOT_STATE_LABEL: Record<SlotState, string> = {
  free: "Trống",
  held: "Giữ chờ cọc",
  booked: "Đã đặt",
};

export type SlotView<L> = { start: number; range: string; state: SlotState; lock: L | null };

/** Lưới khung của một đợt kèm trạng thái. Khoá hết hạn giữ coi như trống. */
export function slotGrid<L extends Pick<MiniSlotLock, "start_min" | "hold_expires_at">>(
  s: Grid,
  locks: readonly L[],
  nowMs: number,
): SlotView<L>[] {
  const by = new Map<number, L>();
  for (const l of locks) if (lockLive(l, nowMs)) by.set(l.start_min, l);
  return slotStarts(s).map((start) => {
    const lock = by.get(start) ?? null;
    return { start, range: slotRange(start, s.slot_minutes), state: lockState(lock, nowMs), lock };
  });
}

/** Số khung đã có người / tổng số khung. */
export function slotCounts(s: Grid, locks: readonly Pick<MiniSlotLock, "start_min" | "hold_expires_at">[], nowMs: number) {
  const g = slotGrid(s, locks, nowMs);
  return { total: g.length, taken: g.filter((x) => x.state !== "free").length };
}

/** Cọc mỗi khung: không vượt quá giá khung (cọc lớn hơn giá là vô lý). */
export function slotDeposit(price: number, deposit: number): number {
  const p = Math.max(0, Math.round(price || 0));
  const d = Math.max(0, Math.round(deposit || 0));
  return p > 0 ? Math.min(d, p) : d;
}

/** Đợt đã qua ngày chưa (so chuỗi YYYY-MM-DD theo giờ Việt Nam). */
export function sessionPast(sessionDate: string, todayYmd: string): boolean {
  return sessionDate < todayYmd;
}

/** Khung này khách online còn đặt được không: đợt mở, chưa qua, khung chưa bắt đầu. */
export function slotBookable(
  s: Pick<MiniSession, "session_date" | "is_open">,
  start: number,
  todayYmd: string,
  nowMin: number,
): boolean {
  if (!s.is_open || s.session_date < todayYmd) return false;
  return s.session_date > todayYmd || start > nowMin;
}

/* ── Kiểm dữ liệu đợt (form của studio) ─────────────────────────────────── */

export type MiniSessionInput = {
  title: string;
  session_date: string;
  start_min: number;
  end_min: number;
  slot_minutes: number;
  gap_minutes: number;
  price: number;
  deposit: number;
  location: string | null;
  note: string | null;
  is_open: boolean;
};

export type CleanResult = { ok: true; value: MiniSessionInput } | { ok: false; error: string };

const int = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
};
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Làm sạch + kiểm dữ liệu đợt do trình duyệt gửi. Lỗi trả về là câu tiếng Việt hiện thẳng cho studio. */
export function cleanSessionInput(raw: unknown): CleanResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = text(r.title, MINI_LIMITS.title);
  if (!title) return { ok: false, error: "Nhập tên đợt chụp." };
  const date = text(r.session_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    return { ok: false, error: "Chọn ngày chụp." };
  }
  const start = int(r.start_min);
  const end = int(r.end_min);
  if (start == null || end == null || start < 0 || end > 1439) return { ok: false, error: "Chọn giờ bắt đầu và giờ kết thúc." };
  if (end <= start) return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu." };
  const slot = int(r.slot_minutes);
  if (slot == null || slot < MINI_LIMITS.slotMin || slot > MINI_LIMITS.slotMax) {
    return { ok: false, error: `Mỗi khung dài từ ${MINI_LIMITS.slotMin} đến ${MINI_LIMITS.slotMax} phút.` };
  }
  const gap = int(r.gap_minutes) ?? 0;
  if (gap < 0 || gap > MINI_LIMITS.gapMax) return { ok: false, error: `Nghỉ giữa hai khung từ 0 đến ${MINI_LIMITS.gapMax} phút.` };
  const grid = { start_min: start, end_min: end, slot_minutes: slot, gap_minutes: gap };
  const n = slotStarts(grid).length;
  if (n === 0) return { ok: false, error: "Khoảng giờ quá ngắn, không đủ một khung nào." };
  if (start + (n - 1) * (slot + gap) + slot > end || n >= MINI_LIMITS.maxSlots) {
    return { ok: false, error: `Một đợt tối đa ${MINI_LIMITS.maxSlots} khung — tăng độ dài khung hoặc rút ngắn giờ.` };
  }
  const price = int(r.price) ?? 0;
  const deposit = int(r.deposit) ?? 0;
  if (price < 0 || price > MINI_LIMITS.money || deposit < 0 || deposit > MINI_LIMITS.money) {
    return { ok: false, error: "Giá hoặc tiền cọc không hợp lệ." };
  }
  return {
    ok: true,
    value: {
      title,
      session_date: date,
      ...grid,
      price,
      deposit: slotDeposit(price, deposit),
      location: text(r.location, MINI_LIMITS.location) || null,
      note: text(r.note, MINI_LIMITS.note) || null,
      is_open: r.is_open !== false,
    },
  };
}

/**
 * Sửa đợt đã có khách: những khoá nào bị bỏ rơi nếu áp lưới mới? Đổi ngày thì
 * MỌI khách bị ảnh hưởng. Rỗng = sửa được. (Database chặn chặt hơn — mọi đổi
 * ngày / giờ bắt đầu / độ dài / nghỉ khi còn khoá sống đều bị chối — hàm này để
 * báo lý do bằng tên khách trước khi gửi.)
 */
export function orphanedLocks<L extends Pick<MiniSlotLock, "start_min" | "hold_expires_at">>(
  before: Grid & { session_date: string },
  after: Grid & { session_date: string },
  locks: readonly L[],
  nowMs: number,
): L[] {
  const live = locks.filter((l) => lockLive(l, nowMs));
  const gridChanged =
    before.session_date !== after.session_date ||
    before.start_min !== after.start_min ||
    before.slot_minutes !== after.slot_minutes ||
    before.gap_minutes !== after.gap_minutes;
  if (gridChanged) return live;
  return live.filter((l) => !isValidSlot(after, l.start_min));
}

/** Kiểm tên + SĐT khách đặt khung. */
export function cleanCustomer(raw: unknown): { ok: true; name: string; phone: string; note: string | null } | { ok: false; error: "missing" | "phone" } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(r.name, MINI_LIMITS.name);
  const phone = text(r.phone, MINI_LIMITS.phone);
  if (!name || !phone) return { ok: false, error: "missing" };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) return { ok: false, error: "phone" };
  return { ok: true, name, phone, note: text(r.note, MINI_LIMITS.note) || null };
}

/** Phút còn lại của hạn giữ chỗ (làm tròn lên, không âm). */
export function holdMinutesLeft(holdExpiresAt: string | null | undefined, nowMs: number): number {
  if (!holdExpiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(holdExpiresAt).getTime() - nowMs) / 60_000));
}

/** "09:00 – 11:00 · 20 phút/khung" */
export function sessionTimeLabel(s: Grid): string {
  return `${hhmm(s.start_min)} – ${hhmm(s.end_min)} · ${s.slot_minutes} phút/khung${s.gap_minutes ? ` · nghỉ ${s.gap_minutes} phút` : ""}`;
}

/** Đường dẫn trang công khai của một đợt. */
export function miniSessionPath(token: string): string {
  return `/book/dot/${token}`;
}

/**
 * CHẤM CÔNG THỢ — giờ làm THỰC TẾ, và tiền công suy ra từ đó.
 *
 * Vấn đề: app đã có PHÂN CÔNG (`contract_crew`, `crew_shift_plan`) nhưng không
 * ghi THỰC TẾ — thợ có đi không, đến lúc mấy giờ, xong lúc mấy giờ. Nên màn Đối
 * soát tiền công vẫn phải nhập tay từng dòng, và không ai đối chiếu được số đó
 * với bất cứ gì.
 *
 * File này là LUẬT THUẦN trên các dòng chấm công: cộng giờ, phát hiện dòng còn
 * hở, đề xuất tiền công. Không đọc DB, không gọi mạng — kiểm thử bằng node
 * (`npm run test:timesheet`).
 *
 * MỘT ĐIỀU CỐ Ý: thư viện này ĐỀ XUẤT tiền công, KHÔNG tự ghi vào
 * `contract_crew.salary`. Tiền trả cho người thật; studio phải nhìn số giờ, đối
 * chiếu, rồi tự bấm áp dụng. Một phép nhân tự động ghi thẳng vào sổ lương là
 * cách nhanh nhất để mất lòng tin của cả thợ lẫn chủ.
 *
 * Thợ KHÔNG có tài khoản đăng nhập (xem `studio_crew`: khoá theo số điện thoại),
 * nên mọi dòng chấm công đều khoá theo SĐT đã chuẩn hoá, giống `crew_unavailable`.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Hình dữ liệu
   ───────────────────────────────────────────────────────────────────────────── */

export type TimesheetRow = {
  id: string;
  /** SĐT thợ (đã chuẩn hoá còn chữ số). Đây là khoá định danh thợ. */
  phone: string;
  name?: string | null;
  contractId?: string | null;
  /** 'YYYY-MM-DD' — ngày làm, để lọc theo kỳ. */
  workDate: string;
  /** ISO. `null` = chưa bấm bắt đầu (studio nhập bù chỉ có giờ xong). */
  startedAt: string | null;
  /** ISO. `null` = ĐANG LÀM, chưa bấm xong. */
  endedAt: string | null;
  note?: string | null;
};

/** Giờ làm tối đa một buổi coi là hợp lý. Dài hơn = quên bấm "đã xong". */
export const MAX_SESSION_HOURS = 16;

/** Làm tròn giờ về bội số 15 phút — quy ước trả công phổ thông. */
export const ROUND_MINUTES = 15;

export type SessionState = "open" | "done" | "invalid" | "suspicious";

/* ─────────────────────────────────────────────────────────────────────────────
   Giờ làm của một dòng
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Số giờ của một dòng chấm công, làm tròn về bội số 15 phút.
 *
 * `null` nghĩa là KHÔNG TÍNH ĐƯỢC — và mọi chỗ dùng phải tôn trọng điều đó thay
 * vì coi như 0: một dòng chưa bấm xong mà bị tính 0 giờ sẽ làm bảng lương báo
 * thợ đi làm cả ngày mà không được đồng nào.
 */
export function sessionHours(r: Pick<TimesheetRow, "startedAt" | "endedAt">): number | null {
  const a = Date.parse(r.startedAt ?? "");
  const b = Date.parse(r.endedAt ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const ms = b - a;
  if (ms <= 0) return null; // bấm xong TRƯỚC lúc bắt đầu → dữ liệu sai
  const hours = ms / 3_600_000;
  if (hours > MAX_SESSION_HOURS) return null; // quên bấm xong → không đoán
  const step = ROUND_MINUTES / 60;
  return Math.round(hours / step) * step;
}

/**
 * Trạng thái một dòng — quyết định màu và việc nó có được cộng vào tiền không.
 *
 *  - `open`: đã bấm bắt đầu, chưa bấm xong. Đang làm (hoặc quên bấm).
 *  - `done`: đủ hai mốc và hợp lý.
 *  - `invalid`: giờ xong trước giờ bắt đầu, hoặc thiếu giờ bắt đầu.
 *  - `suspicious`: dài hơn MAX_SESSION_HOURS — gần như chắc chắn là quên bấm xong.
 */
export function sessionState(r: Pick<TimesheetRow, "startedAt" | "endedAt">): SessionState {
  const a = Date.parse(r.startedAt ?? "");
  const b = Date.parse(r.endedAt ?? "");
  if (!Number.isFinite(a)) return "invalid";
  if (!Number.isFinite(b)) return "open";
  if (b - a <= 0) return "invalid";
  if ((b - a) / 3_600_000 > MAX_SESSION_HOURS) return "suspicious";
  return "done";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cộng theo người
   ───────────────────────────────────────────────────────────────────────────── */

export type PersonSummary = {
  phone: string;
  name: string;
  /** Số buổi tính được giờ. */
  sessions: number;
  hours: number;
  /** Dòng đang làm / quên bấm xong — studio phải xử lý tay. */
  openCount: number;
  /** Dòng dữ liệu sai hoặc quá dài. */
  problemCount: number;
};

export const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Cộng giờ theo từng thợ. Gom theo SĐT đã chuẩn hoá — cùng cách màn Đối soát
 * tiền công gom `contract_crew`, để hai bảng khớp nhau khi đặt cạnh.
 */
export function summarizeByPerson(rows: TimesheetRow[]): PersonSummary[] {
  const map = new Map<string, PersonSummary>();
  for (const r of rows) {
    const phone = digitsOnly(r.phone);
    if (!phone) continue;
    if (!map.has(phone)) {
      map.set(phone, { phone, name: r.name?.trim() || phone, sessions: 0, hours: 0, openCount: 0, problemCount: 0 });
    }
    const p = map.get(phone)!;
    // Tên: lấy tên đầu tiên không rỗng gặp được, để bảng không hiện SĐT trần khi
    // một dòng thiếu tên mà dòng khác có.
    if (p.name === phone && r.name?.trim()) p.name = r.name.trim();

    const st = sessionState(r);
    if (st === "open") p.openCount++;
    else if (st === "invalid" || st === "suspicious") p.problemCount++;
    else {
      const h = sessionHours(r);
      if (h !== null) {
        p.sessions++;
        p.hours += h;
      }
    }
  }
  return [...map.values()]
    .map((p) => ({ ...p, hours: Math.round(p.hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, "vi"));
}

/** Cộng giờ theo từng hợp đồng (job) — để chốt tiền theo job. */
export function hoursByContract(rows: TimesheetRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const h = sessionHours(r);
    if (h === null || !r.contractId) continue;
    out[r.contractId] = Math.round(((out[r.contractId] ?? 0) + h) * 100) / 100;
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Đề xuất tiền công
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Tiền công ĐỀ XUẤT = giờ × đơn giá, làm tròn tới nghìn đồng.
 *
 * `rate` là `studio_crew.hourly_rate` (VND/giờ). 0 hoặc thiếu ⇒ `null`: studio
 * chưa khai đơn giá thì KHÔNG đề xuất gì, thay vì đề xuất 0₫ rồi có người bấm
 * áp dụng và xoá mất số đã nhập tay.
 */
export function suggestPay(hours: number, rate: number | null | undefined): number | null {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round((hours * r) / 1000) * 1000;
}

/** "6 giờ 30 phút" / "45 phút" — đọc được, không phải "6.5h". */
export function humanHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0 phút";
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Khoảng RẢNH của thợ
   ───────────────────────────────────────────────────────────────────────────── */

export type Slot = { date: string; start: string | null; end: string | null };

/**
 * Thợ có rảnh ngày này không?
 *
 * Hai nguồn ngược nhau, và thứ tự xét là điều quan trọng:
 *  - `unavailable` (bảng `crew_unavailable`): thợ TỰ BÁO bận. Đây là lời nói
 *    trực tiếp của thợ về ngày cụ thể → THẮNG mọi thứ khác.
 *  - `available` (bảng `crew_available`, mới): thợ tự đăng ký khoảng rảnh.
 *
 * Nếu thợ CHƯA đăng ký khoảng rảnh nào cho ngày đó, ta trả `"unknown"` chứ không
 * trả `"free"`: phần lớn thợ sẽ không bao giờ vào đăng ký, và coi "chưa khai" là
 * "rảnh" sẽ khiến màn phân công tự tin gán việc cho người đang đi làm chỗ khác.
 */
export type Availability = "busy" | "free" | "unknown";

export function availabilityOn(
  date: string,
  available: Slot[],
  unavailable: Slot[]
): Availability {
  if (unavailable.some((s) => s.date === date)) return "busy";
  if (available.some((s) => s.date === date)) return "free";
  return "unknown";
}

/** Nhãn cho một khoảng: "Cả ngày" hoặc "08:00–12:00". */
export function slotLabel(s: Slot): string {
  if (!s.start && !s.end) return "Cả ngày";
  if (s.start && s.end) return `${s.start}–${s.end}`;
  return s.start ? `từ ${s.start}` : `tới ${s.end}`;
}

/**
 * KẾ HOẠCH CƯỚI CỦA KHÁCH — /portal/<client_token>/ke-hoach.
 *
 * Khách book gói chụp cưới ở studio thì có thêm một trang tự lên kế hoạch cưới:
 * việc cần làm theo mốc trước ngày cưới, ngân sách, lịch trình ngày cưới. Studio
 * đọc được kế hoạch đó ở màn hợp đồng — ê-kíp biết giờ đón dâu, giờ làm lễ mà
 * không phải gọi hỏi lại.
 *
 * File này là phần LUẬT THUẦN: không đọc DB, không gọi mạng. Máy chủ dùng
 * `applyPlanOp` để ghi, trang khách dùng CHÍNH hàm đó để hiện trước kết quả
 * (optimistic) — hai bên không thể hiểu một thao tác theo hai cách. Kiểm thử ở
 * desktop/test/wedding-plan.mjs.
 *
 * Mọi thao tác đi từ trình duyệt khách lên, nên `applyPlanOp` coi đầu vào là
 * dữ liệu lạ: cắt độ dài chữ, ép số tiền về số nguyên không âm, chặn số dòng.
 * jsonb đọc từ DB cũng đi qua `normalizePlan` vì cột jsonb không có lược đồ.
 */
import { isWeddingReportage, type PackageInfo } from "./automations";

/* ─────────────────────────────────────────────────────────────────────────────
   Hình dữ liệu
   ───────────────────────────────────────────────────────────────────────────── */

/** Mốc trước ngày cưới — việc được xếp theo mốc chứ không theo ngày cụ thể, để
 *  đổi ngày cưới là cả danh sách tự dời theo. */
export type PlanWhen = "m12" | "m6" | "m3" | "w4" | "w1" | "d0" | "after";

/**
 * Việc gắn với dữ liệu của studio — tự tick khi studio đã có dữ liệu đó, khách
 * không phải nhớ đánh dấu (đã ký hợp đồng thì "Chọn studio" xong rồi).
 */
export type PlanLink = "studio" | "shoot" | "invite" | "photos" | "pay";

export type PlanTask = {
  id: string;
  title: string;
  when: PlanWhen;
  done: boolean;
  note?: string;
  link?: PlanLink;
};

export type PlanBudgetLine = {
  id: string;
  cat: BudgetCat;
  name: string;
  /** Dự kiến (đ). */
  estimate: number;
  /** Đã trả (đ). */
  paid: number;
  note?: string;
};

export type PlanDayItem = {
  id: string;
  /** "HH:MM" hoặc "" (chưa chốt giờ — xếp cuối). */
  time: string;
  title: string;
  place?: string;
  /** Ai phụ trách / ai cần có mặt. */
  who?: string;
};

export type WeddingPlanData = {
  wedding_date: string | null;
  budget_total: number;
  tasks: PlanTask[];
  budget: PlanBudgetLine[];
  day: PlanDayItem[];
};

/** Trạng thái tự suy từ dữ liệu studio cho từng việc gắn link. */
export type AutoLinks = Partial<Record<PlanLink, { done: boolean; href?: string; sub?: string }>>;

/* ─────────────────────────────────────────────────────────────────────────────
   Mốc thời gian
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * `daysBefore` = hạn chót tính ngược từ ngày cưới: việc ở mốc "3 – 6 tháng
 * trước" nên xong trước ngày cưới 90 ngày. Âm = sau ngày cưới.
 */
export const PLAN_WHEN: { key: PlanWhen; label: string; daysBefore: number }[] = [
  { key: "m12", label: "6 – 12 tháng trước", daysBefore: 180 },
  { key: "m6", label: "3 – 6 tháng trước", daysBefore: 90 },
  { key: "m3", label: "1 – 3 tháng trước", daysBefore: 30 },
  { key: "w4", label: "2 – 4 tuần trước", daysBefore: 14 },
  { key: "w1", label: "Tuần cuối", daysBefore: 1 },
  { key: "d0", label: "Ngày cưới", daysBefore: 0 },
  { key: "after", label: "Sau ngày cưới", daysBefore: -14 },
];

const WHEN_KEYS = new Set<string>(PLAN_WHEN.map((w) => w.key));
const LINK_KEYS = new Set<string>(["studio", "shoot", "invite", "photos", "pay"]);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" có thật (chặn 31/02) — trả lại đúng chuỗi, hoặc null. */
export function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(ISO_DATE);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  if (+m[1] < 2000 || +m[1] > 2100) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function addDays(iso: string, n: number): string {
  const m = iso.match(ISO_DATE)!;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/** Hạn của một mốc khi đã biết ngày cưới. */
export function whenDue(weddingDate: string | null, when: PlanWhen): string | null {
  const d = cleanDate(weddingDate);
  if (!d) return null;
  const w = PLAN_WHEN.find((x) => x.key === when);
  return w ? addDays(d, -w.daysBefore) : null;
}

/** Số ngày từ `today` tới ngày cưới (âm = đã qua). */
export function daysUntil(weddingDate: string | null, today: string): number | null {
  const a = cleanDate(today);
  const b = cleanDate(weddingDate);
  if (!a || !b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/**
 * Mốc khách nên làm ngay lúc này: mốc sớm nhất còn việc chưa xong mà hạn chưa
 * qua quá xa. Dùng để mở sẵn đúng nhóm khi khách vào trang.
 */
export function currentWhen(weddingDate: string | null, today: string): PlanWhen | null {
  const left = daysUntil(weddingDate, today);
  if (left === null) return null;
  // Mốc đầu tiên mà hạn của nó còn ở phía trước (hoặc là hôm nay).
  for (const w of PLAN_WHEN) if (left >= w.daysBefore) return w.key;
  return "after";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bộ mẫu — việc cần làm, ngân sách
   ───────────────────────────────────────────────────────────────────────────── */

type Seed = [title: string, when: PlanWhen, link?: PlanLink];

/**
 * Việc cần làm của một đám cưới Việt — dạm ngõ, ăn hỏi, lễ gia tiên hai nhà.
 * Mẫu chỉ để khách khỏi bắt đầu từ trang trắng: sửa, xoá, thêm thoải mái.
 */
const SEED_TASKS: Seed[] = [
  ["Thống nhất ngày cưới với hai bên gia đình (xem ngày âm lịch)", "m12"],
  ["Lên ngân sách tổng cho đám cưới", "m12"],
  ["Lập danh sách khách mời sơ bộ", "m12"],
  ["Chọn và đặt nhà hàng / địa điểm tiệc", "m12"],
  ["Chọn studio chụp ảnh cưới", "m12", "studio"],
  ["Lễ dạm ngõ (chạm ngõ)", "m6"],
  ["Chọn váy cưới, áo dài, vest chú rể", "m6"],
  ["Đặt trang điểm cô dâu", "m6"],
  ["Chọn nhẫn cưới", "m6"],
  ["Đặt MC, âm thanh – ánh sáng", "m6"],
  ["Chụp ảnh cưới", "m6", "shoot"],
  ["Lễ ăn hỏi: chuẩn bị tráp, đội bê tráp", "m3"],
  ["Đăng ký kết hôn (CCCD, giấy xác nhận tình trạng hôn nhân)", "m3"],
  ["Làm thiệp cưới (online hoặc in)", "m3", "invite"],
  ["Chốt thực đơn tiệc cưới", "m3"],
  ["Đặt hoa cưới, trang trí bàn gia tiên", "m3"],
  ["Đặt xe hoa", "m3"],
  ["Gửi thiệp mời", "w4"],
  ["Thử váy và trang điểm lần cuối", "w4"],
  ["Chốt số bàn với nhà hàng", "w4"],
  ["Lên kịch bản lễ và tiệc với MC", "w4"],
  ["Chuẩn bị quà cảm ơn, phong bì lì xì", "w4"],
  ["Gọi xác nhận lại giờ với studio, makeup, xe hoa, nhà hàng", "w1"],
  ["Phân công người thân: đón khách, giữ phong bì, đưa đón", "w1"],
  ["Soạn sẵn đồ ngày cưới: nhẫn, giấy tờ, đồ dặm phấn", "w1"],
  ["Nghỉ ngơi, ngủ đủ giấc", "w1"],
  ["Mang nhẫn cưới và giấy tờ", "d0"],
  ["Giao một người giữ phong bì mừng cưới", "d0"],
  ["Chọn ảnh cưới với studio", "after", "photos"],
  ["Thanh toán phần còn lại cho studio", "after", "pay"],
  ["Cảm ơn khách mời và gia đình", "after"],
];

/**
 * Bộ việc mẫu cho một kế hoạch mới.
 *
 * `shootOnWeddingDay`: hợp đồng là gói quay chụp NGÀY CƯỚI (phóng sự) chứ không
 * phải prewedding — khi đó việc "Chụp ảnh cưới" nằm ở chính ngày cưới, không
 * phải 3 – 6 tháng trước.
 */
export function defaultTasks(opts: { shootOnWeddingDay?: boolean } = {}): PlanTask[] {
  return SEED_TASKS.map(([title, when, link], i) => {
    const t: PlanTask = { id: `t${String(i + 1).padStart(2, "0")}`, title, when, done: false };
    if (link) t.link = link;
    if (link === "shoot" && opts.shootOnWeddingDay) {
      t.title = "Quay chụp ngày cưới cùng studio";
      t.when = "d0";
    }
    return t;
  });
}

export const BUDGET_CATS = [
  { key: "party", label: "Tiệc cưới" },
  { key: "outfit", label: "Trang phục" },
  { key: "makeup", label: "Trang điểm" },
  { key: "ring", label: "Nhẫn cưới" },
  { key: "engage", label: "Lễ ăn hỏi" },
  { key: "invite", label: "Thiệp & quà" },
  { key: "decor", label: "Hoa & trang trí" },
  { key: "car", label: "Xe hoa" },
  { key: "music", label: "MC & âm nhạc" },
  { key: "photo", label: "Ảnh & quay phim" },
  { key: "honeymoon", label: "Trăng mật" },
  { key: "other", label: "Khác" },
] as const;

export type BudgetCat = (typeof BUDGET_CATS)[number]["key"];
const CAT_KEYS = new Set<string>(BUDGET_CATS.map((c) => c.key));

export function budgetCatLabel(cat: string): string {
  return BUDGET_CATS.find((c) => c.key === cat)?.label ?? "Khác";
}

const SEED_BUDGET: [BudgetCat, string][] = [
  ["party", "Nhà hàng / tiệc cưới"],
  ["outfit", "Váy cưới, áo dài, vest"],
  ["makeup", "Trang điểm cô dâu"],
  ["ring", "Nhẫn cưới"],
  ["engage", "Tráp ăn hỏi"],
  ["invite", "Thiệp cưới, quà cảm ơn"],
  ["decor", "Hoa cưới, trang trí gia tiên"],
  ["car", "Xe hoa"],
  ["music", "MC, âm thanh – ánh sáng"],
  ["honeymoon", "Trăng mật"],
];

/** Các khoản mẫu, tiền để 0 — khách điền dần. Gói của studio KHÔNG nằm ở đây:
 *  nó là dòng đọc từ hợp đồng (xem `budgetSummary`), không để khách gõ lại. */
export function defaultBudget(): PlanBudgetLine[] {
  return SEED_BUDGET.map(([cat, name], i) => ({ id: `b${String(i + 1).padStart(2, "0")}`, cat, name, estimate: 0, paid: 0 }));
}

/**
 * Lịch trình mẫu một ngày cưới hai lễ (vu quy nhà gái, thành hôn nhà trai) và
 * tiệc tối. KHÔNG gieo sẵn vào kế hoạch mới: studio đọc lịch trình này để xếp
 * ê-kíp, nên giờ nào nằm đó phải là giờ khách đã chốt — khách bấm "Dùng lịch
 * trình mẫu" thì mới có.
 */
const SEED_DAY: [string, string][] = [
  ["04:30", "Trang điểm, làm tóc cô dâu"],
  ["07:00", "Chụp ảnh chuẩn bị: váy, nhẫn, phụ kiện"],
  ["08:00", "Nhà trai đến — lễ gia tiên nhà gái (lễ vu quy)"],
  ["09:30", "Rước dâu về nhà trai"],
  ["10:30", "Lễ gia tiên nhà trai (lễ thành hôn)"],
  ["11:30", "Ăn trưa, nghỉ ngơi"],
  ["16:00", "Trang điểm lại cho tiệc tối"],
  ["17:30", "Đón khách, chụp ảnh với khách mời"],
  ["18:30", "Khai tiệc: lên sân khấu, cắt bánh, rót rượu"],
  ["21:00", "Tiễn khách"],
];

export function templateDay(newId: () => string): PlanDayItem[] {
  return SEED_DAY.map(([time, title]) => ({ id: newId(), time, title }));
}

/** Kế hoạch mới cho một hợp đồng. */
export function newPlan(opts: { weddingDate?: string | null; shootOnWeddingDay?: boolean }): WeddingPlanData {
  return {
    wedding_date: cleanDate(opts.weddingDate ?? null),
    budget_total: 0,
    tasks: defaultTasks({ shootOnWeddingDay: opts.shootOnWeddingDay }),
    budget: defaultBudget(),
    day: [],
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Hợp đồng nào có kế hoạch cưới
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Chữ của một đám cưới trong tên hợp đồng / gói / hạng mục. So trên chữ CÓ DẤU:
 * bỏ dấu thì "cưới" và "cuối" cùng ra "cuoi" — "Chụp kỷ yếu cuối cấp" thành
 * gói cưới.
 */
const WEDDING_WORDS = /cưới|cô dâu|chú rể|ăn hỏi|đính hôn|dạm ngõ|chạm ngõ|vu quy|thành hôn|rước dâu|đón dâu|wedding|bridal|pre-?wed/;

/** Gói này là gói CƯỚI (prewedding, phóng sự cưới, makeup cô dâu…)? */
export function isWeddingPackage(p: PackageInfo): boolean {
  if (p.shootType === "prewedding" || p.shootType === "wedding" || p.shootType === "psc") return true;
  if (isWeddingReportage(p)) return true;
  const hay = [p.title, p.serviceName, ...(p.itemNames ?? [])].filter(Boolean).join(" | ").normalize("NFC").toLowerCase();
  return WEDDING_WORDS.test(hay);
}

/**
 * Cổng khách có hiện kế hoạch cưới không.
 *   · studio chọn riêng cho hợp đồng (`studio_contracts.wedding_planner`) thì theo đó;
 *   · không thì: gói cưới, hoặc khách đã có kế hoạch (studio đổi tên gói sau
 *     này không được làm khách mất trang đang dùng).
 */
export function plannerEnabled(p: PackageInfo & { toggle?: boolean | null; hasPlan?: boolean }): boolean {
  if (p.toggle === true) return true;
  if (p.toggle === false) return false;
  return !!p.hasPlan || isWeddingPackage(p);
}

/**
 * Ngày cưới điền sẵn cho kế hoạch mới. Chỉ lấy ngày của hợp đồng khi hợp đồng
 * là gói quay chụp NGÀY CƯỚI — ngày của hợp đồng prewedding là ngày chụp, có khi
 * trước đám cưới nửa năm; điền nó vào là cả danh sách việc lệch theo.
 */
export function shootsWeddingDay(p: PackageInfo): boolean {
  if (p.shootType === "prewedding") return false;
  return isWeddingReportage(p);
}

/** Kế hoạch mới của một hợp đồng: ngày cưới điền sẵn khi hợp đồng quay chụp chính ngày cưới. */
export function seedPlanFor(eventDate: string | null, p: PackageInfo): WeddingPlanData {
  const onDay = shootsWeddingDay(p);
  return newPlan({ weddingDate: onDay ? eventDate : null, shootOnWeddingDay: onDay });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Việc gắn với dữ liệu studio
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Buổi chụp đã xong chưa — cùng luật với bước "Trang điểm & chụp" của cổng
 * khách (portalSteps): lịch hẹn chụp / trang điểm đã xong hoặc đã qua, hoặc
 * ngày của hợp đồng đã qua.
 */
export function shootDone(
  appts: { kind: string; status: string; appt_date: string }[],
  eventDate: string | null,
  today: string,
): boolean {
  const shootKinds = ["pre", "makeup", "shoot"];
  if (appts.some((a) => shootKinds.includes(a.kind) && a.status !== "cancelled" && (a.status === "done" || a.appt_date < today))) return true;
  return !!eventDate && eventDate < today;
}

export type AutoInput = {
  studioName: string;
  /** Khách đã ký hợp đồng. */
  signed: boolean;
  /** Buổi chụp đã xong (lịch hẹn chụp đã qua / đã đánh dấu xong). */
  shot: boolean;
  /** Thiệp cưới online studio tặng (nếu có). */
  invitation: { published: boolean; href: string } | null;
  /** Album của hợp đồng (nếu có): `picked` = khách đã chọn ảnh xong / đã giao. */
  album: { picked: boolean; href: string } | null;
  total: number;
  paid: number;
};

export function autoLinks(a: AutoInput): AutoLinks {
  const left = Math.max(0, a.total - a.paid);
  return {
    studio: { done: a.signed, sub: a.signed ? `Đã đặt với ${a.studioName}` : `Ký hợp đồng với ${a.studioName} để giữ lịch` },
    shoot: { done: a.shot, sub: a.shot ? `${a.studioName} đã chụp xong` : `Xem lịch hẹn ở trang hợp đồng` },
    invite: a.invitation
      ? { done: a.invitation.published, href: a.invitation.href, sub: a.invitation.published ? "Thiệp đã xuất bản" : `${a.studioName} tặng thiệp online — mở để sửa` }
      : { done: false },
    photos: a.album
      ? { done: a.album.picked, href: a.album.href, sub: a.album.picked ? "Đã chọn xong" : "Album đã sẵn sàng để chọn" }
      : { done: false },
    pay: a.total > 0 ? { done: left === 0, sub: left === 0 ? "Đã thanh toán đủ" : `Còn ${left.toLocaleString("vi-VN")}đ` } : { done: false },
  };
}

export function taskDone(t: PlanTask, auto: AutoLinks): boolean {
  return t.done || (!!t.link && !!auto[t.link]?.done);
}

export function planProgress(tasks: PlanTask[], auto: AutoLinks): { done: number; total: number } {
  return { done: tasks.filter((t) => taskDone(t, auto)).length, total: tasks.length };
}

/** Việc theo từng mốc, đúng thứ tự mốc; mốc không có việc thì bỏ. */
export function groupTasks(tasks: PlanTask[]): { when: (typeof PLAN_WHEN)[number]; tasks: PlanTask[] }[] {
  return PLAN_WHEN.map((w) => ({ when: w, tasks: tasks.filter((t) => t.when === w.key) })).filter((g) => g.tasks.length > 0);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ngân sách, lịch trình
   ───────────────────────────────────────────────────────────────────────────── */

export type StudioBudgetLine = { name: string; estimate: number; paid: number };

/**
 * Tổng ngân sách. `left` = ngân sách còn lại sau các khoản dự kiến — null khi
 * khách chưa đặt ngân sách tổng (không có gì để trừ).
 */
export function budgetSummary(lines: PlanBudgetLine[], studio: StudioBudgetLine | null, total: number) {
  const estimate = lines.reduce((s, l) => s + l.estimate, 0) + (studio?.estimate ?? 0);
  const paid = lines.reduce((s, l) => s + l.paid, 0) + (studio?.paid ?? 0);
  return {
    estimate,
    paid,
    left: total > 0 ? total - estimate : null,
    over: total > 0 && estimate > total,
    /** % ngân sách đã dự kiến dùng, kẹp 0–100 cho thanh tiến độ. */
    pct: total > 0 ? Math.min(100, Math.round((estimate / total) * 100)) : 0,
  };
}

export type DayRow = PlanDayItem & { studio?: boolean };

/**
 * Lịch trình hiển thị = dòng khách tự lập + lịch hẹn của studio trong ngày cưới
 * (đánh dấu `studio`, chỉ đọc). Sắp theo giờ; dòng chưa có giờ xuống cuối, giữ
 * nguyên thứ tự khách nhập.
 */
export function mergeDay(day: PlanDayItem[], studio: DayRow[]): DayRow[] {
  const rows: DayRow[] = [...day, ...studio.map((s) => ({ ...s, studio: true }))];
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (!a.r.time && !b.r.time) return a.i - b.i;
      if (!a.r.time) return 1;
      if (!b.r.time) return -1;
      return a.r.time.localeCompare(b.r.time) || a.i - b.i;
    })
    .map((x) => x.r);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Kiểm dữ liệu
   ───────────────────────────────────────────────────────────────────────────── */

export const PLAN_LIMITS = { tasks: 150, budget: 80, day: 60, title: 160, name: 120, note: 500, short: 120 } as const;
/** Trần một khoản tiền: 1.000 tỷ — đủ xa mọi đám cưới, vẫn nằm gọn trong số nguyên an toàn của JS. */
const MAX_MONEY = 1_000_000_000_000;

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Ghi chú giữ xuống dòng, chỉ gọn khoảng trắng thừa hai đầu. */
function note(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\r\n?/g, "\n").trim().slice(0, PLAN_LIMITS.note);
  return s || undefined;
}

function money(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/\D/g, "")) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_MONEY, Math.round(n));
}

/** "8:5" → "08:05"; giờ không hợp lệ → "". */
export function cleanTime(v: unknown): string {
  if (typeof v !== "string") return "";
  const m = v.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "";
  const h = +m[1];
  const mi = +m[2];
  if (h > 23 || mi > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

const ID = /^[a-z0-9-]{2,40}$/i;

function cleanTask(raw: unknown): PlanTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && ID.test(r.id) ? r.id : null;
  const title = text(r.title, PLAN_LIMITS.title);
  if (!id || !title) return null;
  const t: PlanTask = { id, title, when: WHEN_KEYS.has(r.when as string) ? (r.when as PlanWhen) : "m3", done: r.done === true };
  const n = note(r.note);
  if (n) t.note = n;
  if (LINK_KEYS.has(r.link as string)) t.link = r.link as PlanLink;
  return t;
}

function cleanBudget(raw: unknown): PlanBudgetLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && ID.test(r.id) ? r.id : null;
  if (!id) return null;
  const cat = CAT_KEYS.has(r.cat as string) ? (r.cat as BudgetCat) : "other";
  const l: PlanBudgetLine = { id, cat, name: text(r.name, PLAN_LIMITS.name), estimate: money(r.estimate), paid: money(r.paid) };
  const n = note(r.note);
  if (n) l.note = n;
  return l;
}

function cleanDay(raw: unknown): PlanDayItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && ID.test(r.id) ? r.id : null;
  const title = text(r.title, PLAN_LIMITS.title);
  if (!id || !title) return null;
  const d: PlanDayItem = { id, time: cleanTime(r.time), title };
  const place = text(r.place, PLAN_LIMITS.short);
  const who = text(r.who, PLAN_LIMITS.short);
  if (place) d.place = place;
  if (who) d.who = who;
  return d;
}

function cleanList<T extends { id: string }>(raw: unknown, each: (x: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of raw) {
    const v = each(x);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** Dòng `wedding_plans` (jsonb không lược đồ) → dữ liệu sạch. */
export function normalizePlan(row: {
  wedding_date?: unknown;
  budget_total?: unknown;
  tasks?: unknown;
  budget?: unknown;
  day_plan?: unknown;
} | null | undefined): WeddingPlanData {
  return {
    wedding_date: cleanDate(row?.wedding_date ?? null),
    budget_total: money(row?.budget_total),
    tasks: cleanList(row?.tasks, cleanTask, PLAN_LIMITS.tasks),
    budget: cleanList(row?.budget, cleanBudget, PLAN_LIMITS.budget),
    day: cleanList(row?.day_plan, cleanDay, PLAN_LIMITS.day),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Thao tác
   ───────────────────────────────────────────────────────────────────────────── */

export type PlanOp =
  | { op: "set_date"; date: string | null }
  | { op: "set_budget_total"; amount: number }
  | { op: "task_add"; id?: string; title: string; when: PlanWhen }
  | { op: "task_set"; id: string; done?: boolean; title?: string; when?: PlanWhen; note?: string }
  | { op: "task_remove"; id: string }
  | { op: "budget_add"; id?: string; cat: BudgetCat; name: string; estimate?: number; paid?: number }
  | { op: "budget_set"; id: string; cat?: BudgetCat; name?: string; estimate?: number; paid?: number; note?: string }
  | { op: "budget_remove"; id: string }
  | { op: "day_add"; id?: string; time: string; title: string; place?: string; who?: string }
  | { op: "day_set"; id: string; time?: string; title?: string; place?: string; who?: string }
  | { op: "day_remove"; id: string }
  | { op: "day_template" };

export type OpResult = { ok: true; plan: WeddingPlanData } | { ok: false; error: string };

/** Mã ngẫu nhiên cho dòng mới — trình duyệt tạo sẵn để máy chủ dùng đúng mã đó. */
export function newPlanId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Mã dòng mới: dùng mã trình duyệt gửi lên nếu hợp lệ và chưa trùng. */
function pickId(want: unknown, taken: { id: string }[], newId: () => string): string {
  if (typeof want === "string" && ID.test(want) && !taken.some((x) => x.id === want)) return want;
  let id = newId();
  while (taken.some((x) => x.id === id)) id = newId();
  return id;
}

/**
 * Áp MỘT thao tác lên kế hoạch, trả bản mới (không sửa bản cũ). Thao tác lạ /
 * thiếu dữ liệu → `{ ok: false }`, không đoán. Sửa/xoá một dòng không còn (máy
 * kia vừa xoá) cũng là lỗi `gone` — nói thẳng thay vì im lặng như đã lưu.
 */
export function applyPlanOp(plan: WeddingPlanData, raw: unknown, newId: () => string = newPlanId): OpResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "bad_op" };
  const o = raw as Record<string, unknown>;
  const p: WeddingPlanData = { ...plan, tasks: [...plan.tasks], budget: [...plan.budget], day: [...plan.day] };
  const idx = <T extends { id: string }>(list: T[]) => list.findIndex((x) => x.id === o.id);

  switch (o.op) {
    case "set_date": {
      if (o.date === null || o.date === "") return { ok: true, plan: { ...p, wedding_date: null } };
      const d = cleanDate(o.date);
      if (!d) return { ok: false, error: "bad_date" };
      return { ok: true, plan: { ...p, wedding_date: d } };
    }
    case "set_budget_total":
      return { ok: true, plan: { ...p, budget_total: money(o.amount) } };

    case "task_add": {
      const title = text(o.title, PLAN_LIMITS.title);
      if (!title) return { ok: false, error: "empty" };
      if (p.tasks.length >= PLAN_LIMITS.tasks) return { ok: false, error: "too_many" };
      const when = WHEN_KEYS.has(o.when as string) ? (o.when as PlanWhen) : "m3";
      p.tasks.push({ id: pickId(o.id, p.tasks, newId), title, when, done: false });
      return { ok: true, plan: p };
    }
    case "task_set": {
      const i = idx(p.tasks);
      if (i < 0) return { ok: false, error: "gone" };
      const t = { ...p.tasks[i] };
      if (typeof o.done === "boolean") t.done = o.done;
      if (o.title !== undefined) {
        const title = text(o.title, PLAN_LIMITS.title);
        if (!title) return { ok: false, error: "empty" };
        t.title = title;
      }
      if (o.when !== undefined) {
        if (!WHEN_KEYS.has(o.when as string)) return { ok: false, error: "bad_when" };
        t.when = o.when as PlanWhen;
      }
      if (o.note !== undefined) {
        const n = note(o.note);
        if (n) t.note = n;
        else delete t.note;
      }
      p.tasks[i] = t;
      return { ok: true, plan: p };
    }
    case "task_remove": {
      const i = idx(p.tasks);
      if (i < 0) return { ok: false, error: "gone" };
      p.tasks.splice(i, 1);
      return { ok: true, plan: p };
    }

    case "budget_add": {
      if (p.budget.length >= PLAN_LIMITS.budget) return { ok: false, error: "too_many" };
      const name = text(o.name, PLAN_LIMITS.name);
      const cat = CAT_KEYS.has(o.cat as string) ? (o.cat as BudgetCat) : "other";
      if (!name && cat === "other") return { ok: false, error: "empty" };
      p.budget.push({ id: pickId(o.id, p.budget, newId), cat, name: name || budgetCatLabel(cat), estimate: money(o.estimate), paid: money(o.paid) });
      return { ok: true, plan: p };
    }
    case "budget_set": {
      const i = idx(p.budget);
      if (i < 0) return { ok: false, error: "gone" };
      const l = { ...p.budget[i] };
      if (o.cat !== undefined) {
        if (!CAT_KEYS.has(o.cat as string)) return { ok: false, error: "bad_cat" };
        l.cat = o.cat as BudgetCat;
      }
      if (o.name !== undefined) l.name = text(o.name, PLAN_LIMITS.name);
      if (o.estimate !== undefined) l.estimate = money(o.estimate);
      if (o.paid !== undefined) l.paid = money(o.paid);
      if (o.note !== undefined) {
        const n = note(o.note);
        if (n) l.note = n;
        else delete l.note;
      }
      p.budget[i] = l;
      return { ok: true, plan: p };
    }
    case "budget_remove": {
      const i = idx(p.budget);
      if (i < 0) return { ok: false, error: "gone" };
      p.budget.splice(i, 1);
      return { ok: true, plan: p };
    }

    case "day_add": {
      const title = text(o.title, PLAN_LIMITS.title);
      if (!title) return { ok: false, error: "empty" };
      if (p.day.length >= PLAN_LIMITS.day) return { ok: false, error: "too_many" };
      const d: PlanDayItem = { id: pickId(o.id, p.day, newId), time: cleanTime(o.time), title };
      const place = text(o.place, PLAN_LIMITS.short);
      const who = text(o.who, PLAN_LIMITS.short);
      if (place) d.place = place;
      if (who) d.who = who;
      p.day.push(d);
      return { ok: true, plan: p };
    }
    case "day_set": {
      const i = idx(p.day);
      if (i < 0) return { ok: false, error: "gone" };
      const d = { ...p.day[i] };
      if (o.time !== undefined) d.time = cleanTime(o.time);
      if (o.title !== undefined) {
        const title = text(o.title, PLAN_LIMITS.title);
        if (!title) return { ok: false, error: "empty" };
        d.title = title;
      }
      for (const k of ["place", "who"] as const) {
        if (o[k] === undefined) continue;
        const v = text(o[k], PLAN_LIMITS.short);
        if (v) d[k] = v;
        else delete d[k];
      }
      p.day[i] = d;
      return { ok: true, plan: p };
    }
    case "day_remove": {
      const i = idx(p.day);
      if (i < 0) return { ok: false, error: "gone" };
      p.day.splice(i, 1);
      return { ok: true, plan: p };
    }
    case "day_template": {
      // Chỉ khi lịch trình còn trống: bấm nhầm không được nhân đôi cả ngày.
      if (p.day.length > 0) return { ok: false, error: "not_empty" };
      return { ok: true, plan: { ...p, day: templateDay(newId) } };
    }
  }
  return { ok: false, error: "bad_op" };
}

/** Lỗi của `applyPlanOp` / route → câu cho khách đọc. */
export function planErrorText(code: string): string {
  switch (code) {
    case "empty": return "Bạn chưa nhập nội dung.";
    case "too_many": return "Danh sách đã quá dài — xoá bớt dòng cũ trước khi thêm.";
    case "bad_date": return "Ngày chưa đúng — nhập theo dạng ngày/tháng/năm.";
    case "gone": return "Dòng này vừa bị xoá ở máy khác. Trang đã tải lại bản mới nhất.";
    case "not_empty": return "Lịch trình đã có nội dung.";
    case "plan_locked": return "Trang tạm khoá do gói dịch vụ của studio đã hết hạn. Vui lòng liên hệ studio.";
    case "busy": return "Đang có người khác cùng sửa — thử lại sau giây lát.";
    case "offline": return "Mất mạng — thay đổi chưa được lưu.";
    default: return "Chưa lưu được, thử lại sau.";
  }
}

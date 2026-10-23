/**
 * KẾ HOẠCH CƯỚI CỦA KHÁCH — /portal/<client_token>/ke-hoach.
 *
 * Khách book gói chụp cưới ở studio thì có thêm một trang tự lên kế hoạch cưới:
 * việc cần làm theo mốc trước ngày cưới, ngân sách, khách mời & xếp bàn, nhà
 * cung cấp, lịch trình ngày cưới, đồ cần mang, phong cách và danh sách ảnh cần
 * chụp. Studio đọc được phần vận hành ở màn hợp đồng — ê-kíp biết giờ đón dâu,
 * ai là phù dâu, phải chụp những tấm nào — mà không phải gọi hỏi lại.
 *
 * File này là phần LUẬT THUẦN: không đọc DB, không gọi mạng. Máy chủ dùng
 * `applyPlanOp` để ghi, trang khách dùng CHÍNH hàm đó để hiện trước kết quả
 * (optimistic) — hai bên không thể hiểu một thao tác theo hai cách. Kiểm thử ở
 * desktop/test/wedding-plan.mjs.
 *
 * Mọi thao tác đi từ trình duyệt khách lên, nên dữ liệu vào luôn đi qua bộ làm
 * sạch của từng loại dòng (`CLEAN`): cắt độ dài chữ, ép số tiền về số nguyên
 * không âm, chặn số dòng. jsonb đọc từ DB đi qua đúng bộ đó (`normalizePlan`) vì
 * cột jsonb không có lược đồ. Thêm / sửa / xoá dùng CHUNG một cơ chế cho mọi
 * danh sách — thêm một danh sách mới là thêm một bộ làm sạch, không thêm thao tác.
 */
import { isWeddingReportage, type PackageInfo } from "./automations";
import { safeUrl } from "./final-links";
import { parseHex } from "./wedding-palette";

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

/** Ai lo việc này. */
export type TaskOwner = "bride" | "groom" | "both" | "family";
export type TaskPriority = "high" | "mid" | "low";
/** Mốc lịch trình / người hỗ trợ thuộc bên nào. Không có = chung. */
export type Side = "bride" | "groom";
/** Ai chi khoản này. */
export type Payer = "bride" | "groom" | "bride_family" | "groom_family" | "both";
export type GuestGroup = "bride_family" | "groom_family" | "bride_friends" | "groom_friends" | "colleagues" | "common" | "other";
export type Rsvp = "pending" | "yes" | "no";

export type PlanTask = {
  id: string;
  title: string;
  when: PlanWhen;
  done: boolean;
  note?: string;
  link?: PlanLink;
  owner?: TaskOwner;
  priority?: TaskPriority;
  /** Hạn riêng "YYYY-MM-DD" — thay cho hạn của mốc. */
  due?: string;
};

export type PlanBudgetLine = {
  id: string;
  cat: BudgetCat;
  name: string;
  /** Dự kiến (đ). */
  estimate: number;
  /** Thực tế — giá đã chốt với bên cung cấp (đ). 0 = chưa chốt, tính theo dự kiến. */
  actual: number;
  /** Đã trả (đ). */
  paid: number;
  payer?: Payer;
  /** Hạn trả phần còn lại. */
  due?: string;
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
  side?: Side;
};

export type PlanGuest = {
  id: string;
  /** Tên hiển thị — một người, hoặc cả nhà ("Gia đình chú Ba"). */
  name: string;
  group: GuestGroup;
  /** Số người của lời mời này. */
  count: number;
  phone?: string;
  /** Đã gửi thiệp. */
  invited: boolean;
  /** Xác nhận ghi tay; phản hồi từ thiệp online (khớp theo tên) được ưu tiên hơn. */
  rsvp: Rsvp;
  /** Bàn — "1", "VIP", "Bàn nhà trai 3"… */
  table?: string;
  /** Tiền mừng (đ). */
  gift: number;
  /** Đã gửi lời cảm ơn. */
  thanked: boolean;
  note?: string;
};

export type VendorStatus = "consider" | "booked";
export type PlanVendor = {
  id: string;
  cat: BudgetCat;
  name: string;
  phone?: string;
  link?: string;
  /** Báo giá (đ). */
  quote: number;
  status: VendorStatus;
  note?: string;
};

/** Đội hỗ trợ ngày cưới: phù dâu, phù rể, bê tráp, MC, người giữ phong bì… */
export type PlanPerson = { id: string; name: string; role: string; phone?: string; side?: Side };

/** Đồ cần mang ngày cưới. */
export type PlanPack = { id: string; name: string; qty: number; packed: boolean };

/** Ảnh cần chụp — ê-kíp studio đọc danh sách này. `must` = nhất định phải có. */
export type PlanShot = { id: string; title: string; must: boolean };

export type PlanStyle = {
  /** "#rrggbb" — bảng màu cưới. */
  colors: string[];
  /** Concept / phong cách / chủ đề trang trí. */
  concept?: string;
  /** Link cảm hứng (Pinterest, Instagram…). */
  links: string[];
};

export type PlanSettings = {
  /** Số người một bàn — để đếm bàn và cảnh báo bàn vượt sức chứa. */
  table_size: number;
  /** Số khách dự kiến khi chưa lập danh sách. */
  guests_expected: number;
};

export type WeddingPlanData = {
  wedding_date: string | null;
  budget_total: number;
  tasks: PlanTask[];
  budget: PlanBudgetLine[];
  day: PlanDayItem[];
  guests: PlanGuest[];
  vendors: PlanVendor[];
  people: PlanPerson[];
  packing: PlanPack[];
  shots: PlanShot[];
  style: PlanStyle;
  settings: PlanSettings;
};

/** Các danh sách thêm / sửa / xoá được bằng thao tác chung. */
export type PlanList = "tasks" | "budget" | "day" | "guests" | "vendors" | "people" | "packing" | "shots";

/**
 * Danh sách nằm trong cột `extra` (migrations/ke_hoach_cuoi_mo_rong.sql). Database
 * chưa chạy migration đó thì chỉ ba danh sách gốc (việc, ngân sách, lịch trình)
 * lưu được — xem `opNeedsExtra`.
 */
export const EXTRA_LISTS: PlanList[] = ["guests", "vendors", "people", "packing", "shots"];

/** Trạng thái tự suy từ dữ liệu studio cho từng việc gắn link. */
export type AutoLinks = Partial<Record<PlanLink, { done: boolean; href?: string; sub?: string }>>;

/* ─────────────────────────────────────────────────────────────────────────────
   Nhãn
   ───────────────────────────────────────────────────────────────────────────── */

export const OWNER_LABEL: Record<TaskOwner, string> = { bride: "Cô dâu", groom: "Chú rể", both: "Cả hai", family: "Gia đình" };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: "Ưu tiên cao", mid: "Vừa", low: "Thấp" };
export const SIDE_LABEL: Record<Side, string> = { bride: "Cô dâu", groom: "Chú rể" };
export const PAYER_LABEL: Record<Payer, string> = {
  bride: "Cô dâu", groom: "Chú rể", bride_family: "Nhà gái", groom_family: "Nhà trai", both: "Hai bên",
};
export const GUEST_GROUP_LABEL: Record<GuestGroup, string> = {
  bride_family: "Họ hàng nhà gái",
  groom_family: "Họ hàng nhà trai",
  bride_friends: "Bạn cô dâu",
  groom_friends: "Bạn chú rể",
  colleagues: "Đồng nghiệp",
  common: "Bạn chung",
  other: "Khác",
};
export const RSVP_LABEL: Record<Rsvp, string> = { pending: "Chưa phản hồi", yes: "Sẽ dự", no: "Không dự" };
export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = { consider: "Đang cân nhắc", booked: "Đã chốt" };
/** Gợi ý vai trò cho đội hỗ trợ (ô nhập vẫn gõ tự do). */
export const PERSON_ROLES = ["Phù dâu", "Phù rể", "Bê tráp", "MC", "Chủ hôn", "Đại diện nhà gái", "Đại diện nhà trai", "Giữ phong bì", "Đón khách", "Lái xe"];

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

export function addDays(iso: string, n: number): string {
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

/** Hạn của một việc: hạn riêng nếu có, không thì hạn của mốc. */
export function taskDue(t: PlanTask, weddingDate: string | null): string | null {
  return t.due ?? whenDue(weddingDate, t.when);
}

/** Số ngày từ `today` tới `date` (âm = đã qua). */
export function daysUntil(date: string | null, today: string): number | null {
  const a = cleanDate(today);
  const b = cleanDate(date);
  if (!a || !b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** Mốc khách nên làm ngay lúc này — mốc đầu tiên mà hạn còn ở phía trước. */
export function currentWhen(weddingDate: string | null, today: string): PlanWhen | null {
  const left = daysUntil(weddingDate, today);
  if (left === null) return null;
  for (const w of PLAN_WHEN) if (left >= w.daysBefore) return w.key;
  return "after";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bộ mẫu
   ───────────────────────────────────────────────────────────────────────────── */

type Seed = [title: string, when: PlanWhen, link?: PlanLink | null, priority?: TaskPriority];

/**
 * Việc cần làm của một đám cưới Việt — dạm ngõ, ăn hỏi, lễ gia tiên hai nhà.
 * Mẫu chỉ để khách khỏi bắt đầu từ trang trắng: sửa, xoá, thêm thoải mái.
 */
const SEED_TASKS: Seed[] = [
  ["Thống nhất ngày cưới với hai bên gia đình (xem ngày âm lịch)", "m12", null, "high"],
  ["Lên ngân sách tổng cho đám cưới", "m12"],
  ["Lập danh sách khách mời sơ bộ", "m12"],
  ["Chọn và đặt nhà hàng / địa điểm tiệc", "m12", null, "high"],
  ["Chọn studio chụp ảnh cưới", "m12", "studio"],
  ["Lễ dạm ngõ (chạm ngõ)", "m6"],
  ["Chọn váy cưới, áo dài, vest chú rể", "m6"],
  ["Đặt trang điểm cô dâu", "m6"],
  ["Chọn nhẫn cưới", "m6"],
  ["Đặt MC, âm thanh – ánh sáng", "m6"],
  ["Chụp ảnh cưới", "m6", "shoot"],
  ["Lễ ăn hỏi: chuẩn bị tráp, đội bê tráp", "m3"],
  ["Đăng ký kết hôn (CCCD, giấy xác nhận tình trạng hôn nhân)", "m3", null, "high"],
  ["Làm thiệp cưới (online hoặc in)", "m3", "invite"],
  ["Chốt thực đơn tiệc cưới", "m3"],
  ["Đặt hoa cưới, trang trí bàn gia tiên", "m3"],
  ["Đặt xe hoa", "m3"],
  ["Gửi thiệp mời", "w4", null, "high"],
  ["Thử váy và trang điểm lần cuối", "w4"],
  ["Chốt số bàn với nhà hàng", "w4", null, "high"],
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
  return SEED_TASKS.map(([title, when, link, priority], i) => {
    const t: PlanTask = { id: `t${String(i + 1).padStart(2, "0")}`, title, when, done: false };
    if (link) t.link = link;
    if (priority) t.priority = priority;
    if (link === "shoot" && opts.shootOnWeddingDay) {
      t.title = "Quay chụp ngày cưới cùng studio";
      t.when = "d0";
    }
    return t;
  });
}

export const BUDGET_CATS = [
  { key: "party", label: "Tiệc cưới" },
  { key: "venue", label: "Địa điểm" },
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
  return SEED_BUDGET.map(([cat, name], i) => ({ id: `b${String(i + 1).padStart(2, "0")}`, cat, name, estimate: 0, actual: 0, paid: 0 }));
}

/**
 * Lịch trình mẫu một ngày cưới hai lễ (vu quy nhà gái, thành hôn nhà trai) và
 * tiệc tối, tách việc riêng của cô dâu / chú rể. KHÔNG gieo sẵn vào kế hoạch
 * mới: studio đọc lịch trình này để xếp ê-kíp, nên giờ nào nằm đó phải là giờ
 * khách đã chốt — khách bấm "Dùng lịch trình mẫu" thì mới có.
 */
const SEED_DAY: [string, string, Side?][] = [
  ["04:30", "Trang điểm, làm tóc cô dâu", "bride"],
  ["06:00", "Chú rể sửa soạn, mặc vest", "groom"],
  ["07:00", "Chụp ảnh chuẩn bị: váy, nhẫn, phụ kiện", "bride"],
  ["07:00", "Đội bê tráp tập trung, kiểm tra lễ vật", "groom"],
  ["08:00", "Nhà trai đến — lễ gia tiên nhà gái (lễ vu quy)"],
  ["09:30", "Rước dâu về nhà trai"],
  ["10:30", "Lễ gia tiên nhà trai (lễ thành hôn)"],
  ["11:30", "Ăn trưa, nghỉ ngơi"],
  ["16:00", "Trang điểm lại cho tiệc tối", "bride"],
  ["17:30", "Đón khách, chụp ảnh với khách mời"],
  ["18:30", "Khai tiệc: lên sân khấu, cắt bánh, rót rượu"],
  ["21:00", "Tiễn khách"],
];

const SEED_PACKING: [string, number][] = [
  ["Nhẫn cưới", 2],
  ["Giấy đăng ký kết hôn, CCCD", 1],
  ["Váy cưới", 1],
  ["Áo dài lễ gia tiên", 2],
  ["Vest chú rể", 1],
  ["Giày cưới + giày dự phòng", 2],
  ["Khăn voan, phụ kiện tóc", 1],
  ["Hoa cầm tay", 1],
  ["Phong bì lì xì", 20],
  ["Lễ vật rước dâu (trầu cau, rượu, bánh)", 1],
  ["Bộ dặm phấn, son", 1],
  ["Kim băng, kim chỉ", 1],
  ["Sạc dự phòng", 2],
  ["Khăn giấy, khăn ướt", 2],
  ["Nước uống, kẹo", 1],
  ["Kịch bản chương trình + danh bạ các bên", 1],
];

const SEED_SHOTS: [string, boolean][] = [
  ["Cô dâu chú rể với bố mẹ hai bên", true],
  ["Cô dâu chú rể với ông bà", true],
  ["Trao nhẫn cưới", true],
  ["Lễ gia tiên nhà gái", true],
  ["Lễ gia tiên nhà trai", true],
  ["Rót rượu, cắt bánh trên sân khấu", true],
  ["Toàn cảnh khách mời tại tiệc", true],
  ["Chi tiết nhẫn, váy, hoa cầm tay", false],
  ["Cô dâu chuẩn bị, trang điểm", false],
  ["Đội bê tráp", false],
  ["Cô dâu chú rể với anh chị em", false],
  ["Nhóm bạn thân cô dâu", false],
  ["Nhóm bạn thân chú rể", false],
  ["Bàn gia tiên, trang trí tiệc", false],
  ["Khoảnh khắc tiễn khách", false],
];

/** Bộ mẫu bấm mới có: lịch trình, đồ cần mang, ảnh cần chụp. */
export function templateFor(list: "day" | "packing" | "shots", newId: () => string): PlanDayItem[] | PlanPack[] | PlanShot[] {
  if (list === "day") return SEED_DAY.map(([time, title, side]) => ({ id: newId(), time, title, ...(side ? { side } : {}) }));
  if (list === "packing") return SEED_PACKING.map(([name, qty]) => ({ id: newId(), name, qty, packed: false }));
  return SEED_SHOTS.map(([title, must]) => ({ id: newId(), title, must }));
}

export const DEFAULT_SETTINGS: PlanSettings = { table_size: 10, guests_expected: 0 };
export const EMPTY_STYLE: PlanStyle = { colors: [], links: [] };

/** Kế hoạch mới cho một hợp đồng. */
export function newPlan(opts: { weddingDate?: string | null; shootOnWeddingDay?: boolean }): WeddingPlanData {
  return {
    wedding_date: cleanDate(opts.weddingDate ?? null),
    budget_total: 0,
    tasks: defaultTasks({ shootOnWeddingDay: opts.shootOnWeddingDay }),
    budget: defaultBudget(),
    day: [],
    guests: [],
    vendors: [],
    people: [],
    packing: [],
    shots: [],
    style: { ...EMPTY_STYLE },
    settings: { ...DEFAULT_SETTINGS },
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

/** Tổng · xong · quá hạn (chưa xong mà hạn đã qua). */
export function taskStats(tasks: PlanTask[], auto: AutoLinks, weddingDate: string | null, today: string) {
  let done = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (taskDone(t, auto)) done++;
    else {
      const due = taskDue(t, weddingDate);
      if (due && due < today) overdue++;
    }
  }
  return { total: tasks.length, done, overdue, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

/** Việc theo từng mốc, đúng thứ tự mốc; mốc không có việc thì bỏ. */
export function groupTasks(tasks: PlanTask[]): { when: (typeof PLAN_WHEN)[number]; tasks: PlanTask[] }[] {
  return PLAN_WHEN.map((w) => ({ when: w, tasks: tasks.filter((t) => t.when === w.key) })).filter((g) => g.tasks.length > 0);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ngân sách
   ───────────────────────────────────────────────────────────────────────────── */

export type StudioBudgetLine = { name: string; estimate: number; paid: number; due?: string | null };

/** Chi phí tính cho một khoản: giá đã chốt nếu có, không thì dự kiến. */
export function lineCost(l: { estimate: number; actual?: number }): number {
  return l.actual && l.actual > 0 ? l.actual : l.estimate;
}

/**
 * Tổng ngân sách.
 *   · `cost`  = tổng chi phí (đã chốt thì theo giá chốt, chưa thì theo dự kiến);
 *   · `owed`  = còn phải trả, cộng từng khoản (khoản trả dư không bù khoản khác);
 *   · `left`  = ngân sách còn lại sau chi phí — null khi chưa đặt ngân sách tổng.
 */
export function budgetSummary(lines: PlanBudgetLine[], studio: StudioBudgetLine | null, total: number) {
  const all = [...lines.map((l) => ({ estimate: l.estimate, actual: l.actual, paid: l.paid })), ...(studio ? [{ estimate: studio.estimate, actual: studio.estimate, paid: studio.paid }] : [])];
  const estimate = all.reduce((s, l) => s + l.estimate, 0);
  const actual = all.reduce((s, l) => s + (l.actual ?? 0), 0);
  const cost = all.reduce((s, l) => s + lineCost(l), 0);
  const paid = all.reduce((s, l) => s + l.paid, 0);
  const owed = all.reduce((s, l) => s + Math.max(0, lineCost(l) - l.paid), 0);
  return {
    estimate,
    actual,
    cost,
    paid,
    owed,
    left: total > 0 ? total - cost : null,
    over: total > 0 && cost > total,
    /** % ngân sách đã dùng (theo chi phí), kẹp 0–100 cho thanh tiến độ. */
    pct: total > 0 ? Math.min(100, Math.round((cost / total) * 100)) : 0,
  };
}

/**
 * Ai chi bao nhiêu (theo chi phí). Khoản chưa gán người chi gom vào `none`. Gói
 * của studio không tính: hợp đồng không ghi bên nào trả, đoán là sai số.
 */
export function payerBreakdown(lines: PlanBudgetLine[]): { payer: Payer | "none"; amount: number; pct: number }[] {
  const sums = new Map<Payer | "none", number>();
  for (const l of lines) sums.set(l.payer ?? "none", (sums.get(l.payer ?? "none") ?? 0) + lineCost(l));
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  return [...sums.entries()]
    .filter(([, v]) => v > 0)
    .map(([payer, amount]) => ({ payer, amount, pct: total ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => (a.payer === "none" ? 1 : b.payer === "none" ? -1 : b.amount - a.amount));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Khách mời & xếp bàn
   ───────────────────────────────────────────────────────────────────────────── */

/** Phản hồi từ thiệp online đã khớp với một khách trong danh sách. */
export type GuestReply = { attending: boolean; num_guests: number };

/** Xác nhận cuối của một khách: phản hồi qua thiệp thắng ghi tay. */
export function guestRsvp(g: PlanGuest, reply?: GuestReply): Rsvp {
  if (reply) return reply.attending ? "yes" : "no";
  return g.rsvp;
}

/** Số người của một khách: phản hồi qua thiệp có ghi số người thì theo đó. */
export function guestCount(g: PlanGuest, reply?: GuestReply): number {
  if (reply?.attending && reply.num_guests > 0) return reply.num_guests;
  return g.count;
}

export function guestSummary(guests: PlanGuest[], replies: Record<string, GuestReply> = {}) {
  const s = { entries: guests.length, people: 0, invited: 0, yes: 0, no: 0, pending: 0, seated: 0, unseated: 0, gifts: 0, thanked: 0, giftCount: 0 };
  for (const g of guests) {
    const r = guestRsvp(g, replies[g.id]);
    const n = guestCount(g, replies[g.id]);
    if (r === "no") s.no += n;
    else {
      s.people += n;
      if (r === "yes") s.yes += n;
      else s.pending += n;
      if (g.table) s.seated += n;
      else s.unseated += n;
    }
    if (g.invited) s.invited++;
    if (g.gift > 0) {
      s.gifts += g.gift;
      s.giftCount++;
    }
    if (g.thanked) s.thanked++;
  }
  return s;
}

/**
 * Sơ đồ bàn: mỗi bàn bao nhiêu người, có vượt sức chứa không. Khách báo không
 * dự không chiếm chỗ. Bàn sắp theo số ("Bàn 2" trước "Bàn 10").
 */
export function tableSummary(guests: PlanGuest[], replies: Record<string, GuestReply>, tableSize: number) {
  const tables = new Map<string, { table: string; people: number; guests: PlanGuest[] }>();
  for (const g of guests) {
    if (!g.table || guestRsvp(g, replies[g.id]) === "no") continue;
    const key = g.table.toLowerCase();
    const t = tables.get(key) ?? { table: g.table, people: 0, guests: [] };
    t.people += guestCount(g, replies[g.id]);
    t.guests.push(g);
    tables.set(key, t);
  }
  return [...tables.values()]
    .map((t) => ({ ...t, over: t.people > tableSize }))
    .sort((a, b) => a.table.localeCompare(b.table, "vi", { numeric: true }));
}

/** Ước số bàn cần đặt. */
export function tablesNeeded(people: number, tableSize: number): number {
  return tableSize > 0 ? Math.ceil(people / tableSize) : 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Lịch trình, sắp tới
   ───────────────────────────────────────────────────────────────────────────── */

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

export type StudioAppt = { id: string; date: string; time: string; title: string; place?: string };

export type AgendaItem = {
  key: string;
  date: string;
  kind: "task" | "pay" | "appt";
  title: string;
  sub?: string;
  overdue: boolean;
};

/**
 * "Sắp tới" của trang tổng quan — gom ba nguồn về một dòng thời gian: việc chưa
 * xong có hạn trong `days` ngày tới (kể cả đã quá hạn), khoản còn nợ có hạn trả,
 * lịch hẹn của studio. Quá hạn đứng đầu.
 */
export function upcoming(
  plan: WeddingPlanData,
  auto: AutoLinks,
  extra: { studioAppts?: StudioAppt[]; studioLine?: StudioBudgetLine | null; today: string; days?: number; limit?: number },
): AgendaItem[] {
  const horizon = addDays(extra.today, extra.days ?? 45);
  const out: AgendaItem[] = [];
  for (const t of plan.tasks) {
    if (taskDone(t, auto)) continue;
    const due = taskDue(t, plan.wedding_date);
    if (!due || due > horizon) continue;
    out.push({ key: `t-${t.id}`, date: due, kind: "task", title: t.title, sub: t.owner ? OWNER_LABEL[t.owner] : undefined, overdue: due < extra.today });
  }
  for (const l of plan.budget) {
    const owed = lineCost(l) - l.paid;
    if (owed <= 0 || !l.due || l.due > horizon) continue;
    out.push({ key: `b-${l.id}`, date: l.due, kind: "pay", title: `Thanh toán ${l.name}`, sub: `Còn ${owed.toLocaleString("vi-VN")}đ`, overdue: l.due < extra.today });
  }
  const sl = extra.studioLine;
  if (sl?.due && sl.estimate > sl.paid && sl.due <= horizon) {
    out.push({ key: "b-studio", date: sl.due, kind: "pay", title: `Thanh toán ${sl.name}`, sub: `Còn ${(sl.estimate - sl.paid).toLocaleString("vi-VN")}đ`, overdue: sl.due < extra.today });
  }
  for (const a of extra.studioAppts ?? []) {
    if (a.date < extra.today || a.date > horizon) continue;
    out.push({ key: `a-${a.id}`, date: a.date, kind: "appt", title: a.title, sub: [a.time, a.place].filter(Boolean).join(" · ") || undefined, overdue: false });
  }
  return out
    .sort((a, b) => (a.overdue !== b.overdue ? (a.overdue ? -1 : 1) : a.date.localeCompare(b.date)))
    .slice(0, extra.limit ?? 8);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Làm sạch dữ liệu
   ───────────────────────────────────────────────────────────────────────────── */

export const PLAN_LIMITS = {
  tasks: 150, budget: 80, day: 60, guests: 1000, vendors: 80, people: 40, packing: 80, shots: 80,
  title: 160, name: 120, note: 500, short: 120, colors: 8, links: 6,
} as const;
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

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Số điện thoại: giữ chữ số và một dấu + đầu, tối đa 15 ký tự. */
function phone(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 15);
  return /\d{6,}/.test(s) ? s : undefined;
}

function oneOf<T extends string>(v: unknown, keys: readonly T[]): T | undefined {
  return keys.includes(v as T) ? (v as T) : undefined;
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
const WHENS = PLAN_WHEN.map((w) => w.key);
const LINKS: PlanLink[] = ["studio", "shoot", "invite", "photos", "pay"];
const OWNERS: TaskOwner[] = ["bride", "groom", "both", "family"];
const PRIORITIES: TaskPriority[] = ["high", "mid", "low"];
const SIDES: Side[] = ["bride", "groom"];
const PAYERS: Payer[] = ["bride", "groom", "bride_family", "groom_family", "both"];
const GROUPS = Object.keys(GUEST_GROUP_LABEL) as GuestGroup[];
const RSVPS: Rsvp[] = ["pending", "yes", "no"];

type R = Record<string, unknown>;
const rec = (raw: unknown): R | null => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as R) : null);
const idOf = (r: R) => (typeof r.id === "string" && ID.test(r.id) ? r.id : null);

/** Gắn các trường tuỳ chọn có giá trị — trường rỗng thì bỏ hẳn khỏi dòng. */
function withOpt<T extends object>(base: T, opt: Record<string, unknown>): T {
  for (const [k, v] of Object.entries(opt)) if (v !== undefined && v !== "") (base as Record<string, unknown>)[k] = v;
  return base;
}

/**
 * Bộ làm sạch từng loại dòng. Trả null khi dòng không dùng được (thiếu mã, thiếu
 * tên) — đọc DB thì bỏ dòng đó, thêm / sửa thì báo lỗi `empty`.
 */
const CLEAN: { [K in PlanList]: (raw: unknown) => WeddingPlanData[K][number] | null } = {
  tasks(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const title = text(r.title, PLAN_LIMITS.title);
    if (!id || !title) return null;
    return withOpt<PlanTask>({ id, title, when: oneOf(r.when, WHENS) ?? "m3", done: r.done === true }, {
      note: note(r.note), link: oneOf(r.link, LINKS), owner: oneOf(r.owner, OWNERS), priority: oneOf(r.priority, PRIORITIES), due: cleanDate(r.due) ?? undefined,
    });
  },
  budget(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    if (!id) return null;
    const cat = (CAT_KEYS.has(r.cat as string) ? r.cat : "other") as BudgetCat;
    const name = text(r.name, PLAN_LIMITS.name) || (cat === "other" ? "" : budgetCatLabel(cat));
    if (!name) return null;
    return withOpt<PlanBudgetLine>({ id, cat, name, estimate: money(r.estimate), actual: money(r.actual), paid: money(r.paid) }, {
      payer: oneOf(r.payer, PAYERS), due: cleanDate(r.due) ?? undefined, note: note(r.note),
    });
  },
  day(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const title = text(r.title, PLAN_LIMITS.title);
    if (!id || !title) return null;
    return withOpt<PlanDayItem>({ id, time: cleanTime(r.time), title }, {
      place: text(r.place, PLAN_LIMITS.short), who: text(r.who, PLAN_LIMITS.short), side: oneOf(r.side, SIDES),
    });
  },
  guests(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const name = text(r.name, PLAN_LIMITS.name);
    if (!id || !name) return null;
    return withOpt<PlanGuest>({
      id, name, group: oneOf(r.group, GROUPS) ?? "other", count: int(r.count, 1, 50, 1), invited: r.invited === true,
      rsvp: oneOf(r.rsvp, RSVPS) ?? "pending", gift: money(r.gift), thanked: r.thanked === true,
    }, { phone: phone(r.phone), table: text(r.table, 24), note: note(r.note) });
  },
  vendors(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const name = text(r.name, PLAN_LIMITS.name);
    if (!id || !name) return null;
    const link = typeof r.link === "string" && r.link.trim() ? safeUrl(r.link.slice(0, 300)) : null;
    return withOpt<PlanVendor>({
      id, cat: (CAT_KEYS.has(r.cat as string) ? r.cat : "other") as BudgetCat, name, quote: money(r.quote), status: r.status === "booked" ? "booked" : "consider",
    }, { phone: phone(r.phone), link: link ?? undefined, note: note(r.note) });
  },
  people(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const name = text(r.name, PLAN_LIMITS.name);
    if (!id || !name) return null;
    return withOpt<PlanPerson>({ id, name, role: text(r.role, 40) }, { phone: phone(r.phone), side: oneOf(r.side, SIDES) });
  },
  packing(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const name = text(r.name, PLAN_LIMITS.name);
    if (!id || !name) return null;
    return { id, name, qty: int(r.qty, 1, 999, 1), packed: r.packed === true };
  },
  shots(raw) {
    const r = rec(raw);
    if (!r) return null;
    const id = idOf(r);
    const title = text(r.title, PLAN_LIMITS.title);
    if (!id || !title) return null;
    return { id, title, must: r.must !== false };
  },
};

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

export function cleanStyle(raw: unknown): PlanStyle {
  const r = rec(raw) ?? {};
  const colors: string[] = [];
  for (const c of Array.isArray(r.colors) ? r.colors : []) {
    const rgb = parseHex(typeof c === "string" ? c : "");
    if (!rgb) continue;
    const hex = "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
    if (!colors.includes(hex)) colors.push(hex);
    if (colors.length >= PLAN_LIMITS.colors) break;
  }
  const links: string[] = [];
  for (const l of Array.isArray(r.links) ? r.links : []) {
    const u = typeof l === "string" && l.trim() ? safeUrl(l.slice(0, 300)) : null;
    if (u && !links.includes(u)) links.push(u);
    if (links.length >= PLAN_LIMITS.links) break;
  }
  return withOpt<PlanStyle>({ colors, links }, { concept: note(r.concept) });
}

export function cleanSettings(raw: unknown): PlanSettings {
  const r = rec(raw) ?? {};
  return {
    table_size: int(r.table_size, 2, 30, DEFAULT_SETTINGS.table_size),
    guests_expected: int(r.guests_expected, 0, 5000, 0),
  };
}

/** Dòng `wedding_plans` (jsonb không lược đồ) → dữ liệu sạch. */
export function normalizePlan(row: {
  wedding_date?: unknown;
  budget_total?: unknown;
  tasks?: unknown;
  budget?: unknown;
  day_plan?: unknown;
  extra?: unknown;
} | null | undefined): WeddingPlanData {
  const x = rec(row?.extra) ?? {};
  return {
    wedding_date: cleanDate(row?.wedding_date ?? null),
    budget_total: money(row?.budget_total),
    tasks: cleanList(row?.tasks, CLEAN.tasks, PLAN_LIMITS.tasks),
    budget: cleanList(row?.budget, CLEAN.budget, PLAN_LIMITS.budget),
    day: cleanList(row?.day_plan, CLEAN.day, PLAN_LIMITS.day),
    guests: cleanList(x.guests, CLEAN.guests, PLAN_LIMITS.guests),
    vendors: cleanList(x.vendors, CLEAN.vendors, PLAN_LIMITS.vendors),
    people: cleanList(x.people, CLEAN.people, PLAN_LIMITS.people),
    packing: cleanList(x.packing, CLEAN.packing, PLAN_LIMITS.packing),
    shots: cleanList(x.shots, CLEAN.shots, PLAN_LIMITS.shots),
    style: cleanStyle(x.style),
    settings: cleanSettings(x.settings),
  };
}

/** Kế hoạch → các cột của `wedding_plans`. `withExtra` = false khi DB chưa có cột `extra`. */
export function planToRow(p: WeddingPlanData, withExtra = true) {
  const base = { wedding_date: p.wedding_date, budget_total: p.budget_total, tasks: p.tasks, budget: p.budget, day_plan: p.day };
  if (!withExtra) return base;
  return { ...base, extra: { guests: p.guests, vendors: p.vendors, people: p.people, packing: p.packing, shots: p.shots, style: p.style, settings: p.settings } };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Thao tác
   ───────────────────────────────────────────────────────────────────────────── */

export type PlanOp =
  | { op: "set_date"; date: string | null }
  | { op: "set_budget_total"; amount: number }
  | { op: "set_settings"; table_size?: number; guests_expected?: number }
  | { op: "set_style"; colors?: string[]; concept?: string; links?: string[] }
  | { op: "add"; list: PlanList; item: Record<string, unknown> }
  | { op: "add_many"; list: PlanList; items: Record<string, unknown>[] }
  | { op: "set"; list: PlanList; id: string; patch: Record<string, unknown> }
  | { op: "remove"; list: PlanList; id: string }
  | { op: "template"; list: "day" | "packing" | "shots" };

export type OpResult = { ok: true; plan: WeddingPlanData } | { ok: false; error: string };

const LISTS = Object.keys(CLEAN) as PlanList[];

/** Thao tác này cần cột `extra` (danh sách mới, phong cách, cài đặt)? */
export function opNeedsExtra(raw: unknown): boolean {
  const o = rec(raw);
  if (!o) return false;
  if (o.op === "set_style" || o.op === "set_settings") return true;
  return EXTRA_LISTS.includes(o.list as PlanList);
}

/** Mã ngẫu nhiên cho dòng mới — trình duyệt tạo sẵn để máy chủ dùng đúng mã đó. */
export function newPlanId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Mã dòng mới: dùng mã trình duyệt gửi lên nếu hợp lệ và chưa trùng. */
function pickId(want: unknown, taken: Set<string>, newId: () => string): string {
  if (typeof want === "string" && ID.test(want) && !taken.has(want)) return want;
  let id = newId();
  while (taken.has(id)) id = newId();
  return id;
}

/**
 * Áp MỘT thao tác lên kế hoạch, trả bản mới (không sửa bản cũ). Thao tác lạ /
 * thiếu dữ liệu → `{ ok: false }`, không đoán. Sửa/xoá một dòng không còn (máy
 * kia vừa xoá) cũng là lỗi `gone` — nói thẳng thay vì im lặng như đã lưu.
 */
export function applyPlanOp(plan: WeddingPlanData, raw: unknown, newId: () => string = newPlanId): OpResult {
  const o = rec(raw);
  if (!o) return { ok: false, error: "bad_op" };

  switch (o.op) {
    case "set_date": {
      if (o.date === null || o.date === "") return { ok: true, plan: { ...plan, wedding_date: null } };
      const d = cleanDate(o.date);
      if (!d) return { ok: false, error: "bad_date" };
      return { ok: true, plan: { ...plan, wedding_date: d } };
    }
    case "set_budget_total":
      return { ok: true, plan: { ...plan, budget_total: money(o.amount) } };
    case "set_settings":
      return { ok: true, plan: { ...plan, settings: cleanSettings({ ...plan.settings, ...pick(o, ["table_size", "guests_expected"]) }) } };
    case "set_style":
      return { ok: true, plan: { ...plan, style: cleanStyle({ ...plan.style, ...pick(o, ["colors", "concept", "links"]) }) } };
  }

  const list = o.list as PlanList;
  if (!LISTS.includes(list)) return { ok: false, error: "bad_op" };
  // Kiểu chung cho mọi danh sách: mỗi nhánh dưới chỉ đụng tới đúng danh sách `list`.
  const rows = plan[list] as { id: string }[];
  const clean = CLEAN[list] as (raw: unknown) => { id: string } | null;
  const put = (next: { id: string }[]): OpResult => ({ ok: true, plan: { ...plan, [list]: next } as WeddingPlanData });
  // `link` của việc cần làm là dữ liệu studio gắn kèm (tự tick) — khách không tự
  // gắn được khi thêm, không gỡ được khi sửa. (Nhà cung cấp cũng có `link`, nhưng
  // là đường dẫn web, sửa tự do.)
  const lockLink = list === "tasks";

  switch (o.op) {
    case "add": {
      if (rows.length >= PLAN_LIMITS[list]) return { ok: false, error: "too_many" };
      const item = rec(o.item);
      if (!item) return { ok: false, error: "bad_op" };
      const v = clean({ ...item, ...(lockLink ? { link: undefined } : {}), id: pickId(item.id, new Set(rows.map((r) => r.id)), newId) });
      if (!v) return { ok: false, error: "empty" };
      return put([...rows, v]);
    }
    case "add_many": {
      if (!Array.isArray(o.items)) return { ok: false, error: "bad_op" };
      const taken = new Set(rows.map((r) => r.id));
      const added: { id: string }[] = [];
      for (const raw of o.items) {
        if (rows.length + added.length >= PLAN_LIMITS[list]) break;
        const item = rec(raw);
        if (!item) continue;
        const v = clean({ ...item, ...(lockLink ? { link: undefined } : {}), id: pickId(item.id, taken, newId) });
        if (!v) continue;
        taken.add(v.id);
        added.push(v);
      }
      if (!added.length) return { ok: false, error: rows.length >= PLAN_LIMITS[list] ? "too_many" : "empty" };
      return put([...rows, ...added]);
    }
    case "set": {
      const i = rows.findIndex((r) => r.id === o.id);
      if (i < 0) return { ok: false, error: "gone" };
      const patch = rec(o.patch);
      if (!patch) return { ok: false, error: "bad_op" };
      const prev = rows[i] as Record<string, unknown>;
      // Mã không đổi qua thao tác sửa.
      const v = clean({ ...prev, ...patch, id: prev.id, ...(lockLink ? { link: prev.link } : {}) });
      if (!v) return { ok: false, error: "empty" };
      const next = [...rows];
      next[i] = v;
      return put(next);
    }
    case "remove": {
      const i = rows.findIndex((r) => r.id === o.id);
      if (i < 0) return { ok: false, error: "gone" };
      return put(rows.filter((_, j) => j !== i));
    }
    case "template": {
      if (list !== "day" && list !== "packing" && list !== "shots") return { ok: false, error: "bad_op" };
      // Chỉ khi danh sách còn trống: bấm nhầm không được nhân đôi cả ngày.
      if (rows.length > 0) return { ok: false, error: "not_empty" };
      return put(templateFor(list, newId));
    }
  }
  return { ok: false, error: "bad_op" };
}

function pick(o: R, keys: string[]): R {
  const out: R = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/** Lỗi của `applyPlanOp` / route → câu cho khách đọc. */
export function planErrorText(code: string): string {
  switch (code) {
    case "empty": return "Bạn chưa nhập nội dung.";
    case "too_many": return "Danh sách đã quá dài — xoá bớt dòng cũ trước khi thêm.";
    case "bad_date": return "Ngày chưa đúng — nhập theo dạng ngày/tháng/năm.";
    case "gone": return "Dòng này vừa bị xoá ở máy khác. Trang đã tải lại bản mới nhất.";
    case "not_empty": return "Danh sách đã có nội dung.";
    case "plan_locked": return "Trang tạm khoá do gói dịch vụ của studio đã hết hạn. Vui lòng liên hệ studio.";
    case "need_update": return "Mục này chưa lưu được — studio cần cập nhật hệ thống. Bạn báo studio giúp nhé.";
    case "busy": return "Đang có người khác cùng sửa — thử lại sau giây lát.";
    case "offline": return "Mất mạng — thay đổi chưa được lưu.";
    default: return "Chưa lưu được, thử lại sau.";
  }
}

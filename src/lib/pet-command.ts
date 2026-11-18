/* ═══════════════════════════════════════════════════════════════════════════
   RA LỆNH CHO BÉ MÁY ẢNH — hiểu câu gõ tay của studio (thuần, không I/O; kiểm
   thử ở desktop/test/pet-command.mjs).

   Ví dụ: "tạo hợp đồng", "mở hợp đồng chị Lan", "mo album minh thu",
   "tạo báo giá", "xem báo giá HD-2026-014", "lịch", "cho ăn".

   Không dùng AI: câu lệnh ngắn, tập việc đóng — luật từ khoá trả lời tức thì,
   không tốn tiền, không đoán bậy. Gõ có dấu hay không dấu đều được (so trên
   chuỗi đã bỏ dấu).
   ═══════════════════════════════════════════════════════════════════════════ */

export type Entity = "contract" | "quote" | "album";

export type Command =
  | { kind: "go"; href: string; label: string }
  | { kind: "search"; entity: Entity | "all"; query: string; label: string }
  | { kind: "feed" }
  | { kind: "unknown" };

/** Chữ thường, bỏ dấu tiếng Việt (đ → d), gộp khoảng trắng. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Obj = {
  entity?: Entity;
  /** Cụm từ (đã bỏ dấu) gọi tên đối tượng — cụm dài xét trước. */
  words: string[];
  list: { href: string; label: string };
  create?: { href: string; label: string };
};

const OBJECTS: Obj[] = [
  {
    entity: "contract",
    words: ["hop dong", "hd"],
    list: { href: "/dashboard/studio/contracts", label: "Hợp đồng" },
    create: { href: "/dashboard/studio/contracts/new", label: "Tạo hợp đồng mới" },
  },
  {
    entity: "quote",
    words: ["bao gia", "bg"],
    list: { href: "/dashboard/studio/quotes", label: "Báo giá" },
    create: { href: "/dashboard/studio/quotes/new", label: "Tạo báo giá" },
  },
  {
    entity: "album",
    words: ["album", "anbum"],
    list: { href: "/dashboard/albums", label: "Thư viện album" },
    create: { href: "/dashboard/albums/new", label: "Tạo album" },
  },
  { words: ["lich hen studio", "lich studio"], list: { href: "/dashboard/studio/calendar?tab=studio", label: "Lịch studio" } },
  { words: ["lich lam viec", "lich chup", "lich"], list: { href: "/dashboard/studio/calendar", label: "Lịch làm việc" } },
  { words: ["dat lich"], list: { href: "/dashboard/studio/bookings", label: "Đặt lịch khách" } },
  { words: ["khach hang", "danh ba"], list: { href: "/dashboard/studio/clients", label: "Khách hàng" } },
  { words: ["thu chi", "doanh thu", "cong no", "bao cao"], list: { href: "/dashboard/studio/reports", label: "Thu chi & công nợ" } },
  { words: ["hop thu", "tin nhan", "inbox"], list: { href: "/dashboard/studio/inbox", label: "Hộp thư" } },
  { words: ["yeu cau moi", "lead"], list: { href: "/dashboard/studio/leads", label: "Yêu cầu mới" } },
  { words: ["voucher", "the qua"], list: { href: "/dashboard/studio/vouchers", label: "Voucher & thẻ quà" } },
  { words: ["xu ly hinh anh", "hau ky"], list: { href: "/dashboard/studio/production", label: "Xử lý hình ảnh" } },
  { words: ["tong quan", "trang chu"], list: { href: "/dashboard/studio", label: "Tổng quan" } },
];

const CREATE_VERBS = ["tao moi", "them moi", "lap", "tao", "them", "lam", "new"];
const OPEN_VERBS = ["mo ra", "mo", "xem", "tim kiem", "tim", "vao", "coi", "open", "kiem"];
/** Từ đệm bỏ đi trước khi lấy phần tên. */
const FILLERS = ["be oi", "oi", "giup minh", "giup", "cho minh", "cho toi", "cho", "di", "nhe", "nha", "voi", "cua", "ten", "khach", "mot", "1", "cai"];

/** Bỏ `phrase` (đã bỏ dấu, theo nguyên từ) khỏi danh sách token, trả về true nếu có. */
function take(tokens: string[], folded: string[], phrase: string): boolean {
  const p = phrase.split(" ");
  for (let i = 0; i + p.length <= folded.length; i++) {
    if (p.every((w, k) => folded[i + k] === w)) {
      tokens.splice(i, p.length);
      folded.splice(i, p.length);
      return true;
    }
  }
  return false;
}

export function parseCommand(input: string): Command {
  const raw = (input || "").replace(/[?!.,;:]+/g, " ").trim();
  if (!raw) return { kind: "unknown" };
  const tokens = raw.split(/\s+/);
  const folded = tokens.map(fold);
  const all = folded.join(" ");

  if (/^(cho )?(be )?an( di| nha| nhe)?$/.test(all) || all === "cho an" || all === "feed") return { kind: "feed" };

  let create = false;
  let open = false;
  for (const v of CREATE_VERBS) if (take(tokens, folded, v)) { create = true; break; }
  if (!create) for (const v of OPEN_VERBS) if (take(tokens, folded, v)) { open = true; break; }

  let obj: Obj | null = null;
  // Cụm dài trước ("lich hen studio" trước "lich") — duyệt mọi cụm theo độ dài giảm dần.
  const phrases = OBJECTS.flatMap((o) => o.words.map((w) => ({ o, w }))).sort((a, b) => b.w.length - a.w.length);
  for (const { o, w } of phrases) {
    if (take(tokens, folded, w)) { obj = o; break; }
  }

  // Bỏ từ đệm ở đầu / cuối phần còn lại.
  const strip = () => {
    let changed = true;
    while (changed && folded.length) {
      changed = false;
      for (const f of FILLERS) {
        const n = f.split(" ").length;
        if (folded.slice(0, n).join(" ") === f) { tokens.splice(0, n); folded.splice(0, n); changed = true; }
        else if (folded.length >= n && folded.slice(-n).join(" ") === f) { tokens.splice(-n); folded.splice(-n); changed = true; }
      }
    }
  };
  strip();
  const query = tokens.join(" ").trim();

  if (obj) {
    if (create) {
      return obj.create ? { kind: "go", ...obj.create } : { kind: "go", ...obj.list };
    }
    if (query && obj.entity) return { kind: "search", entity: obj.entity, query, label: obj.list.label };
    return { kind: "go", ...obj.list };
  }

  // Không nêu loại: "mở chị Lan" / gõ thẳng tên → tìm trong cả ba loại.
  if (query && (open || !create)) return { kind: "search", entity: "all", query, label: "mọi thứ" };
  return { kind: "unknown" };
}

/* ── So khớp tên ────────────────────────────────────────────────────────── */

/** Danh xưng hay gõ kèm tên nhưng dữ liệu thường không có — bỏ khi so khớp. */
const HONORIFICS = new Set(["chi", "anh", "em", "co", "chu", "ba", "ong", "ban", "a", "c", "e", "bac", "di", "cau"]);

export function queryTerms(query: string): string[] {
  const t = fold(query).split(" ").filter(Boolean);
  const kept = t.filter((w) => !HONORIFICS.has(w));
  // Gõ đúng một danh xưng ("chị") thì vẫn giữ để còn thứ mà tìm.
  return kept.length ? kept : t;
}

/**
 * Điểm khớp của một bản ghi (0 = không khớp). Mọi từ của câu tìm phải có mặt
 * trong các trường; trùng hẳn mã (HD-2026-014) hay trùng nguyên tên được điểm cao.
 */
export function matchScore(terms: string[], fields: (string | null | undefined)[]): number {
  if (!terms.length) return 0;
  const hay = fields.filter(Boolean).map((f) => fold(String(f)));
  const joined = hay.join(" | ");
  if (!terms.every((w) => joined.includes(w))) return 0;
  const q = terms.join(" ");
  let score = 1;
  if (hay.some((h) => h === q)) score += 5;
  // Khớp ở đầu một từ ("lan" khớp "Lan" chứ không chỉ "Lananh") — ưu tiên hơn.
  if (terms.every((w) => hay.some((h) => (" " + h).includes(" " + w)))) score += 2;
  return score;
}

export const COMMAND_EXAMPLES = [
  "Tạo hợp đồng",
  "Mở hợp đồng chị Lan",
  "Tạo báo giá",
  "Mở album Minh Thư",
  "Lịch",
];

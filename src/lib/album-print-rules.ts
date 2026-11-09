/* ═══════════════════════════════════════════════════════════════════════════
   ẢNH IN TẶNG — phần logic THUẦN (không import gì, chạy thẳng trong Node để
   kiểm thử: `npm run test:album-print`). Phần DB ở album-print.ts.

   Luồng: hợp đồng có "số ảnh in tặng" (studio_contracts.print_quota) → album
   giao khách của hợp đồng đó hiện phần "Chọn ảnh in" → khách chọn tối đa đúng
   số đó rồi bấm Gửi → studio bấm "Copy vào thư mục Ảnh in" → máy chủ tạo thư
   mục "Ảnh in" NGAY TRONG thư mục Drive giao file hoàn thiện và chép ảnh vào.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Trạng thái ảnh in của một album — máy chủ dựng, trang khách & studio dùng. */
export interface PrintState {
  /** Số ảnh in hợp đồng tặng (> 0 thì album mới hiện phần chọn ảnh in). */
  quota: number;
  /** id ảnh (photos.id) khách đã gửi để in. */
  picks: string[];
  sentAt: string | null;
  /** Studio đã chép vào thư mục "Ảnh in" → khách không sửa được nữa. */
  copiedAt: string | null;
  /**
   * true = hợp đồng có SĐT khách / cô dâu / chú rể → chỉ người nhập đúng một
   * trong các số đó mới chọn được ảnh in (người xem khác chỉ xem). Bản thân
   * các SĐT KHÔNG bao giờ gửi xuống trình duyệt.
   */
  coupleOnly?: boolean;
}

/** Tên thư mục con tạo trong thư mục giao file hoàn thiện. */
export const PRINT_FOLDER_NAME = "Ảnh in";

/** Video không in được — không cho chọn. */
export function isPrintable(p: { name?: string | null; is_video?: boolean | null }): boolean {
  if (p.is_video) return false;
  return !/\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i.test(p.name ?? "");
}

/** Số ảnh in tặng hợp lệ (số nguyên dương), 0 = hợp đồng không tặng in. */
export function normalizeQuota(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(500, Math.floor(n));
}

/**
 * Danh sách id khách gửi lên: bỏ trùng, bỏ rỗng; quá số ảnh tặng thì báo lỗi
 * (không tự cắt bớt — cắt là âm thầm bỏ ảnh khách đã chọn).
 */
export function cleanPrintIds(raw: unknown, quota: number): { ok: true; ids: string[] } | { ok: false; error: "bad_request" | "limit_exceeded" } {
  if (!Array.isArray(raw)) return { ok: false, error: "bad_request" };
  const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))];
  if (ids.length > quota) return { ok: false, error: "limit_exceeded" };
  return { ok: true, ids };
}

/**
 * Thư mục Drive giao file hoàn thiện để tạo "Ảnh in" bên trong: nguồn giai đoạn
 * giao khách ĐẦU TIÊN theo thứ tự (thư mục gốc "File ChinhSua" — thư mục con
 * tách ra sau luôn có position lớn hơn), bỏ qua thư mục video.
 */
export function pickDeliveryFolder<T extends { stage?: string | null; drive_url?: string | null; name?: string | null; position?: number | null }>(
  sources: T[]
): T | null {
  const del = sources
    .filter((s) => s.stage === "delivery" && !!s.drive_url)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return del.find((s) => !/video/i.test(s.name ?? "")) ?? del[0] ?? null;
}

/* ─── Chỉ cô dâu / chú rể được chọn ảnh in ───────────────────────────────────
   Link album giao khách hay được chuyển cho cả họ hàng, bạn bè (và mật khẩu
   album thường chính là SĐT, cũng được đưa kèm). Nên quyền CHỌN ảnh in không
   dựa vào việc mở được album, mà vào SĐT đã đăng ký với studio: SĐT khách,
   cô dâu, chú rể trên hợp đồng dùng album này. Nhập đúng một trong các số đó
   mới được chọn; người khác vẫn xem ảnh bình thường. */

/** Khoá so sánh của một SĐT: 9 chữ số cuối (0901…, +84901…, 84901… cùng khớp). */
function phoneKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.replace(/\D/g, "");
  if (d.length < 9 || d.length > 12) return null;
  return d.slice(-9);
}

/** Danh sách SĐT được phép chọn ảnh in — đã chuẩn hoá, bỏ trùng, sắp xếp. */
export function printPhoneKeys(raw: unknown[]): string[] {
  return [...new Set(raw.map(phoneKey).filter((x): x is string => !!x))].sort();
}

/** SĐT khách nhập có khớp một trong các số được phép không. */
export function matchPrintPhone(input: unknown, keys: string[]): boolean {
  const k = phoneKey(input);
  return !!k && keys.includes(k);
}

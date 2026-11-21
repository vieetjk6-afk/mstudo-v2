import "server-only";
import { randomInt, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GỬI FILE NHANH (vieetjk.com/up → link rút gọn vieetjk.com/f/<mã>).
 *
 * Tải 1 hoặc nhiều file lên, nhận một link ngắn, bấm là tải về. File sống
 * TTL_MS (30 phút) rồi bị xoá.
 *
 * Cách lưu — KHÔNG cần bảng trong database, chỉ một bucket Storage RIÊNG TƯ:
 *   <mã>.json    bản kê: tên gốc, dung lượng, giờ hết hạn của từng file
 *   <mã>_<i>     nội dung file thứ i (tên gốc tiếng Việt không hợp lệ làm
 *                khoá Storage, nên khoá chỉ là số thứ tự; tên gốc nằm ở bản kê
 *                và được trả lại lúc tải qua Content-Disposition)
 * Tất cả nằm phẳng ở gốc bucket để MỘT lệnh list (sắp theo created_at) là đủ
 * thấy mọi thứ đã quá hạn — dọn rẻ, không phải duyệt từng thư mục.
 *
 * File đi THẲNG từ trình duyệt lên Storage bằng URL ký sẵn: serverless của
 * Vercel chặn body ở ~4.5MB nên không thể cho file đi qua route.
 */

export const BUCKET = "quick-share";
export const TTL_MS = 30 * 60 * 1000;
/** Trần mỗi file (MB). Gói Supabase Free cho tối đa 50MB/file. */
/** Tên miền ngắn cho link tải /f/<mã> (khớp QUICK_SHARE_HOSTS trong src/proxy.ts). */
export const LINK_HOST = process.env.QUICK_SHARE_LINK_HOST?.trim() || "vieetjk.com";

export const MAX_FILE_MB = Math.max(1, Number(process.env.QUICK_SHARE_MAX_MB || "100"));
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MAX_FILES = 20;

/** Bỏ các ký tự dễ nhầm (0/o, 1/l/i) để đọc link qua điện thoại không sai. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LEN = 7;
export const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`);

export function newCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export type ShareFile = { name: string; size: number; type: string };
export type Manifest = { v: 1; createdAt: number; expiresAt: number; files: ShareFile[] };

export const manifestKey = (code: string) => `${code}.json`;
export const fileKey = (code: string, i: number) => `${code}_${i}`;

/** Tên file an toàn để hiển thị/tải: bỏ đường dẫn, ký tự điều khiển, cắt độ dài. */
export function cleanName(raw: unknown): string {
  const s = String(raw ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .trim()
    .slice(0, 180);
  return s || "file";
}

/** Có đặt mã PIN (QUICK_SHARE_PIN) để chỉ người biết mã mới tải lên được không. */
export function pinRequired(): boolean {
  return !!process.env.QUICK_SHARE_PIN?.trim();
}

export function pinOk(given: unknown): boolean {
  const pin = process.env.QUICK_SHARE_PIN?.trim();
  if (!pin) return true;
  const a = Buffer.from(String(given ?? ""), "utf8");
  const b = Buffer.from(pin, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

let bucketReady = false;
/**
 * Tạo bucket nếu chưa có (riêng tư, có trần dung lượng mỗi file) — để tính năng
 * chạy được ngay mà không phải chép thêm file SQL. Storage tự chặn file vượt
 * trần, nên dung lượng client khai báo không phải hàng rào duy nhất.
 */
export async function ensureBucket(db = createAdminClient()): Promise<void> {
  if (bucketReady) return;
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
    });
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  } else if (Number(data.file_size_limit) !== MAX_FILE_BYTES) {
    // Bucket tạo từ trước với trần cũ (50MB) — nâng theo cấu hình hiện tại.
    // Lỗi (vd gói Supabase giới hạn thấp hơn) thì bỏ qua: Storage vẫn tự chặn.
    await db.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES }).catch(() => undefined);
  }
  bucketReady = true;
}

export async function readManifest(code: string, db = createAdminClient()): Promise<Manifest | null> {
  if (!CODE_RE.test(code)) return null;
  const { data, error } = await db.storage.from(BUCKET).download(manifestKey(code));
  if (error || !data) return null;
  try {
    const m = JSON.parse(await data.text()) as Manifest;
    return m && Array.isArray(m.files) ? m : null;
  } catch {
    return null;
  }
}

let lastSweep = 0;
/**
 * Xoá mọi object quá hạn. Gọi "tiện đường" mỗi lần có người tạo link (tối đa
 * mỗi phút một lần trên một máy chủ) và từ cron hằng ngày. Link hết hạn đã bị
 * trang tải từ chối theo expiresAt, nên việc dọn chỉ là để giải phóng dung lượng.
 */
export async function sweepExpired(db = createAdminClient(), force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastSweep < 60_000) return 0;
  lastSweep = now;
  // Thêm 5 phút đệm: đừng xoá file của người vừa nhận link lúc sắp hết hạn
  // và đang tải dở.
  const cutoff = now - TTL_MS - 5 * 60 * 1000;
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list("", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
    if (error || !data?.length) break;
    const stale = data
      .filter((o) => o.id && o.created_at && Date.parse(o.created_at) < cutoff)
      .map((o) => o.name);
    if (!stale.length) break;
    const { error: rmErr } = await db.storage.from(BUCKET).remove(stale);
    if (rmErr) break;
    removed += stale.length;
    if (stale.length < data.length) break;
  }
  return removed;
}
